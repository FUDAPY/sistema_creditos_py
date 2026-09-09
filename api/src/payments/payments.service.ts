import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document } from 'mongoose';
import { randomUUID } from 'crypto';
import type { PaymentType } from '@syscreditos/shared';
import { AuditService } from '../audit/audit.service';
import type { RequestUser } from '../common/types';
import { accrueLoanState } from '../loans/loan.utils';

export interface PaymentDoc extends Document {
  companyId: string;
  loanId: string;
  clientId?: string;
  amount: number;
  paymentType?: PaymentType;
  approvalStatus?: string;
  estadoRendicion?: string;
  loanImpactApplied?: boolean;
  principalApplied?: number;
  interestApplied?: number;
  arrearsApplied?: number;
  paidAt?: number;
  previousBalance?: number;
  interestDueAtPayment?: number;
  lateFeeDueAtPayment?: number;
}

export interface LoanDoc extends Document {
  companyId: string;
  clientId: string;
  clientName?: string;
  clientDocumentId?: string;
  status?: string;
  approvalStatus?: string;
  currency?: string;
  principal: number;
  currentBalance: number;
  paidAmount?: number;
  interestPaidAmount?: number;
  accruedInterestBalance?: number;
  accruedLateFeeBalance?: number;
  expiresAt?: number;
  grantedAt?: number;
  nextDueDate?: number;
  lastAccruedAt?: number;
  interestRate?: number;
  loanType?: string;
  cycleDays?: number;
  saldoDefinitivo?: number;
  totalPendienteAprobacion?: number;
}

export interface Splits {
  lateFeeApplied: number;
  interestApplied: number;
  principalApplied: number;
  resultingPrincipalBalance: number;
  resultingInterestBalance: number;
  resultingLateFeeBalance: number;
  maxAllowed: number;
}

const applyPaymentByType = (
  projected: {
    principalBalance: number;
    accruedInterestBalance: number;
    accruedLateFeeBalance: number;
  },
  amountPaid: number,
  paymentType: PaymentType = 'MIXED',
): Splits => {
  if (paymentType === 'CAPITAL') {
    const principalApplied = Math.min(amountPaid, projected.principalBalance);
    return {
      lateFeeApplied: 0,
      interestApplied: 0,
      principalApplied,
      resultingPrincipalBalance: Math.max(0, projected.principalBalance - principalApplied),
      resultingInterestBalance: projected.accruedInterestBalance,
      resultingLateFeeBalance: projected.accruedLateFeeBalance,
      maxAllowed: projected.principalBalance,
    };
  }
  if (paymentType === 'INTEREST') {
    const lateFeeApplied = Math.min(amountPaid, projected.accruedLateFeeBalance);
    const afterLateFee = amountPaid - lateFeeApplied;
    const interestApplied = Math.min(afterLateFee, projected.accruedInterestBalance);
    return {
      lateFeeApplied,
      interestApplied,
      principalApplied: 0,
      resultingPrincipalBalance: projected.principalBalance,
      resultingInterestBalance: Math.max(0, projected.accruedInterestBalance - interestApplied),
      resultingLateFeeBalance: Math.max(0, projected.accruedLateFeeBalance - lateFeeApplied),
      maxAllowed: projected.accruedLateFeeBalance + projected.accruedInterestBalance,
    };
  }
  const lateFeeApplied = Math.min(amountPaid, projected.accruedLateFeeBalance);
  const afterLateFee = amountPaid - lateFeeApplied;
  const interestApplied = Math.min(afterLateFee, projected.accruedInterestBalance);
  const afterInterest = afterLateFee - interestApplied;
  const principalApplied = Math.min(afterInterest, projected.principalBalance);
  return {
    lateFeeApplied,
    interestApplied,
    principalApplied,
    resultingPrincipalBalance: Math.max(0, projected.principalBalance - principalApplied),
    resultingInterestBalance: Math.max(0, projected.accruedInterestBalance - interestApplied),
    resultingLateFeeBalance: Math.max(0, projected.accruedLateFeeBalance - lateFeeApplied),
    maxAllowed:
      projected.principalBalance +
      projected.accruedInterestBalance +
      projected.accruedLateFeeBalance,
  };
};

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel('Payment') private readonly paymentModel: Model<PaymentDoc>,
    @InjectModel('Loan') private readonly loanModel: Model<LoanDoc>,
    private readonly audit: AuditService,
  ) {}

  toPublic(doc: PaymentDoc): Record<string, unknown> {
    const raw = doc.toObject({ virtuals: false }) as Record<string, unknown>;
    return { ...raw, id: String(raw._id ?? doc.id ?? '') };
  }

  async list(
    companyId: string,
    filters: { loanId?: string; approvalStatus?: string; collectorId?: string } = {},
  ): Promise<Record<string, unknown>[]> {
    const query: Record<string, unknown> = { companyId };
    if (filters.loanId) query.loanId = filters.loanId;
    if (filters.approvalStatus) query.approvalStatus = filters.approvalStatus;
    if (filters.collectorId) query.collectorId = filters.collectorId;
    const docs = await this.paymentModel.find(query).sort({ createdAt: -1 }).exec();
    return docs.map((d) => this.toPublic(d));
  }

  async getById(companyId: string, paymentId: string): Promise<Record<string, unknown> | null> {
    const doc = await this.paymentModel.findOne({ _id: paymentId, companyId }).exec();
    return doc ? this.toPublic(doc) : null;
  }

  /**
   * Registra un pago. Queda PENDING: el impacto real al credito
   * (currentBalance, paidAmount, etc.) se aplica cuando el ADMIN lo aprueba.
   */
  async register(
    companyId: string,
    dto: { loanId: string; amount: number; paymentType?: PaymentType; paidAt?: number },
    actor: RequestUser,
  ): Promise<Record<string, unknown>> {
    const loan = await this.loanModel.findOne({ _id: dto.loanId, companyId }).exec();
    if (!loan) throw new NotFoundException('Credito no encontrado.');
    if (loan.approvalStatus !== 'APPROVED') {
      throw new BadRequestException('El credito debe estar aprobado para registrar pagos.');
    }
    if (loan.status === 'PAID' || loan.status === 'ANULADO') {
      throw new BadRequestException('El credito no admite pagos en su estado actual.');
    }
    const now = Date.now();
    const paymentType = dto.paymentType || 'MIXED';
    // Prestación (congelado, sin intereses) y Alquiler (monto fijo mensual):
    // el cobro es UNICAMENTE capital (no admiten "ambos" ni "interés").
    const loanTypeName = String((loan as unknown as { loanType?: string }).loanType || '');
    const nonInterestTypes = ['ALQUILER_INMUEBLE', 'PRESTACION_SERVICIOS'];
    if (nonInterestTypes.includes(loanTypeName) && paymentType !== 'CAPITAL') {
      throw new BadRequestException(
        'Este tipo de crédito no genera intereses: el cobro debe imputarse solo a capital (paymentType=CAPITAL).',
      );
    }
    const paidAt = dto.paidAt || now;
    const commissionRate = 0.07; // comision por recibo (misma base del sistema original)

    const session = await this.paymentModel.db.startSession();
    try {
      await session.withTransaction(async () => {
        const paymentId = randomUUID();
        const loanAny = loan as unknown as {
          clientId?: string;
          clientName?: string;
          clientDocumentId?: string;
        };
        await this.paymentModel.create(
          [
            {
              _id: paymentId,
              id: paymentId,
              companyId,
              loanId: loan.id,
              clientId: loanAny.clientId || '',
              clientName: loanAny.clientName || '',
              clientNameLower: (loanAny.clientName || '').trim().toLowerCase(),
              clientDocumentId: loanAny.clientDocumentId || '',
              collectorId: actor.uid,
              collectorName: actor.name,
              paymentType,
              currency: loan.currency || 'PYG',
              paidAt,
              amount: dto.amount,
              commissionAmount: Math.round(dto.amount * commissionRate),
              approvalStatus: 'PENDING',
              estadoRendicion: 'pendiente_rendicion',
              loanImpactApplied: false,
              createdAt: now,
              updatedAt: now,
              createdBy: actor.uid,
            },
          ],
          { session },
        );

        // Contadores provisionales en el credito (sin tocar saldos reales).
        const definitiveTotal =
          loan.saldoDefinitivo ??
          (loan.currentBalance || 0) +
            (loan.accruedInterestBalance || 0) +
            (loan.accruedLateFeeBalance || 0);
        const pendingAfter = Math.max(0, (loan.totalPendienteAprobacion || 0) + dto.amount);
        await this.loanModel
          .updateOne(
            { _id: loan.id },
            {
              $set: {
                saldoProvisorio: Math.max(0, definitiveTotal - pendingAfter),
                totalPendienteAprobacion: pendingAfter,
                tienePagosPendientes: true,
                estadoCobranza: 'pendiente_aprobacion',
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
      action: 'REGISTER_PAYMENT',
      entity: 'PAYMENT',
      details: { loanId: loan.id, amount: dto.amount, paymentType },
      actor,
    });

    const created = await this.paymentModel
      .findOne({ companyId, loanId: loan.id })
      .sort({ createdAt: -1 })
      .exec();
    return this.toPublic(created as PaymentDoc);
  }

  /** Aplica un pago pendiente: recalcula y actualiza el credito (aprobacion del ADMIN). */
  async approve(companyId: string, paymentId: string, actor: RequestUser): Promise<void> {
    const payment = await this.paymentModel.findOne({ _id: paymentId, companyId }).exec();
    if (!payment) throw new NotFoundException('El recibo no existe.');
    if (payment.approvalStatus === 'APPROVED') return;
    const loan = await this.loanModel.findOne({ _id: payment.loanId, companyId }).exec();
    if (!loan) throw new NotFoundException('El credito asociado no existe.');

    const now = Date.now();
    const loanImpactAlreadyApplied = payment.loanImpactApplied === true;
    const accrued = accrueLoanState(
      {
        principal: loan.principal ?? 0,
        interestRate: loan.interestRate ?? 20,
        loanType: loan.loanType as never,
        status: loan.status,
        approvalStatus: loan.approvalStatus,
        currentBalance: loan.currentBalance,
        interestPaidAmount: loan.interestPaidAmount,
        paidAmount: loan.paidAmount,
        cycleDays: loan.cycleDays,
        grantedAt: loan.grantedAt,
        expiresAt: loan.expiresAt,
        nextDueDate: loan.nextDueDate,
        lastAccruedAt: loan.lastAccruedAt,
      },
      payment.paidAt || now,
    );

    const splits = applyPaymentByType(
      {
        principalBalance: accrued.principalBalance,
        accruedInterestBalance: accrued.accruedInterestBalance,
        accruedLateFeeBalance: accrued.accruedLateFeeBalance,
      },
      payment.amount,
      payment.paymentType || 'MIXED',
    );

    const finalPrincipalBalance = splits.resultingPrincipalBalance;
    const finalInterestBalance = splits.resultingInterestBalance;
    const finalLateFeeBalance = splits.resultingLateFeeBalance;
    const principalApplied = splits.principalApplied;
    const interestApplied = splits.interestApplied;
    const lateFeeApplied = splits.lateFeeApplied;
    const newStatus =
      loan.status === 'FROZEN'
        ? 'FROZEN'
        : finalPrincipalBalance <= 0 && finalInterestBalance <= 0 && finalLateFeeBalance <= 0
          ? 'PAID'
          : 'ACTIVE';
    const finalNextDueDate = loan.expiresAt || now;
    const lastAccruedAt = accrued.lastAccruedAt;
    const pendingBeforeApproval = loan.totalPendienteAprobacion || 0;
    const pendingAfterApproval = loanImpactAlreadyApplied
      ? Math.max(0, pendingBeforeApproval)
      : Math.max(0, pendingBeforeApproval - (payment.amount || 0));
    const definitiveTotalAfterApproval =
      finalPrincipalBalance + finalInterestBalance + finalLateFeeBalance;

    const session = await this.paymentModel.db.startSession();
    try {
      await session.withTransaction(async () => {
        await this.paymentModel
          .updateOne(
            { _id: paymentId, companyId },
            {
              $set: {
                approvalStatus: 'APPROVED',
                estadoRendicion: 'aprobado',
                approvedAt: now,
                approvedBy: actor.uid,
                approvedByName: actor.name,
                loanImpactApplied: true,
                previousBalance: accrued.principalBalance,
                newBalance: finalPrincipalBalance,
                principalApplied,
                interestApplied,
                interestDueAtPayment: accrued.accruedInterestBalance,
                lateFeeDueAtPayment: accrued.accruedLateFeeBalance,
                arrearsApplied: lateFeeApplied,
                resultingInterestBalance: finalInterestBalance,
                resultingLateFeeBalance: finalLateFeeBalance,
                nextDueDateAfterPayment: finalNextDueDate,
                lastAccruedAtAfterPayment: lastAccruedAt,
                updatedAt: now,
              },
            },
            { session },
          )
          .exec();

        if (!loanImpactAlreadyApplied) {
          await this.loanModel
            .updateOne(
              { _id: loan.id },
              {
                $set: {
                  currentBalance: finalPrincipalBalance,
                  totalAmount: definitiveTotalAfterApproval,
                  paidAmount: (loan.paidAmount || 0) + (payment.amount || 0),
                  interestPaidAmount:
                    (loan.interestPaidAmount || 0) + lateFeeApplied + interestApplied,
                  accruedInterestBalance: finalInterestBalance,
                  accruedLateFeeBalance: finalLateFeeBalance,
                  nextDueDate: finalNextDueDate,
                  lastAccruedAt,
                  status: newStatus,
                  saldoInicial: loan.principal,
                  saldoDefinitivo: definitiveTotalAfterApproval,
                  saldoProvisorio: Math.max(0, definitiveTotalAfterApproval - pendingAfterApproval),
                  totalPagadoAprobado: (loan.paidAmount || 0) + (payment.amount || 0),
                  totalPendienteAprobacion: pendingAfterApproval,
                  tienePagosPendientes: pendingAfterApproval > 0,
                  estadoCobranza:
                    newStatus === 'PAID' && pendingAfterApproval === 0
                      ? 'pagado'
                      : pendingAfterApproval > 0
                        ? 'pendiente_aprobacion'
                        : 'activo',
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
      action: 'APPROVE_SETTLEMENT',
      entity: 'PAYMENT',
      entityId: paymentId,
      details: {
        loanId: payment.loanId,
        amount: payment.amount,
        principalApplied,
        interestApplied,
        lateFeeApplied,
      },
      actor,
    });
  }

  /** Rechaza/anula un pago. Si estaba pendiente solo revierte contadores; si ya impactaba, revierte el credito. */
  async reject(
    companyId: string,
    paymentId: string,
    actor: RequestUser,
    reason = '',
  ): Promise<void> {
    const payment = await this.paymentModel.findOne({ _id: paymentId, companyId }).exec();
    if (!payment) throw new NotFoundException('El recibo no existe.');
    const loan = await this.loanModel.findOne({ _id: payment.loanId, companyId }).exec();
    if (!loan) throw new NotFoundException('El credito asociado no existe.');
    const now = Date.now();
    const normalizedReason = reason.trim() || 'Desconfirmacion administrativa';

    if (payment.approvalStatus === 'PENDING' && payment.loanImpactApplied === false) {
      const pendingAfterDelete = Math.max(
        0,
        (loan.totalPendienteAprobacion || payment.amount || 0) - (payment.amount || 0),
      );
      const definitiveTotal =
        loan.saldoDefinitivo ??
        (loan.currentBalance || 0) +
          (loan.accruedInterestBalance || 0) +
          (loan.accruedLateFeeBalance || 0);
      await this.loanModel
        .updateOne(
          { _id: loan.id },
          {
            $set: {
              saldoProvisorio: Math.max(0, definitiveTotal - pendingAfterDelete),
              totalPendienteAprobacion: pendingAfterDelete,
              tienePagosPendientes: pendingAfterDelete > 0,
              estadoCobranza: pendingAfterDelete > 0 ? 'pendiente_aprobacion' : 'activo',
              updatedAt: now,
            },
          },
        )
        .exec();
      await this.paymentModel
        .updateOne(
          { _id: paymentId, companyId },
          {
            $set: {
              approvalStatus: 'REJECTED',
              estadoRendicion: 'anulado',
              anuladoAt: now,
              anuladoBy: actor.uid,
              anulacionRazon: normalizedReason,
              updatedAt: now,
            },
          },
        )
        .exec();
      await this.audit.log({
        action: 'ANNUL_PENDING_SETTLEMENT',
        entity: 'PAYMENT',
        entityId: paymentId,
        details: { loanId: payment.loanId, amount: payment.amount, reason: normalizedReason },
        actor,
      });
      return;
    }

    const principalApplied = payment.principalApplied || 0;
    const interestApplied = payment.interestApplied || 0;
    const lateFeeApplied = payment.arrearsApplied || 0;
    const shouldRevertLoanImpact = payment.loanImpactApplied !== false;
    const revertedPrincipalBalance = Math.max(
      0,
      (loan.currentBalance || 0) + principalApplied,
    );
    const revertedInterestBalance = Math.max(
      0,
      (loan.accruedInterestBalance || 0) + interestApplied,
    );
    const revertedLateFeeBalance = Math.max(
      0,
      (loan.accruedLateFeeBalance || 0) + lateFeeApplied,
    );
    const revertedStatus =
      loan.status === 'FROZEN'
        ? 'FROZEN'
        : revertedPrincipalBalance <= 0 &&
            revertedInterestBalance <= 0 &&
            revertedLateFeeBalance <= 0
          ? 'PAID'
          : 'ACTIVE';

    if (shouldRevertLoanImpact) {
      const revertedTotal =
        revertedPrincipalBalance + revertedInterestBalance + revertedLateFeeBalance;
      const pendingAfterRevert = Math.max(0, loan.totalPendienteAprobacion || 0);
      await this.loanModel
        .updateOne(
          { _id: loan.id },
          {
            $set: {
              currentBalance: revertedPrincipalBalance,
              totalAmount: revertedTotal,
              paidAmount: Math.max(0, (loan.paidAmount || 0) - (payment.amount || 0)),
              interestPaidAmount: Math.max(
                0,
                (loan.interestPaidAmount || 0) - interestApplied - lateFeeApplied,
              ),
              accruedInterestBalance: revertedInterestBalance,
              accruedLateFeeBalance: revertedLateFeeBalance,
              status: revertedStatus,
              saldoDefinitivo: revertedTotal,
              saldoProvisorio: Math.max(0, revertedTotal - pendingAfterRevert),
              totalPagadoAprobado: Math.max(0, (loan.paidAmount || 0) - (payment.amount || 0)),
              tienePagosPendientes: pendingAfterRevert > 0,
              estadoCobranza:
                revertedStatus === 'PAID' && pendingAfterRevert === 0
                  ? 'pagado'
                  : pendingAfterRevert > 0
                    ? 'pendiente_aprobacion'
                    : 'activo',
              updatedAt: now,
            },
          },
        )
        .exec();
    }

    await this.paymentModel
      .updateOne(
        { _id: paymentId, companyId },
        {
          $set: {
            approvalStatus: 'REJECTED',
            estadoRendicion: 'anulado',
            anuladoAt: now,
            anuladoBy: actor.uid,
            anulacionRazon: normalizedReason,
            loanImpactApplied: false,
            updatedAt: now,
          },
        },
      )
      .exec();

    await this.audit.log({
      action: 'ANNUL_SETTLEMENT',
      entity: 'PAYMENT',
      entityId: paymentId,
      details: { loanId: payment.loanId, amount: payment.amount, reason: normalizedReason },
      actor,
    });
  }

  async getLatestApprovedForLoan(
    companyId: string,
    loanId: string,
  ): Promise<PaymentDoc | null> {
    return this.paymentModel
      .findOne({
        companyId,
        loanId,
        approvalStatus: 'APPROVED',
        estadoRendicion: { $ne: 'anulado' },
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  /** Edita el monto de un abono YA APROBADO: revierte el impacto previo y lo recalcula. */
  async updateAmount(
    companyId: string,
    paymentId: string,
    newAmount: number,
    actor: RequestUser,
  ): Promise<void> {
    const payment = await this.paymentModel.findOne({ _id: paymentId, companyId }).exec();
    if (!payment) throw new NotFoundException('El abono no existe.');
    if (payment.approvalStatus !== 'APPROVED' || payment.estadoRendicion === 'anulado') {
      throw new BadRequestException('Solo se pueden editar abonos ya aprobados.');
    }
    const loan = await this.loanModel.findOne({ _id: payment.loanId, companyId }).exec();
    if (!loan) throw new NotFoundException('El credito asociado no existe.');
    const now = Date.now();

    const revertedPrincipalBalance = (loan.currentBalance || 0) + (payment.principalApplied || 0);
    const revertedInterestBalance =
      (loan.accruedInterestBalance || 0) + (payment.interestApplied || 0);
    const revertedLateFeeBalance =
      (loan.accruedLateFeeBalance || 0) + (payment.arrearsApplied || 0);
    const revertedPaidAmount = Math.max(0, (loan.paidAmount || 0) - payment.amount);
    const revertedInterestPaid = Math.max(
      0,
      (loan.interestPaidAmount || 0) -
        (payment.interestApplied || 0) -
        (payment.arrearsApplied || 0),
    );

    const maxEditableAmount =
      payment.paymentType === 'CAPITAL'
        ? revertedPrincipalBalance
        : payment.paymentType === 'INTEREST'
          ? revertedInterestBalance + revertedLateFeeBalance
          : revertedPrincipalBalance + revertedInterestBalance + revertedLateFeeBalance;

    if (newAmount > maxEditableAmount) {
      const currency = (payment as unknown as { currency?: string }).currency;
      throw new BadRequestException(
        `El nuevo monto no puede superar ${currency === 'USD' ? 'USD' : 'Gs.'} ${maxEditableAmount.toLocaleString('es-PY')}.`,
      );
    }

    const recalculated = applyPaymentByType(
      {
        principalBalance: payment.previousBalance || revertedPrincipalBalance,
        accruedInterestBalance: payment.interestDueAtPayment || revertedInterestBalance,
        accruedLateFeeBalance: payment.lateFeeDueAtPayment || revertedLateFeeBalance,
      },
      newAmount,
      payment.paymentType || 'MIXED',
    );

    const newPrincipalBalance = recalculated.resultingPrincipalBalance;
    const newInterestBalance = recalculated.resultingInterestBalance;
    const newLateFeeBalance = recalculated.resultingLateFeeBalance;
    const newStatus =
      newPrincipalBalance <= 0 && newInterestBalance <= 0 && newLateFeeBalance <= 0
        ? 'PAID'
        : loan.status === 'FROZEN'
          ? 'FROZEN'
          : 'ACTIVE';

    const session = await this.paymentModel.db.startSession();
    try {
      await session.withTransaction(async () => {
        await this.loanModel
          .updateOne(
            { _id: loan.id },
            {
              $set: {
                currentBalance: newPrincipalBalance,
                totalAmount: newPrincipalBalance + newInterestBalance + newLateFeeBalance,
                paidAmount: revertedPaidAmount + newAmount,
                interestPaidAmount:
                  revertedInterestPaid + recalculated.lateFeeApplied + recalculated.interestApplied,
                accruedInterestBalance: newInterestBalance,
                accruedLateFeeBalance: newLateFeeBalance,
                status: newStatus,
                updatedAt: now,
              },
            },
            { session },
          )
          .exec();
        await this.paymentModel
          .updateOne(
            { _id: paymentId, companyId },
            {
              $set: {
                amount: newAmount,
                newBalance: newPrincipalBalance,
                principalApplied: recalculated.principalApplied,
                interestApplied: recalculated.interestApplied,
                arrearsApplied: recalculated.lateFeeApplied,
                resultingInterestBalance: newInterestBalance,
                resultingLateFeeBalance: newLateFeeBalance,
                commissionAmount: Math.round(newAmount * 0.07),
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
      action: 'UPDATE_PAYMENT',
      entity: 'PAYMENT',
      entityId: paymentId,
      details: { loanId: payment.loanId, previousAmount: payment.amount, newAmount },
      actor,
    });
  }

  /** Elimina (anula) el ULTIMO abono aprobado de un credito, revirtiendo su impacto. */
  async deletePayment(
    companyId: string,
    paymentId: string,
    reason: string,
    actor: RequestUser,
  ): Promise<void> {
    const normalizedReason = reason.trim();
    if (!normalizedReason) throw new BadRequestException('La razon de anulacion es obligatoria.');
    const payment = await this.paymentModel.findOne({ _id: paymentId, companyId }).exec();
    if (!payment) throw new NotFoundException('El abono no existe.');
    const latestApproved = await this.getLatestApprovedForLoan(companyId, payment.loanId);
    const latestId = String(
      (latestApproved as unknown as { id?: string }).id ??
        (latestApproved as unknown as { _id?: string })._id ??
        '',
    );
    if (!latestApproved || latestId !== paymentId) {
      throw new BadRequestException('Solo se puede eliminar el ultimo abono aprobado de este credito.');
    }
    if (payment.approvalStatus !== 'APPROVED' || payment.estadoRendicion === 'anulado') {
      throw new BadRequestException('Solo se pueden eliminar abonos ya aprobados.');
    }
    const loan = await this.loanModel.findOne({ _id: payment.loanId, companyId }).exec();
    if (!loan) throw new NotFoundException('El credito asociado no existe.');
    const now = Date.now();

    const session = await this.paymentModel.db.startSession();
    try {
      await session.withTransaction(async () => {
        await this.loanModel
          .updateOne(
            { _id: loan.id },
            {
              $set: {
                currentBalance: (loan.currentBalance || 0) + (payment.principalApplied || 0),
                totalAmount:
                  (loan.currentBalance || 0) +
                  (payment.principalApplied || 0) +
                  (loan.accruedInterestBalance || 0) +
                  (payment.interestApplied || 0) +
                  (loan.accruedLateFeeBalance || 0) +
                  (payment.arrearsApplied || 0),
                paidAmount: Math.max(0, (loan.paidAmount || 0) - payment.amount),
                interestPaidAmount: Math.max(
                  0,
                  (loan.interestPaidAmount || 0) -
                    (payment.interestApplied || 0) -
                    (payment.arrearsApplied || 0),
                ),
                accruedInterestBalance:
                  (loan.accruedInterestBalance || 0) + (payment.interestApplied || 0),
                accruedLateFeeBalance:
                  (loan.accruedLateFeeBalance || 0) + (payment.arrearsApplied || 0),
                status: loan.status === 'FROZEN' ? 'FROZEN' : 'ACTIVE',
                updatedAt: now,
              },
            },
            { session },
          )
          .exec();
        await this.paymentModel
          .updateOne(
            { _id: paymentId, companyId },
            {
              $set: {
                approvalStatus: 'REJECTED',
                estadoRendicion: 'anulado',
                anuladoAt: now,
                anuladoBy: actor.uid,
                anulacionRazon: normalizedReason,
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
      action: 'ANNUL_PAYMENT',
      entity: 'PAYMENT',
      entityId: paymentId,
      details: { loanId: payment.loanId, amount: payment.amount, reason: normalizedReason },
      actor,
    });
  }
}