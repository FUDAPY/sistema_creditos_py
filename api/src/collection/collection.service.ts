import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document } from 'mongoose';
import { AuditService } from '../audit/audit.service';
import type { RequestUser } from '../common/types';

export interface CollectionManagementDoc extends Document {
  companyId: string;
  loanId: string;
  clientId?: string;
  collectorId?: string;
  collectorName?: string;
  dueDate?: number;
  status?: string;
  managedAt?: number;
  contactedAt?: number;
}

export interface PaymentDayLockDoc extends Document {
  companyId: string;
  collectorId?: string;
  dateDay?: number;
  locked?: boolean;
  reason?: string;
  lockedBy?: string;
  lockedByName?: string;
}

export interface LoanDoc extends Document {
  companyId: string;
  clientId: string;
  collectorId?: string;
  collectorName?: string;
  nextDueDate?: number;
  expiresAt?: number;
}

const startOfDay = (timestamp: number) => {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

export const getCollectionManagementId = (loanId: string, dueDate: number) =>
  `${loanId}_${startOfDay(dueDate)}`;

@Injectable()
export class CollectionService {
  constructor(
    @InjectModel('CollectionManagement')
    private readonly managementModel: Model<CollectionManagementDoc>,
    @InjectModel('Loan') private readonly loanModel: Model<LoanDoc>,
    @InjectModel('PaymentDayLock') private readonly lockModel: Model<PaymentDayLockDoc>,
    private readonly audit: AuditService,
  ) {}

  toPublic(doc: CollectionManagementDoc): Record<string, unknown> {
    const raw = doc.toObject({ virtuals: false }) as Record<string, unknown>;
    return { ...raw, id: String(raw._id ?? doc.id ?? '') };
  }

  async list(
    companyId: string,
    collectorId?: string,
  ): Promise<Record<string, unknown>[]> {
    const query: Record<string, unknown> = { companyId };
    if (collectorId) query.collectorId = collectorId;
    const docs = await this.managementModel.find(query).sort({ dueDate: 1 }).exec();
    return docs.map((d) => this.toPublic(d));
  }

  private async requireLoan(companyId: string, loanId: string): Promise<LoanDoc> {
    const loan = await this.loanModel.findOne({ _id: loanId, companyId }).exec();
    if (!loan) throw new NotFoundException('Credito no encontrado.');
    return loan;
  }

  /** Marca la gestion del dia como gestionada (se contactó/visitó al cliente). */
  async markManaged(companyId: string, loanId: string, actor: RequestUser): Promise<void> {
    const loan = await this.requireLoan(companyId, loanId);
    const loanAny = loan as unknown as { id?: string; _id?: string };
    const resolvedLoanId = String(loanAny.id ?? loanAny._id ?? loanId);
    const dueDate = startOfDay(loan.nextDueDate || loan.expiresAt || Date.now());
    const id = getCollectionManagementId(resolvedLoanId, dueDate);
    const now = Date.now();

    await this.managementModel.updateOne(
      { _id: id },
      {
        $set: {
          _id: id,
          companyId,
          loanId: resolvedLoanId,
          clientId: loan.clientId,
          collectorId: loan.collectorId || actor.uid,
          collectorName: loan.collectorName || actor.name,
          dueDate,
          status: 'MANAGED',
          managedAt: now,
          managedBy: actor.uid,
          managedByName: actor.name,
          updatedAt: now,
          createdBy: actor.uid,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );

    await this.audit.log({
      action: 'MARK_COLLECTION_MANAGED',
      entity: 'COLLECTION_MANAGEMENT',
      entityId: id,
      details: { loanId: resolvedLoanId, dueDate },
      actor,
    });
  }

  /** Registra el intento de contacto (gestion de cobranza). */
  async markContacted(companyId: string, loanId: string, actor: RequestUser): Promise<void> {
    const loan = await this.requireLoan(companyId, loanId);
    const loanAny = loan as unknown as { id?: string; _id?: string };
    const resolvedLoanId = String(loanAny.id ?? loanAny._id ?? loanId);
    const dueDate = startOfDay(loan.nextDueDate || loan.expiresAt || Date.now());
    const id = getCollectionManagementId(resolvedLoanId, dueDate);
    const now = Date.now();

    await this.managementModel.updateOne(
      { _id: id },
      {
        $set: {
          _id: id,
          companyId,
          loanId: resolvedLoanId,
          clientId: loan.clientId,
          collectorId: loan.collectorId || actor.uid,
          collectorName: loan.collectorName || actor.name,
          dueDate,
          contactedAt: now,
          contactedBy: actor.uid,
          contactedByName: actor.name,
          updatedAt: now,
          createdBy: actor.uid,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );

    await this.audit.log({
      action: 'MARK_COLLECTION_CONTACTED',
      entity: 'COLLECTION_MANAGEMENT',
      entityId: id,
      details: { loanId: resolvedLoanId, dueDate },
      actor,
    });
  }

  /**
   * Gestión diaria: créditos vencen/hoy + estado de su gestion de cobranza
   * y si el día está bloqueado para el cobrador (paymentDayLocks).
   */
  async dailySummary(
    companyId: string,
    date?: number,
    collectorId?: string,
  ): Promise<Record<string, unknown>[]> {
    const now = Date.now();
    const dayStart = startOfDay(date || now);
    const nextDayStart = dayStart + 86400000;
    const base: Record<string, unknown> = {
      companyId,
      approvalStatus: 'APPROVED',
      status: 'ACTIVE',
      $or: [
        { nextDueDate: { $gte: dayStart, $lt: nextDayStart } },
        { expiresAt: { $gte: dayStart, $lt: nextDayStart } },
      ],
    };
    if (collectorId) base.collectorId = collectorId;

    const loans = await this.loanModel.find(base).exec();
    const ids = loans.map((l) =>
      String(((l as unknown as { id?: string }).id ?? (l as unknown as { _id?: string })._id) ?? ''),
    );
    const [managements, locks] = await Promise.all([
      this.managementModel
        .find({
          companyId,
          dueDate: { $gte: dayStart, $lt: nextDayStart },
          loanId: { $in: ids },
        })
        .exec(),
      this.lockModel.find({ companyId, dateDay: dayStart }).exec(),
    ]);

    const mgmtByLoan = new Map<string, CollectionManagementDoc>();
    managements.forEach((m) => {
      if (m.loanId) mgmtByLoan.set(m.loanId, m);
    });
    const lockMap = new Map<string, PaymentDayLockDoc>();
    locks.forEach((l) => lockMap.set(l.collectorId || '', l));

    return loans.map((loan) => {
      const loanAny = loan as unknown as { id?: string; _id?: string; clientName?: string; collectorName?: string };
      const loanId = String(loanAny.id ?? loanAny._id ?? '');
      const mgmt = mgmtByLoan.get(loanId);
      const lock = lockMap.get(loan.collectorId || '') || lockMap.get('');
      const mgmtDoc = mgmt?.toObject ? (mgmt.toObject({ virtuals: false }) as Record<string, unknown>) : {};
      const lockDoc = lock?.toObject ? (lock.toObject({ virtuals: false }) as Record<string, unknown>) : {};
      return {
        loanId,
        clientId: loan.clientId,
        clientName: loanAny.clientName || '',
        collectorName: loanAny.collectorName || loan.collectorName || '',
        nextDueDate: loan.nextDueDate,
        expiresAt: loan.expiresAt,
        management: mgmt
          ? {
              status: mgmt.status,
              managed: Boolean(mgmt.managedAt),
              contacted: Boolean(mgmt.contactedAt),
              id: mgmtDoc.id ?? (mgmtDoc._id as string) ?? '',
            }
          : null,
        dayLocked: lock ? lockDoc.locked !== false : false,
        lock: lock ? { id: lockDoc.id ?? (lockDoc._id as string) ?? '', reason: lock.reason, collectorId: lock.collectorId } : null,
      };
    });
  }

  async listLocks(
    companyId: string,
    filters: { dateDay?: number; collectorId?: string } = {},
  ): Promise<Record<string, unknown>[]> {
    const query: Record<string, unknown> = { companyId };
    if (filters.dateDay !== undefined) query.dateDay = startOfDay(filters.dateDay);
    if (filters.collectorId) query.collectorId = filters.collectorId;
    const docs = await this.lockModel.find(query).sort({ dateDay: 1 }).exec();
    return docs.map((d) => {
      const raw = (d.toObject({ virtuals: false }) as unknown as Record<string, unknown>) ?? {};
      return { ...raw, id: String(raw._id ?? '') };
    });
  }

  async lockDay(
    companyId: string,
    dateDay: number,
    collectorId: string | undefined,
    reason: string,
    actor: RequestUser,
  ): Promise<void> {
    const day = startOfDay(dateDay);
    const collector = collectorId?.trim() || '';
    const now = Date.now();
    await this.lockModel.updateOne(
      { companyId, collectorId: collector, dateDay: day },
      {
        $set: {
          companyId,
          collectorId: collector,
          dateDay: day,
          locked: true,
          reason: reason.trim() || '',
          lockedBy: actor.uid,
          lockedByName: actor.name,
          unlockedAt: null,
          unlockedBy: '',
          updatedAt: now,
          createdBy: actor.uid,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
    await this.audit.log({
      action: 'LOCK_PAYMENT_DAY',
      entity: 'PAYMENT_DAY_LOCK',
      details: { dateDay: day, collectorId: collector, reason: reason.trim() || '' },
      actor,
    });
  }

  async unlockDay(
    companyId: string,
    dateDay: number,
    collectorId: string | undefined,
    actor: RequestUser,
  ): Promise<void> {
    const day = startOfDay(dateDay);
    const collector = collectorId?.trim() || '';
    const now = Date.now();
    await this.lockModel.updateOne(
      { companyId, collectorId: collector, dateDay: day },
      {
        $set: { locked: false, unlockedAt: now, unlockedBy: actor.uid, updatedAt: now },
      },
      { upsert: false },
    );
    await this.audit.log({
      action: 'UNLOCK_PAYMENT_DAY',
      entity: 'PAYMENT_DAY_LOCK',
      details: { dateDay: day, collectorId: collector },
      actor,
    });
  }
}
