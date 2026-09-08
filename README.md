# SysCreditos — Monorepo (rewrite VPS)

Sistema de créditos **LIN GROUP S.A.** reescrito sobre un stack moderno para VPS (Dokploy),
independiente de Firebase/Firestore. Las funcionalidades de negocio se mantienen **al 100%**
(créditos, empeños, alquileres, prestación de servicios, pagos, cobranza, pagarés,
tragamonedas, rendiciones y reportes).

## Estructura

```
api/                 # API REST (NestJS + Mongoose) — toda la lógica de negocio
packages/shared/     # Tipos/contratos de dominio compartidos (web + api)
migrator/            # Migrador Firestore → MongoDB (export único con validación)
web/                 # Frontend React + Vite + Tailwind (pendiente de portar)
deploy/              # docker-compose (MongoDB replica-set) + Dockerfiles
```

## Referencias

- El sistema original (Firebase/Firestore) está preservado en la rama git **`legacy-firebase`**
  y como copia local en `../sistema_creditos_legacy` (fuente de consulta para el portado y el migrador).
- Las llaves de servicio de Firebase NO se versionan (ver `.gitignore`); viven en
  `../sistema_creditos_legacy/functions/secrets/` para uso del migrador.

## Requisitos

- Node.js >= 20 + npm (workspaces)
- Docker (para MongoDB local con replica-set, necesario para transacciones)

## Arranque rápido

```bash
npm install
docker compose -f deploy/docker-compose.yml up -d   # MongoDB + replica-set
npm run build                                        # shared → api
npm run dev                                          # API en http://localhost:3000
```

Configuración: copiar `api/.env.example` → `api/.env`.
