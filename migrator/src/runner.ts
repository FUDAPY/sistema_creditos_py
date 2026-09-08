/**
 * SysCreditos Migrator — Firestore -> MongoDB.
 * Preserva los IDs originales (como _id string), convierte Timestamp a ms,
 * y respeta el orden de integridad referencial de las colecciones.
 */
import mongoose from 'mongoose';
import type { Firestore } from 'firebase-admin/firestore';
import { normalizeDoc } from './normalize';

type Db = mongoose.mongo.Db;
type Collection = mongoose.mongo.Collection;

const BATCH_SIZE = 500;

/** Orden de migración (integridad referencial: primero lo que otros referencian). */
export const COLLECTION_ORDER = [
  'users',
  'clients',
  'chatThreads',
  'posClients',
  'pagares',
  'loans',
  'payments',
  'collectionManagements',
  'paymentDayLocks',
  'loanAssignmentHistory',
  'juridicoCredits',
  'slotMachineSites',
  'slotMachineEntries',
  'clientCreditRequests',
  'auditLogs',
  'rendiciones',
];

export interface CollectionResult {
  collection: string;
  source: number;
  written: number;
  ok: boolean;
  error?: string;
}

async function countCollection(firestore: Firestore, name: string): Promise<number> {
  try {
    const snap = await firestore.collection(name).count().get();
    return snap.data().count ?? 0;
  } catch {
    // Fallback si count() no esta disponible (emulador antiguo).
    const snap = await firestore.collection(name).get();
    return snap.size;
  }
}

/** Lee todos los documentos paginando por __name__ (no depende del tamaño). */
async function* iterateDocs(firestore: Firestore, name: string) {
  let lastId: string | null = null;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let query = firestore.collection(name).orderBy('__name__').limit(BATCH_SIZE);
    if (lastId) query = query.startAfter(lastId);
    const snap = await query.get();
    if (snap.empty) return;
    for (const doc of snap.docs) {
      lastId = doc.id;
      yield doc;
    }
    if (snap.size < BATCH_SIZE) return;
  }
}

async function upsertBatch(
  coll: Collection,
  batch: Array<Record<string, unknown>>,
): Promise<number> {
  const ops = batch.map((doc) => ({
    replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true },
  }));
  // Los documentos migrados son dinamicos; relajamos el tipo de la operacion.
  type BulkOps = Parameters<Collection['bulkWrite']>[0];
  const result = await coll.bulkWrite(ops as unknown as BulkOps, { ordered: false });
  return result.upsertedCount + result.modifiedCount;
}

/** Migra una colección (dry-run: solo conteo). */
export async function migrateCollection(
  db: Db,
  firestore: Firestore,
  collectionName: string,
  dryRun: boolean,
): Promise<CollectionResult> {
  const result: CollectionResult = {
    collection: collectionName,
    source: 0,
    written: 0,
    ok: true,
  };
  const target = db.collection(collectionName);

  result.source = await countCollection(firestore, collectionName);
  if (result.source === 0) return result;
  if (dryRun) return result;

  try {
    let batch: Array<Record<string, unknown>> = [];
    for await (const doc of iterateDocs(firestore, collectionName)) {
      batch.push(normalizeDoc(doc));
      if (batch.length >= BATCH_SIZE) {
        await upsertBatch(target, batch);
        result.written += batch.length;
        batch = [];
      }
    }
    if (batch.length > 0) {
      await upsertBatch(target, batch);
      result.written += batch.length;
    }
  } catch (err) {
    result.ok = false;
    result.error = err instanceof Error ? err.message : String(err);
  }
  return result;
}

/** Ejecuta la migración completa y devuelve el reporte. */
export async function runMigration(
  firestore: Firestore,
  dryRun: boolean,
): Promise<CollectionResult[]> {
  const db = mongoose.connection.db as Db;
  const results: CollectionResult[] = [];
  for (const name of COLLECTION_ORDER) {
    const res = await migrateCollection(db, firestore, name, dryRun);
    results.push(res);
    const label = dryRun ? 'contados' : 'migrados';
    console.log(
      `[migrator] ${res.ok ? 'OK' : 'ERROR'} ${name}: ${res.source} docs (${label})` +
        (res.error ? ` -> ${res.error}` : ''),
    );
  }
  return results;
}

