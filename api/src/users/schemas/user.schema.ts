import { Schema } from 'mongoose';
import { randomUUID } from 'crypto';
import type { Role } from '@syscreditos/shared';

/**
 * Colección `users` (flat, scoped por companyId).
 * - _id: string (id Firestore original al migrar; uuid al crear nuevos).
 * - uid: alias de identidad (compat con el sistema legacy).
 * - strict:false => se conservan campos extra de documentos migrados sin schema.
 */
export const UserSchema = new Schema(
  {
    _id: { type: String, default: () => randomUUID() },
    uid: { type: String, required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, required: true },
    role: { type: String, enum: ['ADMIN', 'COLLECTOR'], required: true },
    isActive: { type: Boolean, default: true },
    companyId: { type: String, required: true, index: true },
    passwordHash: { type: String, select: false },
    createdAt: { type: Number, default: () => Date.now() },
    updatedAt: { type: Number, default: () => Date.now() },
  },
  { collection: 'users', strict: false, versionKey: false },
);

UserSchema.index({ companyId: 1, email: 1 }, { unique: true });

export type UserRole = Role;
