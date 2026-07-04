#!/usr/bin/env bash
set -euo pipefail

# ── Usage ──────────────────────────────────────────────────────────────────
usage() {
  echo "Usage: $0 [--dry-run] <dump-file-or-s3-key>"
  echo ""
  echo "Examples:"
  echo "  $0 /tmp/taskapp/backups/taskapp-2024-12-01_020000.dump"
  echo "  $0 s3://corp-backups/postgres/taskapp-2024-12-01_020000.dump"
  exit 1
}

DRY_RUN=false
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=true
  shift
fi

[ $# -lt 1 ] && usage

DUMP_OR_KEY="$1"
DATABASE_URL="${DATABASE_URL:?DATABASE_URL is required}"
S3_ENDPOINT="${BACKUP_S3_ENDPOINT:-}"
S3_ACCESS_KEY="${S3_ACCESS_KEY:-}"
S3_SECRET_KEY="${S3_SECRET_KEY:-}"

# ── Resolve dump file ────────────────────────────────────────────────────
download_dump() {
  local key="$1"
  local tmpfile
  tmpfile=$(mktemp "/tmp/taskapp-restore-XXXXXX.dump")

  export AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY"
  export AWS_SECRET_ACCESS_KEY="$S3_SECRET_KEY"

  if [ -n "$S3_ENDPOINT" ]; then
    aws s3 cp "$key" "$tmpfile" --endpoint-url "$S3_ENDPOINT"
  else
    aws s3 cp "$key" "$tmpfile"
  fi
  echo "$tmpfile"
}

if [[ "$DUMP_OR_KEY" = s3://* ]]; then
  echo "Downloading from S3: ${DUMP_OR_KEY}"
  if [ "$DRY_RUN" = true ]; then
    echo "  [DRY-RUN] Would download $DUMP_OR_KEY to temporary file"
    echo "  [DRY-RUN] Would verify dump integrity"
    echo "  [DRY-RUN] Would stop app services"
    echo "  [DRY-RUN] Would run pg_restore"
    echo "  [DRY-RUN] Would restart app services"
    echo "  [DRY-RUN] Would suggest running ./scripts/smoke.sh"
    exit 0
  fi
  DUMP_FILE=$(download_dump "$DUMP_OR_KEY")
  trap 'rm -f "$DUMP_FILE"' EXIT
else
  DUMP_FILE="$DUMP_OR_KEY"
  if [ ! -f "$DUMP_FILE" ]; then
    echo "Error: Dump file not found: ${DUMP_FILE}" >&2
    exit 1
  fi
fi

# ── Confirm ───────────────────────────────────────────────────────────────
echo ""
echo "⚠️  WARNING: This will REPLACE ALL DATA in the database."
echo "   Target:   ${DATABASE_URL}"
echo "   Dump:     ${DUMP_FILE}"
echo ""
read -r -p "Type 'RESTORE' to confirm: " CONFIRM
if [ "$CONFIRM" != "RESTORE" ]; then
  echo "Aborted."
  exit 1
fi
echo ""

# ── Verify dump ───────────────────────────────────────────────────────────
echo "[1/4] Verifying dump integrity..."
pg_restore --list "$DUMP_FILE" > /dev/null

# ── Stop services ─────────────────────────────────────────────────────────
echo "[2/4] Stopping app services..."
if command -v kubectl &>/dev/null && kubectl get deployment app 2>/dev/null; then
  kubectl scale deployment app --replicas=0
  kubectl scale deployment socket --replicas=0
  kubectl scale deployment worker --replicas=0
elif command -v docker &>/dev/null && docker compose version &>/dev/null; then
  docker compose stop app socket worker 2>/dev/null || true
else
  echo "Warning: could not detect Docker Compose or kubectl. Continuing anyway..."
fi

# ── Restore ───────────────────────────────────────────────────────────────
echo "[3/4] Restoring PostgreSQL..."
pg_restore --jobs=4 --no-owner --clean --if-exists --dbname="$DATABASE_URL" "$DUMP_FILE"

# ── Restart services ──────────────────────────────────────────────────────
echo "[4/4] Restarting app services..."
if command -v kubectl &>/dev/null && kubectl get deployment app 2>/dev/null; then
  kubectl scale deployment app --replicas=1
  kubectl scale deployment socket --replicas=1
  kubectl scale deployment worker --replicas=1
elif command -v docker &>/dev/null && docker compose version &>/dev/null; then
  docker compose start app socket worker 2>/dev/null || true
fi

# ── Done ──────────────────────────────────────────────────────────────────
echo ""
echo "── Restore complete ──"
echo "  Status: SUCCESS"
echo ""
echo "  Next step: run ./scripts/smoke.sh to verify the deployment."
echo "─────────────────────"
exit 0
