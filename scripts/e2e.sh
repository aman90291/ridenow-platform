#!/usr/bin/env bash
# End-to-end proof of the walking skeleton: boot the whole compose stack on
# localhost, assert every surface (db + backend + both PWAs) answers as the
# acceptance criteria require, then tear the stack down. Any failed assertion
# exits non-zero so CI fails the build.
#
# Usage: ./scripts/e2e.sh
set -euo pipefail

# Run from the repo root regardless of where we're invoked from.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose"
API="http://localhost:3000/api"
RIDER="http://localhost:8081"
DRIVER="http://localhost:8082"

pass() { echo "  ok  - $1"; }
fail() { echo "  FAIL - $1" >&2; exit 1; }

cleanup() {
  echo "==> tearing down stack"
  $COMPOSE down -v --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "==> bringing up the stack (build)"
$COMPOSE up -d --build

# Wait until the backend liveness endpoint answers 200 (compose already gates
# the PWAs on the backend healthcheck, but we poll to fail fast with a message).
echo "==> waiting for backend to become healthy"
ready=""
for _ in $(seq 1 60); do
  if curl -fsS "$API/health" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 2
done
[ -n "$ready" ] || { $COMPOSE ps; $COMPOSE logs backend; fail "backend did not become healthy in time"; }
pass "stack is up"

echo "==> asserting endpoints"

# 1. Liveness: 200 + status ok.
code="$(curl -s -o /tmp/e2e_health.txt -w '%{http_code}' "$API/health")"
[ "$code" = "200" ] || fail "GET /api/health expected 200, got $code"
grep -q '"status":"ok"' /tmp/e2e_health.txt || fail "GET /api/health body missing status ok"
pass "GET /api/health -> 200 status ok"

# 2. Readiness: 200 + db ok + non-empty postgis version.
code="$(curl -s --max-time 15 -o /tmp/e2e_ready.txt -w '%{http_code}' "$API/health/ready")"
[ "$code" = "200" ] || { cat /tmp/e2e_ready.txt; fail "GET /api/health/ready expected 200, got $code"; }
grep -q '"db":"ok"' /tmp/e2e_ready.txt || fail "GET /api/health/ready body missing db ok"
grep -Eq '"postgis":"[^"]+"' /tmp/e2e_ready.txt || fail "GET /api/health/ready missing non-empty postgis version"
pass "GET /api/health/ready -> 200 db ok + postgis version"

# 3. CORS is configured for the PWA origins (proxy for 'the page successfully
#    fetches /api/health' — proves the browser cross-origin call is permitted).
acao="$(curl -s -o /dev/null -D - -H 'Origin: http://localhost:8081' "$API/health" \
  | tr -d '\r' | awk -F': ' 'tolower($1)=="access-control-allow-origin"{print $2}')"
[ "$acao" = "http://localhost:8081" ] || fail "backend CORS did not allow rider origin (got '${acao:-none}')"
pass "backend allows rider PWA origin via CORS"

# 4. Rider PWA: 200 HTML with the rider-app marker.
code="$(curl -s -o /tmp/e2e_rider.html -w '%{http_code}' "$RIDER/")"
[ "$code" = "200" ] || fail "GET rider-pwa / expected 200, got $code"
grep -q 'data-testid="rider-app"' /tmp/e2e_rider.html || fail "rider-pwa missing rider-app marker"
pass "GET $RIDER/ -> 200 with rider-app marker"

# Runtime config was injected (API base not baked into the image).
curl -fsS "$RIDER/config.js" | grep -q "$API" || fail "rider-pwa config.js missing injected API base"
pass "rider-pwa serves runtime-injected config.js"

# 5. Driver PWA: 200 HTML with the driver-app marker.
code="$(curl -s -o /tmp/e2e_driver.html -w '%{http_code}' "$DRIVER/")"
[ "$code" = "200" ] || fail "GET driver-pwa / expected 200, got $code"
grep -q 'data-testid="driver-app"' /tmp/e2e_driver.html || fail "driver-pwa missing driver-app marker"
pass "GET $DRIVER/ -> 200 with driver-app marker"

# 6. Degraded readiness: with the db down, readiness must be 503 unreachable.
echo "==> asserting degraded readiness (db stopped)"
$COMPOSE stop db >/dev/null
code="$(curl -s --max-time 15 -o /tmp/e2e_degraded.txt -w '%{http_code}' "$API/health/ready")"
[ "$code" = "503" ] || { cat /tmp/e2e_degraded.txt; fail "GET /api/health/ready with db down expected 503, got $code"; }
grep -q '"status":"degraded"' /tmp/e2e_degraded.txt || fail "degraded readiness missing status degraded"
grep -q '"db":"unreachable"' /tmp/e2e_degraded.txt || fail "degraded readiness missing db unreachable"
pass "GET /api/health/ready with db down -> 503 degraded/unreachable"

echo "==> all e2e assertions passed"
