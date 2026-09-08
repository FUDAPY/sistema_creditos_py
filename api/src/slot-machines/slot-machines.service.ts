import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document } from 'mongoose';
import { randomUUID } from 'crypto';
import type { Role } from '@syscreditos/shared';
import { AuditService } from '../audit/audit.service';
import type { RequestUser } from '../common/types';

export interface SlotSiteDoc extends Document {
  companyId: string;
  name?: string;
  locationName?: string;
  address?: string;
  collectorId?: string;
  collectorName?: string;
  commissionRate?: number;
  isActive?: boolean;
}

export interface SlotEntryDoc extends Document {
  companyId: string;
  siteId?: string;
  siteName?: string;
  locationName?: string;
  collectorId?: string;
  collectorName?: string;
  collectionDate?: number;
  amount?: number;
  commissionRate?: number;
  commissionAmount?: number;
  approvalStatus?: string;
  notes?: string;
}

const DEFAULT_COMMISSION_RATE = 10;

@Injectable()
export class SlotMachinesService {
  constructor(
    @InjectModel('SlotMachineSite') private readonly siteModel: Model<SlotSiteDoc>,
    @InjectModel('SlotMachineEntry') private readonly entryModel: Model<SlotEntryDoc>,
    private readonly audit: AuditService,
  ) {}

  toPublic(doc: Document): Record<string, unknown> {
    const raw = (doc.toObject({ virtuals: false }) as Record<string, unknown>) ?? {};
    return { ...raw, id: String(raw._id ?? (doc as unknown as { id?: string }).id ?? '') };
  }

  async listSites(
    companyId: string,
    role: Role,
    userId: string,
  ): Promise<Record<string, unknown>[]> {
    const query: Record<string, unknown> = { companyId };
    if (role !== 'ADMIN') query.collectorId = userId;
    const docs = await this.siteModel.find(query).exec();
    return docs
      .map((d) => this.toPublic(d))
      .sort((a, b) =>
        String(a.locationName || '').localeCompare(String(b.locationName || ''), 'es'),
      );
  }

  async createSite(
    companyId: string,
    data: {
      name: string;
      locationName: string;
      address?: string;
      collectorId: string;
      collectorName: string;
    },
    actor: RequestUser,
  ): Promise<Record<string, unknown>> {
    const now = Date.now();
    const id = randomUUID();
    const doc = await this.siteModel.create({
      _id: id,
      id,
      companyId,
      name: data.name.trim(),
      locationName: data.locationName.trim(),
      address: data.address?.trim() || '',
      collectorId: data.collectorId,
      collectorName: data.collectorName,
      commissionRate: DEFAULT_COMMISSION_RATE,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      createdBy: actor.uid,
    });
    await this.audit.log({
      action: 'CREATE_SLOT_MACHINE_SITE',
      entity: 'SLOT_MACHINE_SITE',
      entityId: id,
      details: { name: data.name.trim(), locationName: data.locationName.trim() },
      actor,
    });
    return this.toPublic(doc);
  }

  async listEntries(
    companyId: string,
    role: Role,
    userId: string,
  ): Promise<Record<string, unknown>[]> {
    const query: Record<string, unknown> = { companyId };
    if (role !== 'ADMIN') query.collectorId = userId;
    const docs = await this.entryModel.find(query).sort({ collectionDate: -1 }).exec();
    return docs.map((d) => this.toPublic(d));
  }

  async listEntriesForApproval(
    companyId: string,
    role: Role,
    userId: string,
    options: {
      approvalStatus?: string;
      collectorId?: string;
      dateFrom?: number;
      dateTo?: number;
      maxResults?: number;
    } = {},
  ): Promise<Record<string, unknown>[]> {
    const query: Record<string, unknown> = { companyId };
    if (role !== 'ADMIN') query.collectorId = userId;
    else if (options.collectorId) query.collectorId = options.collectorId;
    if (options.approvalStatus) query.approvalStatus = options.approvalStatus;
    if (options.dateFrom !== undefined || options.dateTo !== undefined) {
      const range: Record<string, unknown> = {};
      if (options.dateFrom !== undefined) range.$gte = options.dateFrom;
      if (options.dateTo !== undefined) range.$lte = options.dateTo;
      query.collectionDate = range;
    }
    const docs = await this.entryModel
      .find(query)
      .sort({ collectionDate: -1 })
      .limit(Math.min(options.maxResults || 150, 500))
      .exec();
    return docs.map((d) => this.toPublic(d));
  }

  async createEntry(
    companyId: string,
    data: {
      siteId: string;
      siteName: string;
      locationName: string;
      collectorId: string;
      collectorName: string;
      collectionDate: number;
      amount: number;
      commissionRate?: number;
      notes?: string;
    },
    actor: RequestUser,
  ): Promise<Record<string, unknown>> {
    const now = Date.now();
    const amount = Math.max(0, Math.round(data.amount));
    const commissionRate = Number.isFinite(data.commissionRate)
      ? (data.commissionRate as number)
      : DEFAULT_COMMISSION_RATE;
    const id = randomUUID();
    const doc = await this.entryModel.create({
      _id: id,
      id,
      companyId,
      siteId: data.siteId,
      siteName: data.siteName,
      locationName: data.locationName,
      collectorId: data.collectorId,
      collectorName: data.collectorName,
      collectionDate: data.collectionDate,
      amount,
      commissionRate,
      commissionAmount: Math.round(amount * (commissionRate / 100)),
      approvalStatus: 'PENDING',
      notes: data.notes?.trim() || '',
      createdAt: now,
      updatedAt: now,
      createdBy: actor.uid,
    });
    return this.toPublic(doc);
  }

  async approveEntry(
    companyId: string,
    entryId: string,
    actor: RequestUser,
  ): Promise<void> {
    const entry = await this.entryModel.findOne({ _id: entryId, companyId }).exec();
    if (!entry) throw new NotFoundException('La recaudacion de tragamonedas no existe.');
    if (entry.approvalStatus === 'APPROVED') return;
    const now = Date.now();
    await this.entryModel
      .updateOne(
        { _id: entryId, companyId },
        {
          $set: {
            approvalStatus: 'APPROVED',
            approvedAt: now,
            approvedBy: actor.uid,
            approvedByName: actor.name,
            updatedAt: now,
          },
        },
      )
      .exec();
    await this.audit.log({
      action: 'APPROVE_SLOT_MACHINE_SETTLEMENT',
      entity: 'SLOT_MACHINE_ENTRY',
      entityId: entryId,
      details: { siteId: entry.siteId, amount: entry.amount, commissionAmount: entry.commissionAmount },
      actor,
    });
  }

  /** Elimina una recaudacion (no aprobada) o la revierte, dejando auditoria. */
  async unapproveEntry(
    companyId: string,
    entryId: string,
    actor: RequestUser,
    reason = '',
  ): Promise<void> {
    const entry = await this.entryModel.findOne({ _id: entryId, companyId }).exec();
    if (!entry) throw new NotFoundException('La recaudacion de tragamonedas no existe.');
    await this.entryModel.deleteOne({ _id: entryId, companyId }).exec();
    await this.audit.log({
      action: 'DELETE_UNAPPROVED_SLOT_MACHINE_SETTLEMENT',
      entity: 'SLOT_MACHINE_ENTRY',
      entityId: entryId,
      details: {
        siteId: entry.siteId,
        amount: entry.amount,
        commissionAmount: entry.commissionAmount,
        reason,
      },
      actor,
    });
  }
}
