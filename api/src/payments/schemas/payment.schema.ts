import { Schema } from 'mongoose';
import { randomUUID } from 'crypto';

/** Colección `payments`. strict:false para conservar campos migrados. */
export const PaymentSchema = new Schema(
  {
    _id: { type: String, default: () => randomUUID() },
    companyId: { type: String, required: true, index: true },
    loanId: { type: String, required: true, index: true },
    clientId: { type: String, index: true },
    clientName: { type: String },
    clientNameLower: { type: String },
    clientDocumentId: { type: String },
    collectorId: { type: String, index: true },
    collectorName: { type: String },
    paymentType: { type: String, default: 'MIXED' },
    currency: { type: String, default: 'PYG' },
    paidAt: { type: Number },
    amount: { type: Number, required: true },
    previousBalance: { type: Number },
    newBalance: { type: Number },
    principalApplied: { type: Number },
    interestApplied: { type: Number },
    interestDueAtPayment: { type: Number },
    lateFeeDueAtPayment: { type: Number },
    arrearsApplied: { type: Number, default: 0 },
    resultingInterestBalance: { type: Number },
    resultingLateFeeBalance: { type: Number },
    nextDueDateAfterPayment: { type: Number },
    lastAccruedAtAfterPayment: { type: Number },
    commissionAmount: { type: Number, default: 0 },
    approvalStatus: { type: String, default: 'PENDING', index: true },
    estadoRendicion: { type: String, default: 'pendiente_rendicion' },
    loanImpactApplied: { type: Boolean, default: false },
    anuladoAt: { type: Number },
    anuladoBy: { type: String },
    anulacionRazon: { type: String },
    approvedAt: { type: Number },
    approvedBy: { type: String },
    approvedByName: { type: String },
    createdAt: { type: Number, default: () => Date.now() },
    updatedAt: { type: Number, default: () => Date.now() },
  },
  { collection: 'payments', strict: false, versionKey: false },
);

PaymentSchema.index({ companyId: 1, loanId: 1, createdAt: -1 });
PaymentSchema.index({ companyId: 1, approvalStatus: 1, createdAt: 1 });
