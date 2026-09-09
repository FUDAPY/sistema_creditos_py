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
# Integraciones externas
INTEGRATION_POS_ENABLED=false
INTEGRATION_POS_URL=
# Juridico (lin-group-central): lectura SOLO-LECTURA de su MongoDB.
# Preferir hostname interno si las redes Docker del VPS se comparten; en su
# defecto usar la IP publica con el puerto publicado del Mongo juridico.
INTEGRATION_JURIDICO_ENABLED=true
INTEGRATION_JURIDICO_URL=mongodb://<user>:<pass>@lin-group-lin-group-central-ktwwt2:27017/?authSource=admin
INTEGRATION_JURIDICO_DB=sysjuridico
INTEGRATION_FINANCIERO_ENABLED=false
INTEGRATION_FINANCIERO_URL=
```
Health check: `GET /api/v1/health` -> `{ status: "ok", mongo: "up" }`.

El primer arranque **crea/resetea el ADMIN** (los usuarios migrados no traen password
desde Firebase Auth) con `SEED_ADMIN_PASSWORD`. Con ese ADMIN se inicia sesion y se
resetean las demas contrasenas.

Dominio sugerido mientras no exista el frontend: `api.creditos.lingroupsapy.com` (DNS A
al VPS). Cuando el frontend este en `https://creditos.lingroupsapy.com`, ese dominio va en
`CORS_ORIGIN`.

## 4) Integracion juridico (lin-group-central)
El adaptador lee la MongoDB del sistema juridico (colecciones `clientes`, `expedientes`,
`creditos`) y devuelve los clientes con creditos unidos por referencia/nombre.

1. `GET /api/v1/integrations/status` muestra el estado de cada sistema.
2. Sincronizacion local (coleccion `externalCredits`): se ejecuta al arrancar y cada
   `EXTERNAL_CREDIT_SYNC_INTERVAL_MS` (default 6 h). Manual (ADMIN):
   `POST /api/v1/external-credits/juridico/sync`.
3. Vista en el frontend: **Empresas -> Juridico** lista `GET /api/v1/external-credits?system=juridico`
   (tabla local con fecha de ultimo sync + boton "Sincronizar ahora" para ADMIN).
4. Redes: si el contenedor de la API no alcanza el hostname interno del Mongo juridico
   (`lin-group-lin-group-central-ktwwt2:27017`), conectar la red Docker desde el VPS:
   ```bash
   docker network connect <red-del-proyecto-lin-group-central> <contenedor-api-creditos>
   ```
   Alternativa: usar la IP publica con el puerto publicado del Mongo juridico.
   > Seguridad: no publicar el Mongo juridico a internet mas tiempo del necesario;
   > restringir por firewall o cerrarlo y rotar credenciales al terminar las pruebas.

## 5) Integracion POS (mismo patron, listo para conectar)
Cuando el sistema POS exponga su API, solo hay que completar el environment:
```env
INTEGRATION_POS_ENABLED=true
INTEGRATION_POS_URL=https://<dominio-o-hostname-del-pos>
INTEGRATION_POS_TOKEN=<token-opcional>
```
Contrato del adaptador (`api/src/integrations/pos.connector.ts`):
`GET {INTEGRATION_POS_URL}/creditos` -> JSON (array, o `{ data | creditos | items | results }`).
Cada registro se normaliza con alias flexibles (id/_id/operacionId, cliente/nombreCompleto,
montoTotal/monto, saldoPendiente/saldo, etc.). La sincronizacion usa la misma coleccion
`externalCredits` con `sistema=pos` y la vista es **Empresas -> POS**.
Los sistemas no habilitados simplemente se omiten en el auto-sync.

## 6) Reconexion posterior (Fase 6, opcional)
Para Financiero (outbound) se activa su env (`INTEGRATION_FINANCIERO_ENABLED=true` + URL)
y se completa su adaptador en `api/src/integrations/`.
