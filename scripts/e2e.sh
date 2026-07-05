#!/usr/bin/env bash
# End-to-end test for the RideNow walking skeleton.
#
# Boots the full compose stack (db + backend + rider-pwa + driver-pwa) on
# localhost, asserts every acceptance-criteria endpoint, then tears the stack
# down. Exits non-zero if ANY assertion fails, so CI fails the build. This is
# the automated proof that the skeleton comes up and works end to end.
#
# Requires: Docker (with compose v2) and curl. Run from anywhere; it cd's to
# the repo root itself.
set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE=(docker compose)
BODY_FILE="$(mktemp)"
HDR_FILE="$(mktemp)"
FAILURES=0

cleanup() {
  echo "==> tearing down stack"
  "${COMPOSE[@]}" down -v --remove-orphans >/dev/null 2>&1 || true
  rm -f "$BODY_FILE" "$HDR_FILE"
}
trap cleanup EXIT

pass() { echo "PASS: $*"; }
fail() { echo "FAIL: $*" >&2; FAILURES=$((FAILURES + 1)); }

# http_get <url> [extra curl args...] -> sets $HTTP_CODE, body in $BODY_FILE.
# Resolves to 000 on any transport error so callers can assert on it safely.
http_get() {
  local url="$1"; shift
  HTTP_CODE="$(curl -sS -m 15 -o "$BODY_FILE" -w '%{http_code}' "$@" "$url" 2>/dev/null)" \
    || HTTP_CODE=000
}

body_has() { grep -qF -- "$1" "$BODY_FILE"; }

expect_status() {
  local name="$1" want="$2"
  if [ "$HTTP_CODE" = "$want" ]; then
    pass "$name (HTTP $HTTP_CODE)"
  else
    fail "$name: expected HTTP $want, got $HTTP_CODE — body: $(cat "$BODY_FILE")"
  fi
}

expect_body() {
  local name="$1" needle="$2"
  if body_has "$needle"; then
    pass "$name"
  else
    fail "$name: response missing '$needle' — body: $(cat "$BODY_FILE")"
  fi
}

# ---- 1. Build & start the whole stack, wait for healthchecks ----
echo "==> building & starting stack (db + backend + rider-pwa + driver-pwa)"
if ! "${COMPOSE[@]}" up -d --build --wait --wait-timeout 300; then
  echo "FAIL: stack did not come up healthy" >&2
  "${COMPOSE[@]}" ps || true
  "${COMPOSE[@]}" logs --no-color --tail 80 || true
  exit 1
fi
pass "db + backend healthchecks report healthy (compose --wait)"

# ---- 2. Backend liveness ----
echo "==> GET /api/health"
http_get http://localhost:3000/api/health
expect_status "backend liveness /api/health" 200
expect_body "liveness body reports status ok" '"status":"ok"'

# ---- 3. Backend readiness: db reachable + PostGIS enabled ----
echo "==> GET /api/health/ready (expect db ok + postgis version)"
ready_ok=0
for _ in $(seq 1 15); do
  http_get http://localhost:3000/api/health/ready
  if [ "$HTTP_CODE" = "200" ] && body_has '"db":"ok"'; then ready_ok=1; break; fi
  sleep 2
done
if [ "$ready_ok" = 1 ]; then
  pass "readiness /api/health/ready (HTTP 200, db ok)"
else
  fail "readiness never returned 200 db:ok — last HTTP $HTTP_CODE: $(cat "$BODY_FILE")"
fi
if grep -qE '"postgis":"[^"]+"' "$BODY_FILE"; then
  pass "readiness reports a non-empty PostGIS version"
else
  fail "readiness missing postgis version — body: $(cat "$BODY_FILE")"
fi

# ---- 4. Cross-origin: a rider/driver browser fetch must be allowed ----
echo "==> CORS check for the rider PWA origin"
curl -sS -m 15 -o /dev/null -D "$HDR_FILE" \
  -H 'Origin: http://localhost:8081' \
  http://localhost:3000/api/health || true
if grep -qi 'access-control-allow-origin: *http://localhost:8081' "$HDR_FILE"; then
  pass "backend allows cross-origin fetch from the rider PWA origin"
else
  fail "missing Access-Control-Allow-Origin for http://localhost:8081 — headers: $(cat "$HDR_FILE")"
fi

# ---- 5. Rider PWA loads and carries its marker ----
echo "==> GET rider PWA (:8081)"
http_get http://localhost:8081/
expect_status "rider PWA /" 200
expect_body "rider PWA renders the rider-app marker" 'data-testid="rider-app"'

# ---- 6. Driver PWA loads and carries its marker ----
echo "==> GET driver PWA (:8082)"
http_get http://localhost:8082/
expect_status "driver PWA /" 200
expect_body "driver PWA renders the driver-app marker" 'data-testid="driver-app"'

# ---- 7. Readiness degrades to 503 when the db is unreachable ----
echo "==> stopping db to assert readiness degrades to 503"
"${COMPOSE[@]}" stop db >/dev/null
degraded=0
for _ in $(seq 1 15); do
  http_get http://localhost:3000/api/health/ready
  if [ "$HTTP_CODE" = "503" ] && body_has '"db":"unreachable"'; then degraded=1; break; fi
  sleep 2
done
if [ "$degraded" = 1 ]; then
  pass "readiness returns 503 degraded / db unreachable when the db is down"
else
  fail "readiness did not report 503 degraded — last HTTP $HTTP_CODE: $(cat "$BODY_FILE")"
fi

# ---- Verdict ----
echo
if [ "$FAILURES" -ne 0 ]; then
  echo "e2e FAILED: $FAILURES assertion(s) failed" >&2
  exit 1
fi
echo "e2e PASSED: walking skeleton is up and working end to end"
