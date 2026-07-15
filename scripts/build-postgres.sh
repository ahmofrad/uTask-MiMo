#!/bin/sh
set -euo pipefail

docker build -t taskapp-postgres:16-pg_partman "$(dirname "$0")/../ops/docker/postgres"
echo "Built taskapp-postgres:16-pg_partman"
echo "Push to your registry: docker tag taskapp-postgres:16-pg_partman your-registry/taskapp-postgres:16-pg_partman && docker push your-registry/taskapp-postgres:16-pg_partman"
