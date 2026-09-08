import mongoose from 'mongoose';
import { cert, initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { loadEnv, env } from './env';
import { findServiceAccount } from './sa';
import { runMigration, validateCoverage } from './runner';

async function main(): Promise<void> {
  loadEnv();
  const dryRun = process.argv.includes('--dry-run');
  const companyId = env('COMPANY_ID', 'lin_group_sa_001');
  const mongoUri = env(
    'MONGO_URI',
    'mongodb://127.0.0.1:27017/syscreditos', // sin credenciales por defecto; definirlas en migrator/.env
  );

  console.log(`[migrator] Empresa: ${companyId}`);
  console.log(`[migrator] Modo: ${dryRun ? 'DRY-RUN (solo lectura, no escribe)' : 'REAL (escribe en Mongo)'}`);

  // Verificacion de cobertura: todas las colecciones de Firestore deben mapearse.
  const missing = validateCoverage();
  if (missing.length > 0) {
    console.error(`[migrator] Faltan colecciones en el orden de migracion: ${missing.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  // 1) Firestore (proyecto sys-creditos-lingroup)
  const serviceAccountPath = findServiceAccount();
  console.log(`[migrator] Service account: ${serviceAccountPath}`);
  const app: App = initializeApp({
    credential: cert(serviceAccountPath),
    projectId: 'sys-creditos-lingroup',
  });
  const firestore: Firestore = getFirestore(app);

  // 2) MongoDB (solo necesario en modo REAL; dry-run solo consulta Firestore)
  console.log(`[migrator] MongoDB: ${mongoUri.replace(/\/\/[^@]+@/, '//***:***@')}`);
  let db: mongoose.mongo.Db | null = null;
  if (!dryRun) {
    await mongoose.connect(mongoUri);
    db = mongoose.connection.db ?? null;
  }

  try {
    const results = await runMigration(firestore, companyId, dryRun, db);
    const totalSource = results.reduce((sum, r) => sum + r.source, 0);
    const totalWritten = results.reduce((sum, r) => sum + r.written, 0);
    const errors = results.filter((r) => !r.ok);
    console.log('\n[migrator] RESUMEN');
    console.table(
      results.map((r) => ({
        Coleccion: r.collection,
        Firestore: r.source,
        Mongo: dryRun ? '-' : r.written,
        Estado: r.ok ? 'OK' : `ERROR ${r.error ?? ''}`,
      })),
    );
    console.log(`[migrator] Total Firestore: ${totalSource}`);
    if (!dryRun) console.log(`[migrator] Total escrito en Mongo: ${totalWritten}`);
    if (errors.length > 0) {
      console.error(`[migrator] Finalizado con ${errors.length} coleccion(es) con error.`);
      process.exitCode = 1;
    }
  } finally {
    await mongoose.disconnect();
    await deleteApp(app);
  }
}

main().catch((err) => {
  console.error('[migrator] Error fatal:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});

