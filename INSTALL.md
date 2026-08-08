# Installation Guide

> **Full installation documentation is available at [`docs/install.md`](./docs/install.md).**
> This file provides a quick-start summary. For detailed instructions (k8s, HA, upgrade, backup/restore, monitoring, troubleshooting), see the comprehensive guide.

---

## Quick Start (Single VM)

```bash
# 1. Clone and enter the repo
git clone <repo-url> taskapp
cd taskapp

# 2. Generate secrets
DB_PASSWORD=$(openssl rand -base64 32 | tr -d /=+ | cut -c1-32)
AUTH_SECRET=$(openssl rand -hex 64)
S3_ACCESS_KEY=$(openssl rand -hex 10)
S3_SECRET_KEY=$(openssl rand -hex 40)
WEBHOOK_SECRET_ENCRYPTION_KEY=$(openssl rand -hex 32)

# 3. Configure environment
cp ops/docker/.env.prod.example .env.prod
# Edit .env.prod with generated secrets

# 4. Build and start
docker build -t taskapp/app:1.0.0 .
docker compose --env-file .env.prod -f ops/docker/docker-compose.prod.yml up -d

# 5. Migrations run through the dedicated migration service. Provision the
# initial production owner with operator-supplied credentials (no defaults).
export SEED_ADMIN_EMAIL='admin@example.com'
export SEED_ADMIN_PASSWORD='replace-with-a-strong-password-at-least-16-chars'
docker compose --env-file .env.prod -f ops/docker/docker-compose.prod.yml exec \
  -e ALLOW_PRODUCTION_SEED=true \
  -e SEED_ADMIN_EMAIL="$SEED_ADMIN_EMAIL" \
  -e SEED_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" \
  app npx tsx prisma/seed.ts

# 6. Run smoke test
BASE_URL=https://localhost ADMIN_EMAIL="$SEED_ADMIN_EMAIL" ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" ./scripts/smoke.sh
```

> Production seeding refuses to run without `ALLOW_PRODUCTION_SEED=true` and
> explicit credentials. Never commit those values.

---

## Quick Start (Kubernetes)

```bash
# Install the Helm chart
helm install taskapp ops/helm/taskapp/ \
  --set app.tag=1.0.0 \
  --set app.replicas=3

# Run smoke test
kubectl port-forward svc/taskapp-app 3000:3000 &
BASE_URL=http://localhost:3000 ADMIN_EMAIL="$SEED_ADMIN_EMAIL" ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" ./scripts/smoke.sh
```

---

## Next Steps

| Guide | Purpose |
|-------|---------|
| [`docs/install.md`](./docs/install.md) | Full installation (single-VM, k8s, HA, upgrade, backup/restore, monitoring, troubleshooting) |
| [`docs/admin-guide.md`](./docs/admin-guide.md) | Post-install configuration: LDAP, SAML, SMTP, users |
| [`docs/user-guide.md`](./docs/user-guide.md) | End-user documentation |
| [`docs/api-integration.md`](./docs/api-integration.md) | Public REST API reference |
| [`docs/webhook-integration.md`](./docs/webhook-integration.md) | Webhook events, payloads, signature verification |
| [`DEPLOYMENT.md`](./DEPLOYMENT.md) | Architecture, sizing, HA, observability |
