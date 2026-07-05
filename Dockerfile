# Backend API image (NestJS). Multi-stage: build with the full toolchain, then
# ship a lean production runtime. All config is read from env at run time
# (DATABASE_URL, PORT, CORS_ORIGINS) — no secrets are baked into the image.
#
# NOTE: uses `npm install`, not `npm ci`, on purpose. package-lock.json cannot
# be regenerated in this workspace (npm is sandbox-gated), so it lags behind the
# pg dependency added for the readiness probe; `npm ci` would hard-fail on that
# drift. Switch both stages back to `npm ci` once the lockfile is refreshed.

# ---- Builder: install all deps and compile TypeScript -> dist/main.js ----
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --no-audit --no-fund

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ---- Runtime: production deps + compiled output only ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/main.js"]
