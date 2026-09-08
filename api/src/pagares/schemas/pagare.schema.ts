import { Schema } from 'mongoose';
import { randomUUID } from 'crypto';

/** Colección `pagares`. strict:false para conservar campos migrados. */
export const PagareSchema = new Schema(
  {
    _id: { type: String, default: () => randomUUID() },
    companyId: { type: String, required: true, index: true },
    loanId: { type: String, default: '', index: true },
    nombre: { type: String, default: '' },
    nombreLower: { type: String },
    cedula: { type: String, default: '' },
    cedulaSearch: { type: String },
    monto: { type: Number, default: 0 },
    tomo: { type: String, default: '' },
    cobrador: { type: String, default: '' },
    estado: { type: String, default: 'activo' },
    asignado: { type: Boolean, default: false },
    entregadoAt: { type: Number },
    entregadoBy: { type: String },
    entregadoByName: { type: String },
    createdAt: { type: Number, default: () => Date.now() },
    updatedAt: { type: Number, default: () => Date.now() },
  },
  { collection: 'pagares', strict: false, versionKey: false },
);

PagareSchema.index({ companyId: 1, tomo: 1, asignado: 1 });
