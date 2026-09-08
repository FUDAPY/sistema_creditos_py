import { Schema } from 'mongoose';
import { randomUUID } from 'crypto';

export const SlotMachineSiteSchema = new Schema(
  {
    _id: { type: String, default: () => randomUUID() },
    companyId: { type: String, required: true, index: true },
    name: { type: String, default: '' },
    locationName: { type: String, default: '' },
    address: { type: String, default: '' },
    collectorId: { type: String, index: true },
    collectorName: { type: String },
    commissionRate: { type: Number, default: 10 },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Number, default: () => Date.now() },
    updatedAt: { type: Number, default: () => Date.now() },
  },
  { collection: 'slotMachineSites', strict: false, versionKey: false },
);
SlotMachineSiteSchema.index({ companyId: 1, collectorId: 1, isActive: 1 });

export const SlotMachineEntrySchema = new Schema(
  {
    _id: { type: String, default: () => randomUUID() },
    companyId: { type: String, required: true, index: true },
    siteId: { type: String, index: true },
    siteName: { type: String, default: '' },
    locationName: { type: String, default: '' },
    collectorId: { type: String, index: true },
    collectorName: { type: String },
    collectionDate: { type: Number, index: true },
    amount: { type: Number, default: 0 },
    commissionRate: { type: Number, default: 10 },
    commissionAmount: { type: Number, default: 0 },
    approvalStatus: { type: String, default: 'PENDING', index: true },
    approvedAt: { type: Number },
    approvedBy: { type: String },
    approvedByName: { type: String },
    notes: { type: String, default: '' },
    createdAt: { type: Number, default: () => Date.now() },
    updatedAt: { type: Number, default: () => Date.now() },
  },
  { collection: 'slotMachineEntries', strict: false, versionKey: false },
);
SlotMachineEntrySchema.index({ companyId: 1, collectionDate: 1, approvalStatus: 1 });
