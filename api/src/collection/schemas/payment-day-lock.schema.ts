import { Schema } from 'mongoose';
import { randomUUID } from 'crypto';

/**
 * Colección `paymentDayLocks`: bloquea el cobro de un día para un cobrador
 * (o para la empresa si collectorId = ''). dateDay = inicio del día (ms local).
 */
export const PaymentDayLockSchema = new Schema(
  {
    _id: { type: String, default: () => randomUUID() },
    companyId: { type: String, required: true, index: true },
    collectorId: { type: String, default: '' },
    dateDay: { type: Number, required: true },
    locked: { type: Boolean, default: true },
    reason: { type: String, default: '' },
    lockedBy: { type: String },
    lockedByName: { type: String },
    unlockedAt: { type: Number },
    unlockedBy: { type: String },
    createdAt: { type: Number, default: () => Date.now() },
    updatedAt: { type: Number, default: () => Date.now() },
  },
  { collection: 'paymentDayLocks', strict: false, versionKey: false },
);

PaymentDayLockSchema.index({ companyId: 1, collectorId: 1, dateDay: 1 }, { unique: true });
