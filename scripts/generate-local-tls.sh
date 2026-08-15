#!/usr/bin/env bash
set -euo pipefail

# Git Bash converts leading-slash arguments (like -subj /CN=...) into Windows
# paths; disable that so the script also works on Windows.
export MSYS_NO_PATHCONV=1

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
CERT_DIR="${TASKAPP_CERT_DIR:-$ROOT_DIR/ops/docker/certs}"
HOSTNAME_VALUE="${TASKAPP_CERT_HOSTNAME:-localhost}"
DAYS="${TASKAPP_CERT_DAYS:-30}"
CERT_FILE="$CERT_DIR/cert.pem"
KEY_FILE="$CERT_DIR/key.pem"

command -v openssl >/dev/null 2>&1 || { echo "OpenSSL is required" >&2; exit 1; }
[[ ! -e "$CERT_FILE" && ! -e "$KEY_FILE" ]] || {
  echo "TLS files already exist in $CERT_DIR; remove them only if replacement is intended" >&2
  exit 1
}

# Build the Subject Alternative Name list. Values that look like IP addresses
# must use the IP: prefix; everything else uses DNS:. The loopback IP is always
# included so local testing keeps working.
sans="IP:127.0.0.1"
add_san() {
  local value=$1
  if [[ "$value" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]]; then
    sans="$sans,IP:$value"
  else
    sans="$sans,DNS:$value"
  fi
}
add_san "$HOSTNAME_VALUE"

# Optional extra SANs (space- or comma-separated). Useful when the site is
# reached both by hostname and by IP, e.g.:
#   TASKAPP_CERT_SANS="taskapp.corp.example.com 10.0.0.5"
if [[ -n "${TASKAPP_CERT_SANS:-}" ]]; then
  IFS=', ' read -r -a extra_sans <<< "$TASKAPP_CERT_SANS"
  for value in "${extra_sans[@]}"; do
    [[ -n "$value" ]] && add_san "$value"
  done
fi

mkdir -p "$CERT_DIR"
openssl req -x509 -nodes -newkey rsa:2048 \
  -keyout "$KEY_FILE" \
  -out "$CERT_FILE" \
  -days "$DAYS" \
  -subj "/CN=$HOSTNAME_VALUE" \
  -addext "subjectAltName=$sans" \
  >/dev/null 2>&1
chmod 600 "$KEY_FILE"
chmod 644 "$CERT_FILE"

echo "Created a local self-signed certificate in $CERT_DIR"
echo "Subject alternative names: $sans"
echo "Do not use it for production; replace it with a customer-trusted certificate and key."
