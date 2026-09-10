import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document } from 'mongoose';
import { randomUUID } from 'crypto';
import { AuditService } from '../audit/audit.service';
import type { RequestUser } from '../common/types';
import {
  DEFAULT_INTEREST_RATE,
  resolveInterestRate,
  calculateInterestAmount,
  getLoanCycleDays,
  loanTypeStartsFrozen,
  normalizePrincipalBalance,
  accrueLoanState,
  calculateDaysLate,
} from './loan.utils';
import type {
  CreateLoanDto,
  EditLoanDto,
  RedirectLoanDto,
  UpdateLoanMetaDto,
} from './dto/loan.dto';

export interface LoanDoc extends Document {
  companyId: string;
  clientId: string;
  status?: string;
  approvalStatus?: string;
  principal: number;
  currentBalance: number;
  paidAmount: number;
  interestPaidAmount: number;
  lastAccruedAt?: number;
  expiresAt?: number;
  grantedAt?: number;
  loanType?: string;
  interestRate?: number;
  nextDueDate?: number;
  accruedInterestBalance?: number;
  accruedLateFeeBalance?: number;
  collectorId?: string;
  collectorName?: string;
  hasPagare?: boolean;
  isLocatable?: boolean;
  cycleDays?: number;
  currency?: string;
}

export interface ClientDoc extends Document {
  companyId: string;
  fullName?: string;
  documentId?: string;
  phone?: string;
  address?: string;
  collectorId?: string;
  collectorName?: string;
}

export interface PagareDoc extends Document {
  companyId: string;
  tomo: string;
  asignado: boolean;
}

const normalizeSearchText = (value?: string) => (value || '').trim().toLocaleLowerCase('es');

@Injectable()
export class LoansService {
  constructor(
    @InjectModel('Loan') private readonly loanModel: Model<LoanDoc>,
    @InjectModel('Client') private readonly clientModel: Model<ClientDoc>,
    @InjectModel('Pagare') private readonly pagareModel: Model<PagareDoc>,
    private readonly audit: AuditService,
  ) {}

  toPublic(doc: LoanDoc): Record<string, unknown> {
    const raw = doc.toObject({ virtuals: false }) as Record<string, unknown>;
    return { ...raw, id: String(raw._id ?? doc.id ?? '') };
  }

  /** Hidrata clientName/clientDocumentId de creditos huérfanos y marca clientMissing. */
  private async attachClientMeta(publicRows: Array<Record<string, unknown>>, companyId: string): Promise<void> {
    const needers = publicRows.filter((r) => Boolean(r.clientId) && !String(r.clientName || '').trim());
    if (needers.length > 0) {
      const ids = needers.map((r) => String(r.clientId));
      const clients = await this.clientModel
        .find({ companyId, _id: { $in: ids } })
        .exec();
      const byId = new Map(clients.map((c) => [String(c._id), c]));
      for (const row of needers) {
        const client = byId.get(String(row.clientId));
        if (client?.fullName) {
          row.clientName = client.fullName;
          row.clientDocumentId = client.documentId || '';
          row.clientPhone = client.phone || '';
          // Reparación persistente del nombre denormalizado (evita re-consultas).
          await this.loanModel.updateOne({ _id: String(row.id) }, { $set: { clientName: client.fullName } }).exec();
        } else {
          row.clientMissing = true;
        }
      }
    }
    for (const row of publicRows) {
      // Solo se marca huérfano si NO hay nombre; los espejos externos traen nombre sin clientId local.
      if (!String(row.clientName || '').trim()) row.clientMissing = true;
    }

    // Saldos calculados (tiempo real): Saldo = Capital + Interés + Mora (− abonos ya aplicados
    // a capital/interest). El motor existente (accrueLoanState) expone esos componentes.
    const noInterestTypes = new Set(['ALQUILER_INMUEBLE', 'PRESTACION_SERVICIOS']);
    for (const row of publicRows) {
      const status = String(row.status || '');
      const approval = String(row.approvalStatus || '');
      const loanType = String(row.loanType || '');
      const noInterest = noInterestTypes.has(loanType);
      const liveActive = status === 'ACTIVE' && approval === 'APPROVED';

      if (liveActive) {
        const accrued = accrueLoanState(row as never);
        row.principalBalance = Math.round(accrued.principalBalance);
        row.interestDue = Math.round(noInterest ? 0 : accrued.accruedInterestBalance);
        row.lateFeeDue = Math.round(noInterest ? 0 : accrued.accruedLateFeeBalance);
        row.totalDue = Math.round(accrued.principalBalance + (row.interestDue as number) + (row.lateFeeDue as number));
      } else {
        const persistedInterest = Number(row.accruedInterestBalance || 0);
        const persistedLateFee = Number(row.accruedLateFeeBalance || 0);
        const principalPend = Math.max(0, Number(row.currentBalance || 0));
        row.principalBalance = principalPend;
        row.interestDue = noInterest ? 0 : Math.round(persistedInterest);
        row.lateFeeDue = noInterest ? 0 : Math.round(persistedLateFee);
        row.totalDue = Math.round(principalPend + (row.interestDue as number) + (row.lateFeeDue as number));
      }
      const daysLate = calculateDaysLate({
        status: row.status as never,
        approvalStatus: row.approvalStatus as never,
        expiresAt: Number(row.expiresAt || 0) || undefined,
        nextDueDate: Number(row.nextDueDate || 0) || undefined,
      });
      row.daysLate = daysLate;
    }
  }

  async list(
    companyId: string,
    filters: { status?: string; collectorId?: string; approvalStatus?: string; clientId?: string } = {},
  ): Promise<Record<string, unknown>[]> {
    const query: Record<string, unknown> = { companyId };
    if (filters.status) query.status = filters.status;
    if (filters.approvalStatus) query.approvalStatus = filters.approvalStatus;
    if (filters.collectorId) query.collectorId = filters.collectorId;
    if (filters.clientId) query.clientId = filters.clientId;
    const docs = await this.loanModel.find(query).sort({ grantedAt: -1 }).exec();
    const publicRows = docs.map((d) => this.toPublic(d));
    await this.attachClientMeta(publicRows, companyId);
    return publicRows;
  }

  async getById(companyId: string, loanId: string): Promise<Record<string, unknown> | null> {
    const doc = await this.loanModel.findOne({ _id: loanId, companyId }).exec();
    if (!doc) return null;
    const publicRow = this.toPublic(doc);
    await this.attachClientMeta([publicRow], companyId);
    return publicRow;
  }

  async create(
    companyId: string,
    data: CreateLoanDto,
    actor: RequestUser,
  ): Promise<Record<string, unknown>> {
    const clientDoc = await this.clientModel.findOne({ _id: data.clientId, companyId }).exec();
    // Integridad referencial obligatoria: ningun credito sin cliente vinculado.
    if (!data.clientId || !String(data.clientId).trim()) {
      throw new BadRequestException('El crédito requiere un cliente vinculado (clientId).');
    }
    if (!clientDoc) {
      throw new NotFoundException('El cliente asociado no existe. No se puede registrar el crédito.');
    }
    const now = Date.now();
    // Regla de interes por cuotas para creditos nuevos a plazos
    // (6=20%, 12=20%, 18=25%, 24=30%); default historico 20% para el resto.
    const interestRate = resolveInterestRate({
      interestRate: data.interestRate,
      cantidadCuotas: data.cantidadCuotas,
    });
    const loanForCalc = { ...data, interestRate };
    const approvalStatus = actor.role === 'ADMIN' ? 'APPROVED' : 'PENDING';
    const initialInterest = calculateInterestAmount(loanForCalc);
    const initialStatus = loanTypeStartsFrozen(data.loanType) ? 'FROZEN' : 'ACTIVE';
    const loanId = randomUUID();

    const newLoan: Record<string, unknown> = {
      _id: loanId,
      id: loanId,
      companyId,
      ...data,
      interestRate,
      origen: data.origen || 'sistema_creditos',
      hasPagare: Boolean(data.hasPagare || data.tomo),
      clientName: clientDoc?.fullName || '',
      clientNameLower: normalizeSearchText(clientDoc?.fullName),
      clientDocumentId: clientDoc?.documentId || '',
      clientPhone: clientDoc?.phone || '',
      clientAddress: clientDoc?.address || '',
      status: initialStatus,
      approvalStatus,
      totalAmount: data.principal + initialInterest,
      currentBalance: data.principal,
      saldoInicial: data.principal,
      saldoDefinitivo: data.principal + initialInterest,
      saldoProvisorio: data.principal + initialInterest,
      totalPagadoAprobado: 0,
      totalPendienteAprobacion: 0,
      tienePagosPendientes: false,
      estadoCobranza: 'activo',
      paidAmount: 0,
      interestPaidAmount: 0,
      accruedInterestBalance: initialInterest,
      accruedLateFeeBalance: 0,
      nextDueDate: data.expiresAt,
      lastAccruedAt: data.grantedAt,
      refinancingCount: 0,
      cycleDays: data.cycleDays || getLoanCycleDays(data),
      grantedAt: data.grantedAt,
      expiresAt: data.expiresAt,
      commissionRate: data.commissionRate ?? 0,
      createdAt: now,
      updatedAt: now,
      createdBy: actor.uid,
    };
    if (approvalStatus === 'APPROVED') {
      newLoan.approvedAt = now;
      newLoan.approvedBy = actor.uid;
    }

    const session = await this.loanModel.db.startSession();
    try {
      await session.withTransaction(async () => {
        await this.loanModel.create([newLoan], { session });

        // Asignacion de pagare (reutiliza uno libre del tomo o crea uno nuevo).
        if (data.tomo) {
          const tomoNormalized = String(data.tomo).trim();
          const available = await this.pagareModel
            .findOne({ companyId, tomo: tomoNormalized, asignado: false })
            .session(session)
            .exec();
          if (available) {
            await this.pagareModel
              .updateOne(
                { _id: available.id },
                {
                  $set: {
                    loanId,
                    nombre: clientDoc?.fullName || '',
                    nombreLower: normalizeSearchText(clientDoc?.fullName),
                    cedula: clientDoc?.documentId || '',
                    cedulaSearch: (clientDoc?.documentId || '').toLowerCase(),
                    monto: data.principal,
                    tomo: tomoNormalized,
                    cobrador: data.collectorName || '',
                    estado: 'activo',
                    asignado: true,
                    updatedAt: now,
                  },
                },
                { session },
              )
              .exec();
          } else {
            const pagareId = randomUUID();
            await this.pagareModel.create(
              [
                {
                  _id: pagareId,
                  id: pagareId,
                  companyId,
                  loanId,
                  nombre: clientDoc?.fullName || '',
                  nombreLower: normalizeSearchText(clientDoc?.fullName),
                  cedula: clientDoc?.documentId || '',
                  cedulaSearch: (clientDoc?.documentId || '').toLowerCase(),
                  monto: data.principal,
                  tomo: tomoNormalized,
                  cobrador: data.collectorName || '',
                  estado: 'activo',
                  asignado: true,
                  createdAt: now,
                  updatedAt: now,
                  createdBy: actor.uid,
                },
              ],
              { session },
            );
          }
        }

        // Si lo crea un ADMIN, el cliente queda bajo ese cobrador.
        if (actor.role === 'ADMIN') {
          await this.clientModel
            .updateOne(
              { _id: data.clientId, companyId },
              {
                $set: {
                  collectorId: data.collectorId,
                  collectorName: data.collectorName,
                  updatedAt: now,
                },
              },
              { session },
            )
            .exec();
        }
      });
    } finally {
      await session.endSession();
    }

    await this.audit.log({
      action: approvalStatus === 'APPROVED' ? 'CREATE' : 'LOAN_REQUEST',
      entity: 'LOAN',
      entityId: loanId,
      details: {
        principal: data.principal,
        currency: data.currency,
        clientId: data.clientId,
        interestRate: data.interestRate,
        approvalStatus,
        hasPagare: newLoan.hasPagare,
        tomo: data.tomo || null,
      },
      actor,
    });

    const created = await this.loanModel.findOne({ _id: loanId }).exec();
    return this.toPublic(created as LoanDoc);
  }

  async approve(companyId: string, loanId: string, actor: RequestUser): Promise<void> {
    const loan = await this.loanModel.findOne({ _id: loanId, companyId }).exec();
    if (!loan) throw new NotFoundException('El credito no existe.');
    if (loan.approvalStatus === 'APPROVED') return;
    const now = Date.now();
    const principalBalance = normalizePrincipalBalance(loan);
    const interest = calculateInterestAmount({
      principal: loan.principal ?? 0,
      interestRate: loan.interestRate ?? DEFAULT_INTEREST_RATE,
      loanType: loan.loanType as never,
      status: loan.status,
    });
    await this.loanModel
      .updateOne(
        { _id: loanId, companyId },
        {
          $set: {
            approvalStatus: 'APPROVED',
            approvedAt: now,
            approvedBy: actor.uid,
            updatedAt: now,
            currentBalance: principalBalance,
            totalAmount: principalBalance + interest,
            nextDueDate: loan.nextDueDate || loan.expiresAt,
            lastAccruedAt: loan.lastAccruedAt || loan.grantedAt || now,
            accruedInterestBalance:
              typeof loan.accruedInterestBalance === 'number'
                ? loan.accruedInterestBalance
                : interest,
            accruedLateFeeBalance: loan.accruedLateFeeBalance || 0,
          },
        },
      )
      .exec();
    await this.audit.log({
      action: 'APPROVE_LOAN',
      entity: 'LOAN',
      entityId: loanId,
      details: { clientId: loan.clientId },
      actor,
    });
  }

  async updateAdminMeta(
    companyId: string,
    loanId: string,
    changes: UpdateLoanMetaDto,
    actor: RequestUser,
  ): Promise<void> {
    const res = await this.loanModel
      .updateOne(
        { _id: loanId, companyId },
        {
          $set: {
            hasPagare: changes.hasPagare || false,
            isLocatable: changes.isLocatable || false,
            updatedAt: Date.now(),
          },
        },
      )
      .exec();
    if (res.matchedCount === 0) throw new NotFoundException('El credito no existe.');
    await this.audit.log({
      action: 'UPDATE_LOAN_META',
      entity: 'LOAN',
      entityId: loanId,
      details: { hasPagare: changes.hasPagare || false, isLocatable: changes.isLocatable || false },
      actor,
    });
  }

  async edit(
    companyId: string,
    loanId: string,
    changes: EditLoanDto,
    actor: RequestUser,
  ): Promise<Record<string, unknown>> {
    const loan = await this.loanModel.findOne({ _id: loanId, companyId }).exec();
    if (!loan) throw new NotFoundException('El credito no existe.');
    const now = Date.now();
    const nextPrincipalBalance = normalizePrincipalBalance({
      currentBalance: changes.principal,
      principal: changes.principal,
    });
    const hasAnyPayment = (loan.paidAmount || 0) > 0 || (loan.interestPaidAmount || 0) > 0;
    const updatedInterestPerCycle = calculateInterestAmount(changes);
    const accrued = accrueLoanState(
      Object.assign(loan.toObject(), {
        principal: changes.principal,
        interestRate: changes.interestRate,
        cycleDays: changes.cycleDays,
        grantedAt: changes.grantedAt,
        expiresAt: changes.expiresAt,
        loanType: loan.loanType,
      }) as never,
    );
    const nextInterestBalance =
      accrued.accruedInterestBalance > 0
        ? accrued.accruedInterestBalance
        : nextPrincipalBalance > 0
          ? updatedInterestPerCycle
          : 0;
    const nextLateFeeBalance = accrued.accruedLateFeeBalance;
    const nextStatus =
      nextPrincipalBalance <= 0 && nextInterestBalance <= 0 && nextLateFeeBalance <= 0
        ? 'PAID'
        : loan.status === 'FROZEN'
          ? 'FROZEN'
          : 'ACTIVE';

    const session = await this.loanModel.db.startSession();
    try {
      await session.withTransaction(async () => {
        await this.loanModel
          .updateOne(
            { _id: loanId, companyId },
            {
              $set: {
                principal: changes.principal,
                interestRate: changes.interestRate,
                cycleDays: changes.cycleDays,
                grantedAt: changes.grantedAt,
                expiresAt: changes.expiresAt,
                collectorId: changes.collectorId,
                collectorName: changes.collectorName,
                hasPagare: changes.hasPagare || false,
                isLocatable: changes.isLocatable || false,
                totalAmount: nextPrincipalBalance + nextInterestBalance + nextLateFeeBalance,
                currentBalance: nextPrincipalBalance,
                accruedInterestBalance: nextInterestBalance,
                accruedLateFeeBalance: nextLateFeeBalance,
                nextDueDate: hasAnyPayment ? loan.nextDueDate || changes.expiresAt : changes.expiresAt,
                lastAccruedAt: accrued.lastAccruedAt,
                status: nextStatus,
                updatedAt: now,
              },
            },
            { session },
          )
          .exec();
        await this.clientModel
          .updateOne(
            { _id: loan.clientId, companyId },
            {
              $set: {
                collectorId: changes.collectorId,
                collectorName: changes.collectorName,
                updatedAt: now,
              },
            },
            { session },
          )
          .exec();
      });
    } finally {
      await session.endSession();
    }

    await this.audit.log({
      action: 'UPDATE_LOAN',
      entity: 'LOAN',
      entityId: loanId,
      details: {
        previousPrincipal: loan.principal,
        newPrincipal: changes.principal,
        previousInterestRate: loan.interestRate,
        newInterestRate: changes.interestRate,
        previousCollectorId: loan.collectorId,
        newCollectorId: changes.collectorId,
      },
      actor,
    });
    const updated = await this.loanModel.findOne({ _id: loanId }).exec();
    return this.toPublic(updated as LoanDoc);
  }

  async confirmInforconf(companyId: string, loanId: string, actor: RequestUser): Promise<void> {
    const now = Date.now();
    const res = await this.loanModel
      .updateOne(
        { _id: loanId, companyId },
        { $set: { inforconfConfirmedAt: now, inforconfConfirmedBy: actor.uid, updatedAt: now } },
      )
      .exec();
    if (res.matchedCount === 0) throw new NotFoundException('El credito no existe.');
    await this.audit.log({
      action: 'CONFIRM_INFORCONF',
      entity: 'LOAN',
      entityId: loanId,
      details: 'Cliente marcado como reportado en Inforconf',
      actor,
    });
  }

  async freeze(companyId: string, loanId: string, actor: RequestUser): Promise<void> {
    const now = Date.now();
    const res = await this.loanModel
      .updateOne({ _id: loanId, companyId }, { $set: { status: 'FROZEN', updatedAt: now } })
      .exec();
    if (res.matchedCount === 0) throw new NotFoundException('El credito no existe.');
    await this.audit.log({
      action: 'FREEZE',
      entity: 'LOAN',
      entityId: loanId,
      details: 'Credito congelado por el administrador',
      actor,
    });
  }

  async redirect(
    companyId: string,
    loanId: string,
    changes: RedirectLoanDto,
    actor: RequestUser,
  ): Promise<void> {
    const loan = await this.loanModel.findOne({ _id: loanId, companyId }).exec();
    if (!loan) throw new NotFoundException('El credito no existe.');
    const now = Date.now();
    const session = await this.loanModel.db.startSession();
    try {
      await session.withTransaction(async () => {
        await this.loanModel
          .updateOne(
            { _id: loanId, companyId },
            {
              $set: {
                collectorId: changes.collectorId,
                collectorName: changes.collectorName,
                updatedAt: now,
              },
            },
            { session },
          )
          .exec();
        await this.clientModel
          .updateOne(
            { _id: loan.clientId, companyId },
            {
              $set: {
                collectorId: changes.collectorId,
                collectorName: changes.collectorName,
                updatedAt: now,
              },
            },
            { session },
          )
          .exec();
      });
    } finally {
      await session.endSession();
    }
    await this.audit.log({
      action: 'REDIRECT',
      entity: 'LOAN',
      entityId: loanId,
      details: { from: loan.collectorName, to: changes.collectorName, reason: 'Redirected by admin' },
      actor,
    });
  }

  async anular(
    companyId: string,
    loanId: string,
    reason: string,
    actor: RequestUser,
  ): Promise<void> {
    const normalizedReason = reason.trim();
    if (!normalizedReason) throw new BadRequestException('La razon de anulacion es obligatoria.');
    const loan = await this.loanModel.findOne({ _id: loanId, companyId }).exec();
    if (!loan) throw new NotFoundException('El credito no existe.');
    const now = Date.now();
    await this.loanModel
      .updateOne(
        { _id: loanId, companyId },
        {
          $set: {
            status: 'ANULADO',
            anuladoAt: now,
            anuladoBy: actor.uid,
            anulacionRazon: normalizedReason,
            updatedAt: now,
          },
        },
      )
      .exec();
    await this.audit.log({
      action: 'ANNUL_LOAN',
      entity: 'LOAN',
      entityId: loanId,
      details: {
        clientId: loan.clientId,
        collectorId: loan.collectorId,
        principal: loan.principal,
        reason: normalizedReason,
      },
      actor,
    });
  }
}

interface LoanRecord {
  currentBalance?: number;
  principal?: number;
  interestRate?: number;
  status?: string;
  loanType?: string;
  expiresAt?: number;
  nextDueDate?: number;
  grantedAt?: number;
  interestPaidAmount?: number;
  paidAmount?: number;
  accruedInterestBalance?: number;
  accruedLateFeeBalance?: number;
  lastAccruedAt?: number;
}
