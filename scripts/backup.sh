#!/usr/bin/env bash
set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────
DATABASE_URL="${DATABASE_URL:?DATABASE_URL is required}"
BACKUP_DESTINATION="${BACKUP_DESTINATION:-local}"
BACKUP_S3_BUCKET="${BACKUP_S3_BUCKET:-}"
BACKUP_S3_ENDPOINT="${BACKUP_S3_ENDPOINT:-}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
BACKUP_SCP_TARGET="${BACKUP_SCP_TARGET:-}"
BACKUP_LOCAL_DIR="${BACKUP_LOCAL_DIR:-/var/lib/taskapp/backups}"
MINIO_ALIAS="${MINIO_ALIAS:-minio}"
S3_ACCESS_KEY="${S3_ACCESS_KEY:-}"
S3_SECRET_KEY="${S3_SECRET_KEY:-}"

TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)
WORKDIR="/tmp/taskapp/backups"
DUMP_FILE="${WORKDIR}/taskapp-${TIMESTAMP}.dump"
MINIO_DIR="${WORKDIR}/minio-${TIMESTAMP}"
START_TIME=$(date +%s)

# ── Setup ─────────────────────────────────────────────────────────────────
mkdir -p "$WORKDIR"
echo "[$(date +%H:%M:%S)] Starting backup — ${TIMESTAMP}"

# ── Step 1: PostgreSQL dump ───────────────────────────────────────────────
echo "[1/5] Dumping PostgreSQL..."
pg_dump --format=custom --jobs=4 --file="$DUMP_FILE" "$DATABASE_URL"
DUMP_SIZE=$(stat --format=%s "$DUMP_FILE")

# ── Step 2: MinIO mirror (if configured) ──────────────────────────────────
if command -v mc &>/dev/null && mc ls "${MINIO_ALIAS}/taskapp" &>/dev/null; then
  echo "[2/5] Mirroring MinIO..."
  mkdir -p "$MINIO_DIR"
  mc mirror --remove "${MINIO_ALIAS}/taskapp" "$MINIO_DIR"
fi

# ── Step 3: Verify dump integrity ─────────────────────────────────────────
echo "[3/5] Verifying dump integrity..."
pg_restore --list "$DUMP_FILE" > /dev/null

# ── Step 4: Upload ────────────────────────────────────────────────────────
echo "[4/5] Uploading backup to ${BACKUP_DESTINATION}..."

case "$BACKUP_DESTINATION" in
  s3)
    export AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY"
    export AWS_SECRET_ACCESS_KEY="$S3_SECRET_KEY"
    if [ -n "$BACKUP_S3_ENDPOINT" ]; then
      aws s3 cp "$DUMP_FILE" "s3://${BACKUP_S3_BUCKET}/postgres/" --endpoint-url "$BACKUP_S3_ENDPOINT"
      if [ -d "$MINIO_DIR" ]; then
        aws s3 cp "$MINIO_DIR" "s3://${BACKUP_S3_BUCKET}/minio/" --endpoint-url "$BACKUP_S3_ENDPOINT" --recursive
      fi
    else
      aws s3 cp "$DUMP_FILE" "s3://${BACKUP_S3_BUCKET}/postgres/"
      if [ -d "$MINIO_DIR" ]; then
        aws s3 cp "$MINIO_DIR" "s3://${BACKUP_S3_BUCKET}/minio/" --recursive
      fi
    fi
    ;;
  scp)
    scp "$DUMP_FILE" "$BACKUP_SCP_TARGET"
    if [ -d "$MINIO_DIR" ]; then
      scp -r "$MINIO_DIR" "$BACKUP_SCP_TARGET"
    fi
    ;;
  local)
    mkdir -p "$BACKUP_LOCAL_DIR"
    cp "$DUMP_FILE" "$BACKUP_LOCAL_DIR/"
    if [ -d "$MINIO_DIR" ]; then
      cp -r "$MINIO_DIR" "$BACKUP_LOCAL_DIR/"
    fi
    ;;
  *)
    echo "Unknown BACKUP_DESTINATION: ${BACKUP_DESTINATION}" >&2
    exit 1
    ;;
esac

# ── Step 5: Retention ─────────────────────────────────────────────────────
if [ "$BACKUP_RETENTION_DAYS" -gt 0 ]; then
  echo "[5/5] Applying retention (${BACKUP_RETENTION_DAYS} days)..."
  find "$WORKDIR" -name 'taskapp-*.dump' -mtime "+${BACKUP_RETENTION_DAYS}" -delete
  find "$BACKUP_LOCAL_DIR" -name 'taskapp-*.dump' -mtime "+${BACKUP_RETENTION_DAYS}" -delete 2>/dev/null || true
fi

# ── Done ──────────────────────────────────────────────────────────────────
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
DURATION_HUMAN=$(printf '%dm %ds' $((DURATION / 60)) $((DURATION % 60)))

echo ""
echo "── Backup complete ──"
echo "  Duration:  ${DURATION_HUMAN}"
echo "  Dump size: $(numfmt --to=iec-i "$DUMP_SIZE")"
echo "  Status:    SUCCESS"
echo "────────────────────"
exit 0
