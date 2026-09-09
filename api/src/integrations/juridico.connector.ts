import mongoose from 'mongoose';

/**
 * Conector SOLO-LECTURA hacia la MongoDB del sistema juridico ("lin-group-central").
 * La base remota expone colecciones propias: clientes, expedientes y creditos.
 * Este adaptador une las tres y devuelve la vista plana "clientes con creditos".
 * No escribe nada en la base remota.
 */

export interface JuridicoCliente {
  _id: string;
  nombreCompleto?: string;
  cedula?: string;
  telefono?: string;
  direccion?: string;
  email?: string;
}

export interface JuridicoExpediente {
  _id: string;
  caratula?: string;
  cliente?: string;
  abogadoAsignado?: string;
  fuero?: string;
  juzgado?: string;
  estado?: string;
  descripcion?: string;
  updatedAt?: number;
}

export interface JuridicoCreditoRaw {
  _id: string;
  cliente?: string | null;
  expediente?: string | null;
  clienteNombre?: string;
  concepto?: string;
  montoTotal?: number;
  saldoPendiente?: number;
  updatedAt?: number;
}

export interface JuridicoCreditoView {
  id: string;
  sistema: 'juridico';
  clienteNombre: string;
  cedula?: string;
  telefono?: string;
  direccion?: string;
  clienteJuridicoId?: string;
  expedienteJuridicoId?: string;
  caratula?: string;
  juzgado?: string;
  fuero?: string;
  estadoExpediente?: string;
  descripcion?: string;
  concepto?: string;
  montoTotal: number;
  saldoPendiente: number;
  updatedAt?: number;
}

type AnyDoc = Record<string, unknown>;

function idOf(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v === 'string') return v;
  if (typeof (v as { toString?: unknown }).toString === 'function') {
    const s = String(v);
    return s && s !== '[object Object]' ? s : undefined;
  }
  return undefined;
}

function numOf(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function dateMs(v: unknown): number | undefined {
  if (v instanceof Date) return v.getTime();
  const n = numOf(v);
  return n > 0 ? n : undefined;
}

const asArray = (docs: AnyDoc[]): AnyDoc[] => docs;

export async function fetchJuridicoCreditos(uri: string, dbName: string): Promise<JuridicoCreditoView[]> {
  const conn = await mongoose.createConnection(uri, {
    dbName,
    serverSelectionTimeoutMS: 8000,
    connectTimeoutMS: 8000,
  }).asPromise();
  try {
    const db = conn.db;
    if (!db) throw new Error('No se pudo acceder a la base remota del sistema juridico.');

    const [clientesDocs, expedientesDocs, creditosDocs] = await Promise.all([
      db.collection('clientes').find({}).limit(2000).toArray(),
      db.collection('expedientes').find({}).limit(2000).toArray(),
      db.collection('creditos').find({}).limit(2000).toArray(),
    ]);

    const clientes = asArray(clientesDocs).map((d) => ({
      _id: String(idOf(d._id) ?? ''),
      nombreCompleto: String(d.nombreCompleto ?? ''),
      cedula: String(d.cedula ?? '') || undefined,
      telefono: String(d.telefono ?? '') || undefined,
      direccion: String(d.direccion ?? '') || undefined,
      email: String(d.email ?? '') || undefined,
    } satisfies JuridicoCliente));

    const expedientes = new Map<string, JuridicoExpediente>();
    for (const d of asArray(expedientesDocs)) {
      const id = idOf(d._id);
      if (!id) continue;
      expedientes.set(id, {
        _id: id,
        caratula: String(d.caratula ?? '') || undefined,
        cliente: idOf(d.cliente),
        abogadoAsignado: idOf(d.abogadoAsignado),
        fuero: String(d.fuero ?? '') || undefined,
        juzgado: String(d.juzgado ?? '') || undefined,
        estado: String(d.estado ?? '') || undefined,
        descripcion: String(d.descripcion ?? '') || undefined,
        updatedAt: dateMs(d.updatedAt),
      });
    }

    const clienteById = new Map(clientes.map((c) => [c._id, c]));
    const normalizeName = (s: string) => s.trim().toLocaleLowerCase('es');
    const rows: JuridicoCreditoView[] = [];

    for (const raw of asArray(creditosDocs)) {
      const id = idOf(raw._id);
      if (!id) continue;
      const credito: JuridicoCreditoRaw = {
        _id: id,
        cliente: idOf(raw.cliente) ?? null,
        expediente: idOf(raw.expediente) ?? null,
        clienteNombre: String(raw.clienteNombre ?? ''),
        concepto: String(raw.concepto ?? '') || undefined,
        montoTotal: numOf(raw.montoTotal),
        saldoPendiente: numOf(raw.saldoPendiente),
        updatedAt: dateMs(raw.updatedAt),
      };

      const expediente = credito.expediente ? expedientes.get(credito.expediente) : undefined;

      // 1) Cliente por referencia directa del credito; 2) via expediente; 3) por nombre.
      let cliente = credito.cliente ? clienteById.get(credito.cliente) : undefined;
      if (!cliente && expediente?.cliente) cliente = clienteById.get(expediente.cliente);
      if (!cliente && credito.clienteNombre) {
        const name = normalizeName(credito.clienteNombre);
        cliente = clientes.find((c) => normalizeName(c.nombreCompleto) === name);
      }

      rows.push({
        id,
        sistema: 'juridico',
        clienteNombre: cliente?.nombreCompleto || credito.clienteNombre || 'Sin nombre',
        cedula: cliente?.cedula,
        telefono: cliente?.telefono,
        direccion: cliente?.direccion,
        clienteJuridicoId: cliente?._id,
        expedienteJuridicoId: expediente?._id,
        caratula: expediente?.caratula,
        juzgado: expediente?.juzgado,
        fuero: expediente?.fuero,
        estadoExpediente: expediente?.estado,
        descripcion: expediente?.descripcion,
        concepto: credito.concepto,
        montoTotal: credito.montoTotal ?? 0,
        saldoPendiente: credito.saldoPendiente ?? 0,
        updatedAt: credito.updatedAt ?? expediente?.updatedAt,
      });
    }

    rows.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    return rows;
  } finally {
    await conn.close();
  }
}
