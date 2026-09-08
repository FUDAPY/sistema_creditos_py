import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { UsersService } from './users/users.service';

/**
 * Crea el primer usuario ADMIN (bootstrap).
 * Uso: SEED_ADMIN_EMAIL=admin@lingroup.com SEED_ADMIN_PASSWORD=xxx npm run seed
 * (si el email ya existe, no hace nada y termina ok).
 */
async function seed() {
  const ctx = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const users = ctx.get(UsersService);
    const email = process.env.SEED_ADMIN_EMAIL || 'admin@lingroup.com';
    const name = process.env.SEED_ADMIN_NAME || 'Administrador';
    const password = process.env.SEED_ADMIN_PASSWORD || '';
    if (!password || password.length < 6) {
      throw new Error('Defina SEED_ADMIN_PASSWORD (min 6 caracteres).');
    }
    try {
      const user = await users.create({ email, name, role: 'ADMIN', password });
      console.log(`[seed] ADMIN creado: ${user.email} (${user.id})`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`[seed] ${message}`);
    }
  } finally {
    await ctx.close();
  }
}

void seed();
