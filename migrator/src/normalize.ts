import {
  Timestamp,
  GeoPoint,
  DocumentReference,
  type DocumentSnapshot,
} from 'firebase-admin/firestore';

/**
 * Normaliza un valor de Firestore para MongoDB:
 * - Timestamp  -> número (epoch ms), consistente con el dominio de SysCreditos.
 * - Date       -> número (epoch ms).
 * - GeoPoint   -> { latitude, longitude }.
 * - DocumentReference -> path (string).
 */
export function normalizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;

  if (value instanceof Timestamp) return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (value instanceof GeoPoint) {
    return { latitude: value.latitude, longitude: value.longitude };
  }
  if (value instanceof DocumentReference) return value.path;

  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return value.map((item) => normalizeValue(item));
    }
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>)) {
      out[key] = normalizeValue((value as Record<string, unknown>)[key]);
    }
    return out;
  }

  return value;
}

/** Convierte un doc de Firestore en el doc Mongo equivalente (conserva el id original). */
export function normalizeDoc(doc: DocumentSnapshot): Record<string, unknown> {
  const data = doc.data() ?? {};
  const normalized = normalizeValue(data) as Record<string, unknown>;
  return {
    ...normalized,
    _id: doc.id,
    id: doc.id,
  };
}
