import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * Busca el service account del proyecto Firebase principal (sys-creditos-lingroup).
 * Prioridad:
 *  1) env FIREBASE_SERVICE_ACCOUNT_JSON  (contenido del JSON; util en contenedores)
 *  2) env FIRESTORE_SERVICE_ACCOUNT      (ruta a archivo)
 *  3) carpeta hermana sistema_creditos_legacy (raiz y functions/secrets)
 *  4) carpeta actual (migrator) y la raiz del repo
 */
export function findServiceAccount(): string {
  const jsonContent = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (jsonContent && jsonContent.includes('project_id')) {
    const tempPath = path.join(os.tmpdir(), `syscreditos-firebase-sa-${Date.now()}.json`);
    fs.writeFileSync(tempPath, jsonContent, 'utf8');
    return tempPath;
  }

  const explicit = process.env.FIRESTORE_SERVICE_ACCOUNT;
  if (explicit && fs.existsSync(explicit)) return explicit;

  const cwd = process.cwd();
  const baseDirs = [
    path.resolve(cwd, '..', 'sistema_creditos_legacy'),
    path.resolve(cwd, '..', 'sistema_creditos_legacy', 'functions', 'secrets'),
    path.resolve(cwd, '..'),
    cwd,
  ];

  for (const dir of baseDirs) {
    if (!fs.existsSync(dir)) continue;
    let files: string[] = [];
    try {
      files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
    } catch {
      continue;
    }
    for (const file of files) {
      const fullPath = path.join(dir, file);
      try {
        const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8')) as {
          project_id?: string;
          client_email?: string;
        };
        if (parsed.project_id === 'sys-creditos-lingroup') {
          return fullPath;
        }
      } catch {
        // ignorar json no parseable
      }
    }
  }
  throw new Error(
    'No se encontro el service account de sys-creditos-lingroup. ' +
      'Use la env FIREBASE_SERVICE_ACCOUNT_JSON o FIRESTORE_SERVICE_ACCOUNT.',
  );
}

