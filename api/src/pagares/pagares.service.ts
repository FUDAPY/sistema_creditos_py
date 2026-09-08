import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document } from 'mongoose';
import { randomUUID } from 'crypto';
import type { RequestUser } from '../common/types';

export interface PagareDoc extends Document {
  companyId: string;
  loanId?: string;
  nombre?: string;
  cedula?: string;
  monto?: number;
  tomo?: string;
  cobrador?: string;
  estado?: string;
  asignado?: boolean;
  entregadoAt?: number;
  entregadoBy?: string;
  entregadoByName?: string;
  createdAt?: number;
}

type PagareStatus = 'activo' | 'cancelado';

@Injectable()
export class PagaresService {
  constructor(@InjectModel('Pagare') private readonly pagareModel: Model<PagareDoc>) {}

  toPublic(doc: PagareDoc): Record<string, unknown> {
    const raw = doc.toObject({ virtuals: false }) as Record<string, unknown>;
    const estado = String(raw.estado ?? 'activo');
    return {
      ...raw,
      id: String(raw._id ?? doc.id ?? ''),
      // Normalizar estados antiguos a la maquina de estados actual.
      estado: estado === 'cancelado' || estado === 'ENTREGADO' ? 'cancelado' : 'activo',
      asignado: raw.asignado === undefined ? true : raw.asignado,
    };
  }

  async list(companyId: string): Promise<Record<string, unknown>[]> {
    const docs = await this.pagareModel.find({ companyId }).sort({ createdAt: -1 }).exec();
    return docs.map((d) => this.toPublic(d));
  }

  /** Crea una tanda de pagarés vacíos para un tomo (se asignan luego a creditos). */
  async createTomo(
    companyId: string,
    tomo: string,
    cantidad: number,
    createdBy: string,
  ): Promise<number> {
    const normalizedTomo = tomo.trim();
    if (!normalizedTomo || cantidad <= 0) return 0;
    const now = Date.now();
    const docs = Array.from({ length: cantidad }, () => {
      const id = randomUUID();
      return {
        _id: id,
        id,
        companyId,
        loanId: '',
        nombre: '',
        nombreLower: '',
        cedula: '',
        cedulaSearch: '',
        monto: 0,
        tomo: normalizedTomo,
        cobrador: '',
        estado: 'activo' as const,
        asignado: false,
        createdAt: now,
        updatedAt: now,
        createdBy,
      };
    });
    await this.pagareModel.insertMany(docs);
    return cantidad;
  }

  /** Busca un pagaré sin asignar dentro de un tomo (para reutilizarlo en un credito). */
  async findAvailableInTomo(
    companyId: string,
    tomo: string,
  ): Promise<Record<string, unknown> | null> {
    const normalizedTomo = String(tomo).trim();
    if (!normalizedTomo) return null;
    const doc = await this.pagareModel
      .findOne({ companyId, tomo: normalizedTomo, asignado: false })
      .sort({ createdAt: 1 })
      .exec();
    return doc ? this.toPublic(doc) : null;
  }

  async create(
    companyId: string,
    data: { loanId?: string; nombre: string; cedula: string; monto: number; tomo: string; cobrador?: string },
    createdBy: string,
  ): Promise<Record<string, unknown>> {
    const now = Date.now();
    const id = randomUUID();
    const doc = await this.pagareModel.create({
      _id: id,
      id,
      loanId: data.loanId || '',
      companyId,
      nombre: data.nombre.trim(),
      nombreLower: data.nombre.trim().toLowerCase(),
      cedula: data.cedula.trim(),
      cedulaSearch: data.cedula.trim().toLowerCase(),
      monto: data.monto,
      tomo: String(data.tomo).trim(),
      cobrador: data.cobrador || '',
      estado: 'activo',
      createdAt: now,
      updatedAt: now,
      createdBy,
    });
    return this.toPublic(doc);
  }

  async toggleStatus(
    companyId: string,
    pagareId: string,
    newStatus: PagareStatus,
    actor: RequestUser,
  ): Promise<void> {
    const now = Date.now();
    let res;
    if (newStatus === 'cancelado') {
      res = await this.pagareModel
        .updateOne(
          { _id: pagareId, companyId },
          {
            $set: {
              estado: newStatus,
              entregadoAt: now,
              entregadoBy: actor.uid,
              entregadoByName: actor.name,
              updatedAt: now,
            },
          },
        )
        .exec();
    } else {
      res = await this.pagareModel
        .updateOne(
          { _id: pagareId, companyId },
          {
            $set: { estado: newStatus, updatedAt: now },
            $unset: { entregadoAt: '', entregadoBy: '', entregadoByName: '' },
          },
        )
        .exec();
    }
    if (res.matchedCount === 0) throw new NotFoundException('Pagaré no encontrado.');
  }

  /** Importa pagarés desde CSV. Cabecera: nombre,cedula,monto,tomo,estado,cobrador. */
  async importFromCsv(
    companyId: string,
    csvText: string,
    createdBy: string,
  ): Promise<{ importedCount: number; errorsCount: number }> {
    const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length <= 1) return { importedCount: 0, errorsCount: 0 };

    const rows = lines.slice(1);
    const now = Date.now();
    const docs: Array<Record<string, unknown>> = [];
    let errors = 0;

    for (const row of rows) {
      const columns = row.split(',').map((item) => item.trim().replace(/^"|"$/g, ''));
      if (columns.length < 4) {
        errors++;
        continue;
      }
      const [nombre, cedula, montoStr, tomo, estadoRaw, cobrador] = columns;
      const monto = parseFloat(montoStr);
      if (!nombre || !cedula || Number.isNaN(monto) || !tomo) {
        errors++;
        continue;
      }
      const estado: PagareStatus = estadoRaw?.toLowerCase() === 'cancelado' ? 'cancelado' : 'activo';
      const id = randomUUID();
      docs.push({
        _id: id,
        id,
        companyId,
        nombre: nombre.trim(),
        nombreLower: nombre.trim().toLowerCase(),
        cedula: cedula.trim(),
        cedulaSearch: cedula.trim().toLowerCase(),
        monto,
        tomo: tomo.trim(),
        cobrador: cobrador || '',
        estado,
        asignado: false,
        createdAt: now,
        updatedAt: now,
        createdBy,
      });
    }

    if (docs.length > 0) await this.pagareModel.insertMany(docs);
    return { importedCount: docs.length, errorsCount: errors };
  }
}
