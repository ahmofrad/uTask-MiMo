#!/usr/bin/env bash
set -euo pipefail

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

mkdir -p "$CERT_DIR"
openssl req -x509 -nodes -newkey rsa:2048 \
  -keyout "$KEY_FILE" \
  -out "$CERT_FILE" \
  -days "$DAYS" \
  -subj "/CN=$HOSTNAME_VALUE" \
  -addext "subjectAltName=DNS:$HOSTNAME_VALUE,IP:127.0.0.1" \
  >/dev/null 2>&1
chmod 600 "$KEY_FILE"
chmod 644 "$CERT_FILE"

echo "Created a local self-signed certificate in $CERT_DIR"
echo "Do not use it for production; replace it with a customer-trusted certificate and key."
