import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document } from 'mongoose';
import type { RequestUser } from '../common/types';

interface AuditLogInput {
  action: string;
  entity: string;
  entityId?: string;
  details?: unknown;
  actor?: RequestUser;
  companyId?: string;
}

export interface AuditDoc extends Document {
  companyId: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: unknown;
  userEmail?: string;
  createdBy?: string;
  createdAt?: number;
}

@Injectable()
export class AuditService {
  constructor(@InjectModel('AuditLog') private readonly model: Model<AuditDoc>) {}

  async log(input: AuditLogInput): Promise<void> {
    const now = Date.now();
    await this.model.create({
      companyId: input.companyId ?? input.actor?.companyId ?? 'lin_group_sa_001',
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      details: input.details,
      userEmail: input.actor?.email,
      createdBy: input.actor?.uid ?? 'SYSTEM',
      createdAt: now,
      updatedAt: now,
    });
  }
}
