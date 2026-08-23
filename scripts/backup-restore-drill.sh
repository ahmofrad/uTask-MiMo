#!/usr/bin/env bash
set -euo pipefail

# This drill never targets the configured application database by default.
# Require an explicit disposable DATABASE_URL and confirmation marker.
SOURCE_DATABASE_URL="${SOURCE_DATABASE_URL:-${DATABASE_URL:-}}"
DRILL_DATABASE_URL="${DRILL_DATABASE_URL:-}"
DRILL_CONFIRM="${DRILL_CONFIRM:-}"

if [ -z "$SOURCE_DATABASE_URL" ] || [ -z "$DRILL_DATABASE_URL" ]; then
  echo "SOURCE_DATABASE_URL and DRILL_DATABASE_URL are required" >&2
  exit 1
fi
if [ "$DRILL_DATABASE_URL" = "$SOURCE_DATABASE_URL" ]; then
  echo "DRILL_DATABASE_URL must be a different disposable database" >&2
  exit 1
fi
if [ "$DRILL_CONFIRM" != "I_UNDERSTAND_DISPOSABLE_DATABASE" ]; then
  echo "Set DRILL_CONFIRM=I_UNDERSTAND_DISPOSABLE_DATABASE to run the restore drill" >&2
  exit 1
fi

workdir=$(mktemp -d "${TMPDIR:-/tmp}/taskapp-drill.XXXXXX")
trap 'rm -rf "$workdir"' EXIT

dump="$workdir/taskapp.dump"
manifest="$workdir/manifest.txt"

echo "[1/5] Dumping source database"
pg_dump --format=custom --no-owner --file="$dump" "$SOURCE_DATABASE_URL"

echo "[2/5] Verifying dump manifest"
pg_restore --list "$dump" > "$manifest"
test -s "$manifest"

echo "[3/5] Restoring into disposable database"
pg_restore --clean --if-exists --no-owner --dbname="$DRILL_DATABASE_URL" "$dump"

echo "[4/5] Checking restored schema"
psql "$DRILL_DATABASE_URL" -v ON_ERROR_STOP=1 -c 'SELECT 1 FROM "User" LIMIT 1' >/dev/null
psql "$DRILL_DATABASE_URL" -v ON_ERROR_STOP=1 -c 'SELECT 1 FROM "_prisma_migrations" LIMIT 1' >/dev/null

if command -v mc >/dev/null 2>&1 && [ -n "${MINIO_ALIAS:-}" ] && [ -n "${MINIO_BUCKET:-}" ]; then
  echo "[5/6] Verifying disposable MinIO restore"
  minio_dir="$workdir/minio"
  mc mirror "${MINIO_ALIAS}/${MINIO_BUCKET}" "$minio_dir"
  test -d "$minio_dir"
  echo "[6/6] Restored database and object-storage manifest passed smoke checks"
else
  echo "[5/5] Restored database passed smoke checks"
  echo "MinIO verification skipped: set MINIO_ALIAS, MINIO_BUCKET, and install mc to verify objects"
fi
echo "Backup/restore drill succeeded"
