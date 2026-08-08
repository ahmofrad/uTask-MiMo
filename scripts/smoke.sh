#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@utask.local}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-password}"
COOKIE_JAR=$(mktemp)
trap 'rm -f "$COOKIE_JAR"' EXIT

echo "── Smoke Test ──────────────────────────────"
echo ""

# ── Step 1: Health check ──────────────────────────────────────────────────
echo "1. Health check..."
curl -sf ${CURL_OPTS:-} -c "$COOKIE_JAR" "$BASE_URL/api/v1/health" > /dev/null
echo "   OK"
echo ""

# ── Step 2: Login as admin (CSRF cookie + echo header) ────────────────────
echo "2. Login as admin (${ADMIN_EMAIL})..."
CSRF_TOKEN=$(awk '$6 == "csrf_token" { print $7 }' "$COOKIE_JAR")
[ -n "$CSRF_TOKEN" ] || { echo "   FAIL: csrf_token cookie not set"; exit 1; }
LOGIN_RESPONSE=$(curl -sf ${CURL_OPTS:-} -b "$COOKIE_JAR" -c "$COOKIE_JAR" -X POST "$BASE_URL/api/v1/auth/login" \
  -H "x-csrf-token: ${CSRF_TOKEN}" \
  -F "email=${ADMIN_EMAIL}" \
  -F "password=${ADMIN_PASSWORD}")
[ "$(echo "$LOGIN_RESPONSE" | jq -r '.data.success')" = "true" ] || { echo "   FAIL: login rejected"; exit 1; }
echo "   OK"
echo ""

# ── Step 3: Create a project ──────────────────────────────────────────────
echo "3. Create a project..."
CSRF_TOKEN=$(awk '$6 == "csrf_token" { print $7 }' "$COOKIE_JAR")
PROJECT_RESPONSE=$(curl -sf ${CURL_OPTS:-} -b "$COOKIE_JAR" -X POST "$BASE_URL/api/v1/projects" \
  -H "x-csrf-token: ${CSRF_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"name":"Smoke Test Project","description":"Temporary project for smoke test"}')
PROJECT_ID=$(echo "$PROJECT_RESPONSE" | jq -r '.data.id')
echo "   Project ID: ${PROJECT_ID}"
echo "   OK"
echo ""

# ── Step 4: Create a task ─────────────────────────────────────────────────
echo "4. Create a task..."
TASK_IDEMPOTENCY_KEY="smoke-task-${BASHPID:-$$}-$(date +%s)"
TASK_RESPONSE=$(curl -sf ${CURL_OPTS:-} -b "$COOKIE_JAR" -X POST "$BASE_URL/api/v1/tasks" \
  -H "x-csrf-token: ${CSRF_TOKEN}" \
  -H "Idempotency-Key: ${TASK_IDEMPOTENCY_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"projectId\":\"${PROJECT_ID}\",\"title\":\"Smoke test task\"}")
TASK_ID=$(echo "$TASK_RESPONSE" | jq -r '.data.id')
echo "   Task ID: ${TASK_ID}"
echo "   OK"
echo ""

# ── Step 5: Read the task ──────────────────────────────────────────────────
echo "5. Read the task..."
TASK_READ=$(curl -sf ${CURL_OPTS:-} -b "$COOKIE_JAR" "$BASE_URL/api/v1/tasks/${TASK_ID}")
TASK_TITLE=$(echo "$TASK_READ" | jq -r '.data.title')
echo "   Title: ${TASK_TITLE}"
echo "   OK"
echo ""

# ── Step 6: Verify the task exists ─────────────────────────────────────────
echo "6. Verify the task exists..."
if [ "$TASK_TITLE" = "Smoke test task" ]; then
  echo "   Title matches expected value."
  echo "   OK"
else
  echo "   FAIL: Expected 'Smoke test task', got '${TASK_TITLE}'"
  exit 1
fi
echo ""

# ── Step 7: Logout ─────────────────────────────────────────────────────────
echo "7. Logout..."
curl -sf ${CURL_OPTS:-} -b "$COOKIE_JAR" -X POST "$BASE_URL/api/v1/auth/logout" \
  -H "x-csrf-token: ${CSRF_TOKEN}" > /dev/null
echo "   OK"
echo ""

echo "── Smoke test passed ───────────────────────"
exit 0