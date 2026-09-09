import type { RemoteCredit } from './integrations.types';

/**
 * Adaptador HTTP del sistema POS (futuro).
 * Contrato esperado por el conector:
 *   GET {INTEGRATION_POS_URL}/creditos
 *   Authorization: Bearer {INTEGRATION_POS_TOKEN}   (opcional)
 * Respuesta: array JSON de operaciones, o un objeto con el array en una clave
 * reconocible (data | creditos | items | results).
 *
 * El mapeo tolera alias de campos comunes; el contrato canónico es el de RemoteCredit.
 */
type AnyDoc = Record<string, unknown>;

function firstString(...vals: unknown[]): string | undefined {
  for (const v of vals) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s && s !== 'undefined' && s !== 'null') return s;
  }
  return undefined;
}

function firstNumber(...vals: unknown[]): number {
  for (const v of vals) {
    if (v == null) continue;
    const n = typeof v === 'number' ? v : Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function dateMs(v: unknown): number | undefined {
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'string') {
    const n = Date.parse(v);
    return Number.isFinite(n) ? n : undefined;
  }
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  return undefined;
}

function extractArray(body: unknown): AnyDoc[] {
  if (Array.isArray(body)) return body as AnyDoc[];
  if (body && typeof body === 'object') {
    for (const key of ['data', 'creditos', 'items', 'results', 'records']) {
      const val = (body as Record<string, unknown>)[key];
      if (Array.isArray(val)) return val as AnyDoc[];
    }
  }
  return [];
}

export async function fetchPosCreditos(baseUrl: string, token?: string): Promise<RemoteCredit[]> {
  const url = `${baseUrl.replace(/\/+$/, '')}/creditos`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
  if (!res.ok) {
    throw new Error(`Sistema POS respondio ${res.status} en ${url}`);
  }
  const body = (await res.json()) as unknown;
  const rawList = extractArray(body);

  return rawList.map((raw): RemoteCredit => {
    const externalId =
      firstString(
        raw.id,
        raw._id,
        raw.creditoId,
        raw.operacionId,
        raw.firestoreId,
        raw.idOperacion,
        raw.externalId,
      ) ?? '';

    const estado = firstString(raw.estado, raw.status, raw.estadoCredito, raw.estadoOperacion);

    return {
      externalId,
      sistema: 'pos',
      clienteNombre:
        firstString(
          raw.clienteNombre,
          raw.cliente,
          raw.nombreCompleto,
          raw.nombre,
          raw.cliente_name,
          raw.deudor,
        ) ?? 'Sin nombre',
      cedula: firstString(raw.cedula, raw.documento, raw.ci, raw.clienteCedula, raw.documentoCliente),
      telefono: firstString(raw.telefono, raw.phone, raw.celular, raw.telefonoCliente),
      direccion: firstString(raw.direccion, raw.address, raw.domicilio),
      referencia: firstString(raw.referencia, raw.numeroOperacion, raw.operacion, raw.nroOperacion, raw.orden),
      referenciaDetalle: firstString(raw.referenciaDetalle, raw.sucursal, raw.local, raw.puntoVenta),
      concepto: firstString(raw.concepto, raw.descripcion, raw.motivo, raw.observacion),
      montoTotal: firstNumber(raw.montoTotal, raw.monto, raw.monto_total, raw.total, raw.capital, raw.principal),
      saldoPendiente: firstNumber(
        raw.saldoPendiente,
        raw.saldo,
        raw.saldo_pendiente,
        raw.saldoActual,
        raw.currentBalance,
        raw.deuda,
      ),
      estado: estado ?? 'activo',
      updatedAt: dateMs(raw.updatedAt ?? raw.fecha ?? raw.createdAt),
    };
  });
}
