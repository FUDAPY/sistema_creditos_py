import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync } from 'fs';
import { join } from 'path';
import { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { UsersService } from './users/users.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  // Sirve el frontend (web/) en la raiz cuando existe el build; la API sigue en /api/v1
  const webDist = join(process.cwd(), 'web', 'dist');
  if (existsSync(webDist)) {
    app.useStaticAssets(webDist);
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method === 'GET' && !req.path.startsWith('/api')) {
        res.sendFile(join(webDist, 'index.html'));
      } else {
        next();
      }
    });
  }

  const corsOrigin = config.get<string>('CORS_ORIGIN', 'http://localhost:5173');
  app.enableCors({
    origin: corsOrigin === '*' ? true : corsOrigin.split(',').map((o) => o.trim()),
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );
  app.enableShutdownHooks();

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`[api] SysCreditos API escuchando en http://localhost:${port}/api/v1`);

  // Auto-provision del primer ADMIN (usuarios migrados no tienen contrasena desde Firebase Auth)
  const seedPassword = config.get<string>('SEED_ADMIN_PASSWORD', '');
  if (seedPassword && seedPassword !== 'cambiar-min-6-caracteres') {
    try {
      const users = app.get(UsersService);
      const admin = await users.ensureAdmin(
        config.get<string>('SEED_ADMIN_EMAIL', 'admin@lingroup.com'),
        config.get<string>('SEED_ADMIN_NAME', 'Administrador'),
        seedPassword,
      );
      // eslint-disable-next-line no-console
      console.log(`[seed] ADMIN listo: ${admin.email}`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[seed] No se pudo asegurar el ADMIN:', err instanceof Error ? err.message : err);
    }
  }
}

void bootstrap();
