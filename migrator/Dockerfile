# ============================================================
# Migrador SysCreditos - imagen para ejecutar dentro del VPS (Dokploy)
# Build context: RAIZ del repo (docker build -f migrator/Dockerfile .)
# ============================================================
FROM node:22-alpine AS build
WORKDIR /app
COPY migrator/package.json ./
RUN npm install --no-audit --no-fund --ignore-scripts
COPY migrator/tsconfig.json ./
COPY migrator/src ./src
RUN npx tsc -p tsconfig.json

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
# Uso: node dist/index.js            -> migracion real
#      node dist/index.js --dry-run  -> solo conteo
CMD ["node", "dist/index.js"]
