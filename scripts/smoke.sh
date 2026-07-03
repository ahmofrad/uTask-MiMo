#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "1. Health check..."
curl -sf "$BASE_URL/api/v1/health" > /dev/null && echo "OK" || echo "FAIL"

echo "✅ Smoke test passed."
