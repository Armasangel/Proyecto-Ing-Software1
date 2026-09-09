# syntax=docker/dockerfile:1
#
# Un solo Dockerfile con dos targets:
#   - dev  (por defecto): entorno de desarrollo con hot-reload, igual que el
#          Dockerfile original. Lo usan el servicio `app` y `test` de compose.
#   - production: imagen optimizada que compila la app y la sirve con
#          `next start` (sin source, sin devDependencies). La usa
#          `docker compose -f docker-compose.yml -f docker-compose.prod.yml up`.

# ── Base común ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS base
WORKDIR /app

# ── Desarrollo / pruebas (target por defecto) ───────────────────────────────
# NODE_ENV=development para que `npm ci` mantenga Jest / RTL / MSW
# (devDependencies) y `next dev` funcione con hot-reload.
FROM base AS dev
ENV NODE_ENV=development
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ── Dependencias de producción (solo lo necesario para servir en runtime) ──
FROM base AS deps
COPY package*.json ./
RUN npm ci --omit=dev

# ── Compilación (requiere devDependencies: typescript, tailwind, etc.) ─────
FROM base AS builder
COPY package*.json ./
RUN npm ci
COPY . .
ENV NODE_ENV=production
RUN npm run build

# ── Imagen de producción ────────────────────────────────────────────────────
FROM base AS production
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.mjs ./next.config.mjs
EXPOSE 3000
# npm start = next start (sirve el bundle ya compilado en .next)
CMD ["npm", "start"]