import { Schema } from 'mongoose';
import { randomUUID } from 'crypto';

/**
 * Credito externo sincronizado a local (POS/Juridico).
 * Colección propia para no mezclarse con los `loans` nativos de créditos.
 * Clave de unicidad: (companyId, sistema, externalId).
 */
export const ExternalCreditSchema = new Schema(
  {
    _id: { type: String, default: () => randomUUID() },
    companyId: { type: String, required: true, index: true },
    sistema: { type: String, required: true, index: true }, // 'juridico' | 'pos'
    externalId: { type: String, required: true },
    clienteNombre: { type: String },
    cedula: { type: String },
    telefono: { type: String },
    direccion: { type: String },
    referencia: { type: String },
    referenciaDetalle: { type: String },
    concepto: { type: String },
    montoTotal: { type: Number },
    saldoPendiente: { type: Number },
    estado: { type: String },
    /** Fecha (ms) de la última actualización reportada por el sistema de origen. */
    updatedAtExterno: { type: Number },
    /** Fecha (ms) de esta sincronización local. */
    syncedAt: { type: Number, default: () => Date.now() },
  },
  { collection: 'externalCredits', strict: false, versionKey: false },
);

ExternalCreditSchema.index({ companyId: 1, sistema: 1, externalId: 1 }, { unique: true });
ExternalCreditSchema.index({ companyId: 1, sistema: 1, syncedAt: -1 });
