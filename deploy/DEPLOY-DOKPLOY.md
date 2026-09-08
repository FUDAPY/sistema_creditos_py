# SysCreditos — Despliegue en Dokploy (guía)

> Objetivo: correr la API (NestJS + MongoDB) en el VPS con Dokploy, sin Docker local.
> El repo incluye scripts `build`/`start` (compatibles con Railpack/Nixpacks),
> `deploy/Dockerfile.api`, `migrator/Dockerfile` y `migrator.compose.yml` (one-shot).

## 1) Pre-requisitos
- Repositorio en GitHub: `github.com/FUDAPY/sistema_creditos_py` (rama `main`).
- MongoDB ya desplegado en Dokploy (Internal Credentials de `giuli`).
  - Si aun no tiene replica-set (necesario para transacciones), iniciarlo una vez:
    ```js
    rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "localhost:27017" }] })
    ```
- Llave del service account de Firebase en una variable (para el migrador).

## 2) Cargar datos (one-shot, una sola vez)
Crear un servicio **Compose** apuntando al repo con el contenido de `migrator.compose.yml`.
Environment del proyecto:
```env
COMPANY_ID=lin_group_sa_001
MONGO_URI=mongodb://giuli:<TU_PASSWORD>@creditos-creditos-5ngjs4:27017/syscreditos?authSource=admin
FIREBASE_SERVICE_ACCOUNT_JSON=<contenido del sys-creditos-lingroup-...json en UNA linea>
```
Deploy -> revisar logs (RESUMEN por coleccion). El contenedor termina solo (`restart: "no"`).

## 3) Desplegar la API
Crear servicio **Application**:
- Git: repo FUDAPY/sistema_creditos_py, rama `main`.
- Build **Railpack/Nixpacks**: usa `npm run build` + `npm start` del root.
- Build **Dockerfile** (alternativa): ruta `deploy/Dockerfile.api`, contexto raiz.

Environment de la API:
```env
PORT=3000
COMPANY_ID=lin_group_sa_001
MONGO_URI=mongodb://giuli:<TU_PASSWORD>@creditos-creditos-5ngjs4:27017/syscreditos?authSource=admin
JWT_SECRET=<secreto-largo-aleatorio>
JWT_EXPIRES_IN=8h
CORS_ORIGIN=https://creditos.lingroupsapy.com
SEED_ADMIN_EMAIL=admin@lingroup.com
SEED_ADMIN_PASSWORD=<password-admin-inicial>
# Integraciones externas: deshabilitadas por ahora (Fase 4)
INTEGRATION_POS_ENABLED=false
INTEGRATION_JURIDICO_ENABLED=false
INTEGRATION_FINANCIERO_ENABLED=false
```
Health check: `GET /api/v1/health` -> `{ status: "ok", mongo: "up" }`.

El primer arranque **crea/resetea el ADMIN** (los usuarios migrados no traen password
desde Firebase Auth) con `SEED_ADMIN_PASSWORD`. Con ese ADMIN se inicia sesion y se
resetean las demas contrasenas.

Dominio sugerido mientras no exista el frontend: `api.creditos.lingroupsapy.com` (DNS A
al VPS). Cuando el frontend este en `https://creditos.lingroupsapy.com`, ese dominio va en
`CORS_ORIGIN`.

## 4) Reconexion posterior (Fase 6, opcional)
1. `GET /api/v1/integrations/status` muestra el estado actual (todo `disabled`).
2. Para reconectar POS/Juridico/Financiero se activa cada sistema en el environment
   (`INTEGRATION_*_ENABLED=true` + URL/credenciales) y se completa el adaptador en
   `api/src/integrations/`.
