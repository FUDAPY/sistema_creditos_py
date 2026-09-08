import { Schema } from 'mongoose';
import { randomUUID } from 'crypto';

/** Colección `collectionManagements`. strict:false conserva campos migrados. */
export const CollectionManagementSchema = new Schema(
  {
    _id: { type: String, default: () => randomUUID() },
    companyId: { type: String, required: true, index: true },
    loanId: { type: String, required: true, index: true },
    clientId: { type: String, default: '' },
    collectorId: { type: String, index: true },
    collectorName: { type: String },
    dueDate: { type: Number, index: true },
    status: { type: String, default: 'PENDING' },
    managedAt: { type: Number },
    managedBy: { type: String },
    managedByName: { type: String },
    contactedAt: { type: Number },
    contactedBy: { type: String },
    contactedByName: { type: String },
    createdAt: { type: Number, default: () => Date.now() },
    updatedAt: { type: Number, default: () => Date.now() },
  },
  { collection: 'collectionManagements', strict: false, versionKey: false },
);

CollectionManagementSchema.index({ companyId: 1, dueDate: 1, collectorId: 1 });
