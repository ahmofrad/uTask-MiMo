#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@local}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin}"
COOKIE_JAR=$(mktemp)
trap 'rm -f "$COOKIE_JAR"' EXIT

echo "── Smoke Test ──────────────────────────────"
echo ""

# ── Step 1: Health check ──────────────────────────────────────────────────
echo "1. Health check..."
curl -sf "$BASE_URL/api/v1/health" > /dev/null
echo "   OK"
echo ""

# ── Step 2: Login as admin ────────────────────────────────────────────────
echo "2. Login as admin (${ADMIN_EMAIL})..."
LOGIN_RESPONSE=$(curl -sf -c "$COOKIE_JAR" -X POST "$BASE_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}")
echo "   OK"
echo ""

# ── Step 3: Create a project ──────────────────────────────────────────────
echo "3. Create a project..."
PROJECT_RESPONSE=$(curl -sf -b "$COOKIE_JAR" -X POST "$BASE_URL/api/v1/projects" \
  -H "Content-Type: application/json" \
  -d '{"name":"Smoke Test Project","description":"Temporary project for smoke test"}')
PROJECT_ID=$(echo "$PROJECT_RESPONSE" | jq -r '.data.id')
echo "   Project ID: ${PROJECT_ID}"
echo "   OK"
echo ""

# ── Step 4: Create a task ─────────────────────────────────────────────────
echo "4. Create a task..."
TASK_RESPONSE=$(curl -sf -b "$COOKIE_JAR" -X POST "$BASE_URL/api/v1/tasks" \
  -H "Content-Type: application/json" \
  -d "{\"projectId\":\"${PROJECT_ID}\",\"title\":\"Smoke test task\"}")
TASK_ID=$(echo "$TASK_RESPONSE" | jq -r '.data.id')
echo "   Task ID: ${TASK_ID}"
echo "   OK"
echo ""

# ── Step 5: Read the task ──────────────────────────────────────────────────
echo "5. Read the task..."
TASK_READ=$(curl -sf -b "$COOKIE_JAR" "$BASE_URL/api/v1/tasks/${TASK_ID}")
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
curl -sf -b "$COOKIE_JAR" -X POST "$BASE_URL/api/v1/auth/logout" > /dev/null
echo "   OK"
echo ""

echo "── Smoke test passed ✅ ─────────────────────"
exit 0
