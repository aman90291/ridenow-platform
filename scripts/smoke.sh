#!/usr/bin/env bash
# Watch the walking skeleton: curl the health endpoint and print the result.
# Usage: ./scripts/smoke.sh   (override with BASE_URL=https://your-deploy/api)
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000/api}"

echo "==> GET ${BASE_URL}/health"
if command -v jq >/dev/null 2>&1; then
  curl -fsS "${BASE_URL}/health" | jq .
else
  curl -fsS "${BASE_URL}/health"
  echo
fi
echo "OK"
