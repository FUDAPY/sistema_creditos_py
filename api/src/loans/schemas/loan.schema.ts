import { Schema } from 'mongoose';
import { randomUUID } from 'crypto';

/** Colección `loans`. strict:false porque los docs migrados tienen muchos campos dinamicos. */
export const LoanSchema = new Schema(
  {
    _id: { type: String, default: () => randomUUID() },
    companyId: { type: String, required: true, index: true },
    clientId: { type: String, required: true, index: true },
    clientName: { type: String },
    clientNameLower: { type: String },
    clientDocumentId: { type: String },
    clientPhone: { type: String },
    clientAddress: { type: String },
    collectorId: { type: String, index: true },
    collectorName: { type: String },
    principal: { type: Number, default: 0 },
    currency: { type: String, default: 'PYG' },
    interestRate: { type: Number, default: 0 },
    loanType: { type: String },
    totalAmount: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
    currentBalance: { type: Number, default: 0 },
    status: { type: String, default: 'ACTIVE', index: true },
    approvalStatus: { type: String, index: true },
    grantedAt: { type: Number },
    expiresAt: { type: Number },
    commissionRate: { type: Number, default: 0 },
    createdAt: { type: Number, default: () => Date.now() },
    updatedAt: { type: Number, default: () => Date.now() },
  },
  { collection: 'loans', strict: false, versionKey: false },
);

LoanSchema.index({ companyId: 1, clientId: 1 });
LoanSchema.index({ companyId: 1, collectorId: 1, status: 1 });
LoanSchema.index({ companyId: 1, status: 1, approvalStatus: 1 });
