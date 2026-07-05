# Multi-stage build for the RideNow NestJS backend.
# Builder compiles TypeScript -> dist/main.js; runtime carries only prod deps.
#
# We use `npm install` (not `npm ci`) so the build reconciles the pg dependency
# into the lockfile itself; the committed lockfile still pins every existing
# package for reproducibility.

# ---- builder ----
FROM node:20-alpine AS builder
WORKDIR /app

# Install deps first so this layer caches across source-only changes.
COPY package.json package-lock.json ./
RUN npm install --no-audit --no-fund --loglevel=error

# Compile (nest build -> dist/main.js).
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ---- runtime ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Prod-only dependencies; pg ships prebuilt binaries so no toolchain is needed.
COPY package.json package-lock.json ./
RUN npm install --omit=dev --no-audit --no-fund --loglevel=error \
  && npm cache clean --force

# Ship the compiled output only.
COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/main.js"]
