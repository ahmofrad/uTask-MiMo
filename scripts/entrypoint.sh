#!/bin/sh
set -e

# Apply pending migrations only in the dedicated migration container/job.
# Application and worker replicas must never race each other through migrations.
if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  attempt=1
  while ! npx prisma migrate deploy; do
    if [ "$attempt" -ge 12 ]; then
      echo "Database migrations failed after ${attempt} attempts" >&2
      exit 1
    fi
    echo "Database migration attempt ${attempt} failed; retrying in 5 seconds" >&2
    attempt=$((attempt + 1))
    sleep 5
  done
fi
exec "$@"