# RideNow

Transparent, driver-first ride-hailing. Upfront fares (no surprise surge),
server-authoritative pricing, OTP trip-start + share-trip + SOS for safety, and
**atomic driver assignment** so two riders can never grab the same driver.

This repository is the **walking skeleton** stood up by the founding engineer: it
runs and deploys on localhost with a health endpoint, one passing test, and CI.
Every feature story (auth/OTP, matching, live tracking, payments) builds on top
of this scaffold.

## Stack

- **Backend:** TypeScript + NestJS (modular, ports & adapters)
- **Frontend (rider & driver web):** Next.js / React + Leaflet — *added in a follow-up story*
- **Database:** PostgreSQL 16 + PostGIS (single Postgres, spatial extension enabled)
- **Integrations, behind ports:** Stripe (payments, test mode), Twilio (SMS/OTP),
  and free, keyless OpenStreetMap — Nominatim (geocode) + OSRM (routing)

## Prerequisites

- Node.js 20+
- Docker (for PostgreSQL 16 + PostGIS)

## Quick start

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
```

Or run the smoke one-liner:

```bash
./scripts/smoke.sh                       # localhost
BASE_URL=https://your-deploy/api ./scripts/smoke.sh   # a live deploy
```

## Test

```bash
npm test
```

## Layout

```
src/
  main.ts             # entrypoint: bootstraps Nest, global /api prefix, CORS
  app.module.ts       # root module (feature modules plug in here)
  health/             # liveness probe -> GET /api/health
scripts/
  smoke.sh            # curl the health endpoint
.github/workflows/    # CI: npm ci -> build -> test
docker-compose.yml    # Postgres 16 + PostGIS
.env.example          # env for db + Stripe / Twilio / OSM integrations
```

## Roadmap (next stories, in core-loop order)

1. Auth + Twilio OTP adapter (real SMS to verified numbers; OTP also logged in dev)
2. Rider requests -> nearest-driver match via PostGIS `ST_DWithin` -> **atomic** accept
3. Live tracking: driver location stream rendered on a Leaflet map
4. Complete trip -> Stripe PaymentIntent with a server-authoritative fare
5. Safety: OTP trip-start, share-trip link, SOS
6. Seed/reset script + a one-liner that drives the full core loop end to end
