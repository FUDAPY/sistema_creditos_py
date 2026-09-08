# SysCreditos

Sistema integral de gestión financiera de **LIN GROUP S.A.** (créditos, empeños, alquileres, prestación de servicios, pagos, cobranza, pagarés, tragamonedas y rendiciones). Frontend React + API NestJS + MongoDB, autohospedado y desplegable en VPS (Dokploy). Reescrito desde cero, independiente de Firebase/Firestore, con lógica de negocio concentrada en el backend y tipos de dominio compartidos entre web y API.

## Motivación

El sistema original dependía de Firebase (Auth, Firestore, Functions), limitando transacciones financieras atómicas robustas, propiedad de los datos y despliegue. SysCreditos fue reescrito para operar sobre infraestructura propia: MongoDB en replica-set (transacciones ACID), API REST propia, autenticación JWT y despliegue limpio en Dokploy, sin pérdida de funcionalidad.

## Tecnologías

- **Backend:** NestJS + Mongoose + JWT (`api/`)
- **Frontend:** React + Vite + TypeScript + Tailwind CSS (`web/`)
- **Tipos compartidos:** TypeScript workspaces (`packages/shared/`)
- **Base de datos:** MongoDB (replica-set, transacciones)
- **Migración:** export validado Firestore → MongoDB (`migrator/`)
- **Despliegue:** Docker Compose / Dokploy (Railpack o Dockerfile)

## Instalación

Requisitos: Node.js ≥ 20, npm (workspaces), MongoDB ≥ 7 (replica-set para transacciones).

```bash
# 1. Dependencias
npm install

# 2. Variables de entorno (ninguna credencial se versiona)
cp api/.env.example api/.env
cp deploy/.env.example deploy/.env        # credenciales del MongoDB local
cp migrator/.env.example migrator/.env    # solo si ejecutas el migrador

# 3. Editar los .env creados:
#    api/.env       -> MONGO_URI, JWT_SECRET, SEED_ADMIN_PASSWORD
#    deploy/.env    -> MONGO_USERNAME, MONGO_PASSWORD

# 4. MongoDB local (replica-set)
docker compose -f deploy/docker-compose.yml up -d

# 5. Compilar y levantar la API
npm run build
npm run dev   # http://localhost:3000/api/v1
```

Variables principales (`api/.env`): `PORT`, `COMPANY_ID`, `MONGO_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGIN`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`. Las integraciones externas (POS, Jurídico, Financiero) se activan con `INTEGRATION_*_ENABLED=true` y sus credenciales.

## Uso

```bash
# Crear el primer usuario ADMIN (o al arrancar con SEED_ADMIN_PASSWORD)
npm run seed --workspace @syscreditos/api

# Health check
curl http://localhost:3000/api/v1/health

# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@empresa.com","password":"****"}'
# -> { accessToken, user } — usar como: Authorization: Bearer <token>

# Migración Firestore -> MongoDB (una sola vez)
npm run migrate:dry --workspace @syscreditos/migrator   # solo conteo
npm run migrate:run  --workspace @syscreditos/migrator  # escritura real
```

## Licencia

MIT

```
MIT License

Copyright (c) 2026 OTELAX DEV (Giuliano Catella)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

