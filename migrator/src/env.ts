import * as fs from 'fs';
import * as path from 'path';

const ENV_PATH = path.resolve(__dirname, '..', '.env');

/** Carga migrator/.env en process.env (no sobrescribe variables ya definidas). */
export function loadEnv(): void {
  if (!fs.existsSync(ENV_PATH)) return;
  const lines = fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m && !(m[1] in process.env)) {
      process.env[m[1]] = m[2];
    }
  }
}

export function env(key: string, fallback: string): string {
  return process.env[key] || fallback;
}
