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

export interface LoanStatusDoc extends Document {
  companyId: string;
  status?: string;
}

@Injectable()
export class PagaresService {
  constructor(
    @InjectModel('Pagare') private readonly pagareModel: Model<PagareDoc>,
    @InjectModel('Loan') private readonly loanModel: Model<LoanStatusDoc>,
  ) {}

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
    const rows = docs.map((d) => this.toPublic(d));
    return this.applyLoanStatus(companyId, rows);
  }

  /**
   * Ajusta el estado EXACTO de cada pagaré según su crédito asociado (sin tocar la base):
   *  - crédito PAID            -> pagaré CANCELADO
   *  - crédito ANULADO/borrado -> pagaré LIBERADO (vuelve a estar disponible)
   */
  private async applyLoanStatus(
    companyId: string,
    rows: Array<Record<string, unknown>>,
  ): Promise<Array<Record<string, unknown>>> {
    const loanIds = Array.from(
      new Set(rows.map((r) => String(r.loanId || '')).filter((id) => id.length > 0)),
    );
    if (loanIds.length === 0) return rows;

    const loans = await this.loanModel
      .find({ companyId, _id: { $in: loanIds } })
      .select('status')
      .lean()
      .exec();
    const statusById = new Map<string, string>(
      loans.map((l): [string, string] => [
        String((l as unknown as { _id: string })._id),
        String((l as unknown as { status?: string }).status || ''),
      ]),
    );

    for (const row of rows) {
      const loanId = String(row.loanId || '');
      if (!loanId) continue;
      const status = statusById.get(loanId);
      if (status === 'PAID') {
        row.estado = 'cancelado';
        row.canceladoPorCredito = true;
      } else if (!status || status === 'ANULADO') {
        row.estado = 'activo';
        row.asignado = false;
        row.loanId = '';
        row.liberado = true;
      }
    }
    return rows;
  }

  /** Conteos exactos para el módulo de pagarés. */
  async resumen(companyId: string): Promise<{
    total: number;
    activos: number;
    cancelados: number;
    disponibles: number;
    asignados: number;
    porTomo: Array<{ tomo: string; total: number; activos: number; cancelados: number; disponibles: number }>;
  }> {
    const rows = await this.list(companyId);
    const byTomo = new Map<string, { total: number; activos: number; cancelados: number; disponibles: number }>();
    let activos = 0;
    let cancelados = 0;
    let disponibles = 0;
    let asignados = 0;

    for (const r of rows) {
      const estado = String(r.estado || 'activo');
      const asignado = Boolean(r.asignado);
      const tomo = String(r.tomo || 'sin tomo');
      if (estado === 'cancelado') cancelados += 1;
      else activos += 1;
      if (asignado) asignados += 1;
      if (estado === 'activo' && !asignado) disponibles += 1;

      const agg = byTomo.get(tomo) ?? { total: 0, activos: 0, cancelados: 0, disponibles: 0 };
      agg.total += 1;
      if (estado === 'cancelado') agg.cancelados += 1;
      else agg.activos += 1;
      if (estado === 'activo' && !asignado) agg.disponibles += 1;
      byTomo.set(tomo, agg);
    }

    return {
      total: rows.length,
      activos,
      cancelados,
      disponibles,
      asignados,
      porTomo: Array.from(byTomo.entries())
        .map(([tomo, v]) => ({ tomo, ...v }))
        .sort((a, b) => a.tomo.localeCompare(b.tomo, 'es')),
    };
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
