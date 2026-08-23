#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
COMPOSE_FILE="$ROOT_DIR/ops/docker/docker-compose.prod.yml"
ENV_FILE="$ROOT_DIR/.env.prod"
BUILD=false
CHECK_ONLY=false

usage() {
  cat >&2 <<'EOF'
Usage: bash scripts/deploy-compose.sh [options]

Options:
  --env-file PATH  Production environment file (default: .env.prod)
  --build          Build the app image before starting the stack
  --check-only     Validate configuration and TLS files without starting services
  -h, --help       Show this help
EOF
}

while (($# > 0)); do
  case "$1" in
    --env-file)
      [[ $# -ge 2 ]] || { echo "--env-file requires a path" >&2; exit 2; }
      ENV_FILE=$2
      shift 2
      ;;
    --build)
      BUILD=true
      shift
      ;;
    --check-only)
      CHECK_ONLY=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 2
      ;;
  esac
done

if [[ "$ENV_FILE" != /* ]]; then
  ENV_FILE="$ROOT_DIR/$ENV_FILE"
fi

[[ -f "$ENV_FILE" ]] || { echo "Environment file not found: $ENV_FILE" >&2; exit 1; }
[[ -f "$COMPOSE_FILE" ]] || { echo "Compose file not found: $COMPOSE_FILE" >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "Docker is required" >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "Docker Compose v2 is required" >&2; exit 1; }

read_env_value() {
  local key=$1 line value
  if [[ -n "${!key:-}" ]]; then
    printf '%s' "${!key}"
    return
  fi
  while IFS= read -r line || [[ -n "$line" ]]; do
    case "$line" in
      ""|\#*) continue ;;
      "$key="*)
        value=${line#*=}
        value=${value#\"}
        value=${value%\"}
        value=${value#\'}
        value=${value%\'}
        printf '%s' "$value"
        return
        ;;
    esac
  done < "$ENV_FILE"
}

require_config_value() {
  local key=$1 value
  value=$(read_env_value "$key")
  case "$value" in
    ""|*'<generate-'*|*'***'*|*'change-me'*|*'REPLACE_WITH_'*)
      echo "Set a real value for $key in $ENV_FILE before deployment" >&2
      exit 1
      ;;
  esac
}

for key in DATABASE_URL DB_PASSWORD AUTH_SECRET WEBHOOK_SECRET_ENCRYPTION_KEY \
  REDIS_PASSWORD REDIS_SENTINEL_PASSWORD S3_ACCESS_KEY S3_SECRET_KEY AUTH_URL; do
  require_config_value "$key"
done

http_only=$(read_env_value TASKAPP_HTTP_ONLY)

resolve_host_path() {
  local path=$1
  if [[ "$path" = /* ]]; then
    printf '%s' "$path"
  else
    printf '%s/ops/docker/%s' "$ROOT_DIR" "$path"
  fi
}

cert_file=$(read_env_value TASKAPP_TLS_CERT_FILE)
key_file=$(read_env_value TASKAPP_TLS_KEY_FILE)
cert_file=${cert_file:-./certs/cert.pem}
key_file=${key_file:-./certs/key.pem}

if [[ "$http_only" == "true" ]]; then
  # HTTP-only mode: nginx serves plain HTTP on :80; no TLS files are required
  # (the Compose mounts still expect the default cert paths to exist).
  export TASKAPP_NGINX_CONF=./nginx.http.conf
else
  cert_file=$(resolve_host_path "$cert_file")
  key_file=$(resolve_host_path "$key_file")
  [[ -f "$cert_file" ]] || { echo "TLS certificate not found: $cert_file" >&2; exit 1; }
  [[ -f "$key_file" ]] || { echo "TLS private key not found: $key_file" >&2; exit 1; }
fi

export TASKAPP_ENV_FILE="$ENV_FILE"
compose=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")
"${compose[@]}" config --quiet

if [[ "$CHECK_ONLY" = true ]]; then
  echo "Compose configuration and TLS files are valid"
  exit 0
fi

recreate_app=false
if [[ "$BUILD" = true ]]; then
  app_image=$("${compose[@]}" config --images | while IFS= read -r image; do
    case "$image" in
      taskapp/app:*) printf '%s' "$image"; break ;;
    esac
  done)
  [[ -n "$app_image" ]] || { echo "Unable to determine the app image from Compose" >&2; exit 1; }
  echo "Building $app_image"
  docker build --tag "$app_image" "$ROOT_DIR"
  # A rebuilt image may keep the same APP_VERSION tag. Force the app replicas
  # to recreate so they cannot continue serving an older asset tree
  # (production builds now land in .next-prod; dev uses .next).
  recreate_app=true
fi

if [[ "$recreate_app" = true ]]; then
  "${compose[@]}" up -d --wait --force-recreate nginx app-1 app-2 worker
else
  "${compose[@]}" up -d --wait
fi
"${compose[@]}" ps
