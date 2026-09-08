import { Schema } from 'mongoose';
import { randomUUID } from 'crypto';

/** Colección `auditLogs` (strict:false para conservar detalles migrados). */
export const AuditLogSchema = new Schema(
  {
    _id: { type: String, default: () => randomUUID() },
    companyId: { type: String, required: true, index: true },
    action: { type: String, required: true },
    entity: { type: String },
    entityId: { type: String },
    details: { type: Schema.Types.Mixed },
    userEmail: { type: String },
    createdBy: { type: String },
    createdAt: { type: Number, default: () => Date.now() },
    updatedAt: { type: Number, default: () => Date.now() },
  },
  { collection: 'auditLogs', strict: false, versionKey: false },
);

AuditLogSchema.index({ companyId: 1, createdAt: -1 });
