# RideNow

Transparent, driver-first ride-hailing. Upfront fares (no surprise surge),
server-authoritative pricing, OTP trip-start + share-trip + SOS for safety, and
**atomic driver assignment** so two riders can never grab the same driver.

This repository is the **walking skeleton** stood up by the founding engineer: a
`docker compose` stack that comes up on localhost and serves a rider PWA, a
driver PWA, and the backend against Postgres + PostGIS — with health/readiness
endpoints, unit tests, an end-to-end test, and CI. Every feature story (auth/OTP,
matching, live tracking, payments) builds on top of this scaffold.

## Stack

- **Backend:** TypeScript + NestJS (modular, ports & adapters)
- **Frontend (rider & driver web):** thin static PWA stubs (nginx-served) that each
  make one live call to the backend — *full Next.js / React + Leaflet apps land in a follow-up story*
- **Database:** PostgreSQL 16 + PostGIS (single Postgres, spatial extension enabled)
- **Integrations, behind ports:** Stripe (payments, test mode), Twilio (SMS/OTP),
  and free, keyless OpenStreetMap — Nominatim (geocode) + OSRM (routing)

## Prerequisites

- Node.js 20+
- Docker (for PostgreSQL 16 + PostGIS)

## Quick start

Whole walking skeleton (db + backend + both PWAs) on localhost:

```bash
docker compose up -d --build
# rider PWA   -> http://localhost:8081
# driver PWA  -> http://localhost:8082
# backend API -> http://localhost:3000/api
```

Or just the API against a containerized db, with hot reload:

```bash
# 1. install deps
npm install

# 2. copy env and start the database
cp .env.example .env
docker compose up -d db

# 3. run the API (http://localhost:3000/api)
npm run start:dev
```

## Health check

```bash
curl -s http://localhost:3000/api/health
# {"status":"ok","service":"ridenow-api","timestamp":"...","uptime":...}

curl -s http://localhost:3000/api/health/ready
# {"status":"ok","db":"ok","postgis":"3.4 USE_GEOS=1 USE_PROJ=1 USE_STATS=1"}
# -> 503 {"status":"degraded","db":"unreachable"} when the db is unreachable
```

Or run the smoke one-liner:

```bash
./scripts/smoke.sh                       # localhost
BASE_URL=https://your-deploy/api ./scripts/smoke.sh   # a live deploy
```

## Test

```bash
npm test                 # unit tests (health + database service)
bash scripts/e2e.sh      # end-to-end: boot the whole stack, assert, tear down
```

## Layout

```
src/
  main.ts             # entrypoint: bootstraps Nest, global /api prefix, CORS, HTTP timeouts
  app.module.ts       # root module (feature modules plug in here)
  database/           # pg pool + readiness ping (SELECT postgis_version())
  health/             # liveness -> GET /api/health, readiness -> GET /api/health/ready
apps/
  rider-pwa/          # static rider client (nginx), one live call to the backend
  driver-pwa/         # static driver client (nginx), one live call to the backend
db/init/              # first-boot migration: CREATE EXTENSION postgis
Dockerfile            # backend image (multi-stage node:20-alpine)
scripts/
  smoke.sh            # curl the health endpoint
  e2e.sh              # boot the full stack, assert every endpoint, tear down
.github/workflows/    # CI: install -> build -> unit test, plus the e2e job
docker-compose.yml    # db + backend + rider-pwa + driver-pwa
.env.example          # env for db + Stripe / Twilio / OSM integrations
```

## Roadmap (next stories, in core-loop order)

1. Auth + Twilio OTP adapter (real SMS to verified numbers; OTP also logged in dev)
2. Rider requests -> nearest-driver match via PostGIS `ST_DWithin` -> **atomic** accept
3. Live tracking: driver location stream rendered on a Leaflet map
4. Complete trip -> Stripe PaymentIntent with a server-authoritative fare
5. Safety: OTP trip-start, share-trip link, SOS
6. Seed/reset script + a one-liner that drives the full core loop end to end
