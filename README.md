# RideNow

Transparent, driver-first ride-hailing. Upfront fares (no surprise surge),
server-authoritative pricing, OTP trip-start + share-trip + SOS for safety, and
**atomic driver assignment** so two riders can never grab the same driver.

This repository is the **walking skeleton** stood up by the founding engineer: a
single `docker compose up` brings the whole vertical slice up on localhost — the
database, the backend API, and thin rider & driver web clients that each make a
live call to the backend. Every feature story (auth/OTP, matching, live
tracking, payments) builds on top of this scaffold.

## Stack

- **Backend:** TypeScript + NestJS (modular, ports & adapters)
- **Frontend (rider & driver web):** static PWA stubs served by nginx — thin
  walking-skeleton clients; the full Next.js / React + Leaflet apps land in a
  follow-up story
- **Database:** PostgreSQL 16 + PostGIS (single Postgres, spatial extension enabled)
- **Integrations, behind ports:** Stripe (payments, test mode), Twilio (SMS/OTP),
  and free, keyless OpenStreetMap — Nominatim (geocode) + OSRM (routing)

## Prerequisites

- Node.js 20+
- Docker (for PostgreSQL 16 + PostGIS)

## Quick start

### Full walking skeleton (Docker)

Brings up db + backend + both PWAs on localhost:

```bash
docker compose up -d --build
```

| Surface     | URL                                      |
| ----------- | ---------------------------------------- |
| Backend API | http://localhost:3000/api                |
| Liveness    | http://localhost:3000/api/health         |
| Readiness   | http://localhost:3000/api/health/ready   |
| Rider PWA   | http://localhost:8081                    |
| Driver PWA  | http://localhost:8082                    |

Tear down with `docker compose down -v`.

### Backend only (local Node)

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

# Readiness also proves the db is reachable and PostGIS is enabled:
curl -s http://localhost:3000/api/health/ready
# {"status":"ok","db":"ok","postgis":"3.4 USE_GEOS=1 ..."}
# -> 503 {"status":"degraded","db":"unreachable"} when the db is down
```

Or run the smoke one-liner:

```bash
./scripts/smoke.sh                       # localhost
BASE_URL=https://your-deploy/api ./scripts/smoke.sh   # a live deploy
```

## Test

```bash
npm test            # backend unit tests (jest)
npm run test:e2e    # full walking-skeleton e2e: boots the stack, asserts every
                    # surface, tears it down (requires Docker; used by CI)
```

## Layout

```
src/
  main.ts             # entrypoint: bootstraps Nest, global /api prefix, CORS, HTTP timeouts
  app.module.ts       # root module (feature modules plug in here)
  database/           # shared Postgres/PostGIS connection pool + readiness ping
  health/             # liveness -> GET /api/health, readiness -> GET /api/health/ready
apps/
  rider-pwa/          # static rider client (nginx), API base injected at runtime
  driver-pwa/         # static driver client (nginx)
db/init/              # PostGIS extension migration (runs on first db boot)
scripts/
  smoke.sh            # curl the health endpoint
  e2e.sh              # boot the full stack and assert it end to end
.github/workflows/    # CI: unit build+test job, plus a docker-compose e2e job
Dockerfile            # backend image (multi-stage node build)
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
