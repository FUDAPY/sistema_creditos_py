import { Schema } from 'mongoose';
import { randomUUID } from 'crypto';

/** Colección `clients`. strict:false para conservar campos migrados. */
export const ClientSchema = new Schema(
  {
    _id: { type: String, default: () => randomUUID() },
    companyId: { type: String, required: true, index: true },
    fullName: { type: String, required: true },
    fullNameLower: { type: String, index: true },
    documentId: { type: String },
    documentSearch: { type: String },
    collectorId: { type: String },
    collectorName: { type: String },
    birthDate: { type: String },
    nationality: { type: String },
    phone: { type: String },
    phoneSearch: { type: String },
    email: { type: String },
    address: { type: String },
    city: { type: String },
    neighborhood: { type: String },
    housingType: { type: String, default: 'PROPIA' },
    workplaceName: { type: String },
    workplaceAddress: { type: String },
    workplaceCity: { type: String },
    workplaceNeighborhood: { type: String },
    seniority: { type: String },
    employmentStatus: { type: String, default: 'EMPLEADO' },
    workPhone: { type: String },
    position: { type: String },
    department: { type: String },
    references: { type: Schema.Types.Mixed, default: [] },
    location: { type: Schema.Types.Mixed, default: {} },
    createdAt: { type: Number, default: () => Date.now() },
    updatedAt: { type: Number, default: () => Date.now() },
  },
  { collection: 'clients', strict: false, versionKey: false },
);

ClientSchema.index({ companyId: 1, documentSearch: 1 });
ClientSchema.index({ companyId: 1, phoneSearch: 1 });
ClientSchema.index({ companyId: 1, collectorId: 1 });
