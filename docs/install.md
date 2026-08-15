# Installation Guide

> Customer-facing install guide for the TaskApp enterprise task management platform.
> See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for architecture details and [`ADMIN.md`](./admin-guide.md) for post-install configuration.

---

## 1. Prerequisites

### 1.1 Supported OS

| OS | Version | Notes |
|----|---------|-------|
| Ubuntu | 22.04 LTS or 24.04 LTS | Recommended |
| RHEL | 9.x | |
| Debian | 12 | |

### 1.2 Hardware Sizing

| Deployment | Users | vCPU | RAM | Disk (system) | Disk (data) |
|------------|-------|------|-----|---------------|-------------|
| Small (single VM) | < 500 | 4 | 8 GB | 40 GB SSD | 100 GB SSD |
| Medium (k8s) | < 2k | See DEPLOYMENT.md §2.2 | | |
| Large (k8s) | < 10k | See DEPLOYMENT.md §2.3 | | |

### 1.3 Software Prerequisites

| Component | Version | Required for |
|-----------|---------|-------------|
| Docker Engine | 24+ | Single-VM install |
| Docker Compose | v2.20+ | Single-VM install and readiness waits |
| Kubernetes | 1.28+ | k8s install |
| Helm | 3.14+ | k8s install |
| OpenSSL | 1.1+ | Generating secrets |
| `jq` | 1.6+ | Smoke test script |

### 1.4 Network Requirements

| Direction | Protocol | Port | Purpose |
|-----------|----------|------|---------|
| Inbound | TCP | 443 | HTTPS (user traffic) |
| Inbound | TCP | 9001 | MinIO console (optional, restrict by firewall) |
| Outbound | TCP | 443 | Webhook delivery to customer URLs |
| Outbound | UDP 53 | DNS | DNS resolution |

**Air-gapped deployments:** The platform requires no outbound internet access for its own operation. Webhooks can be disabled per-installation in admin settings if the network is fully air-gapped.

### 1.5 Required Tools

| Tool | Version | Purpose |
|------|---------|---------|
| Docker Engine | 24+ | Container runtime |
| Docker Compose | v2.20+ | Orchestration and readiness waits |
| Helm | 3.14+ | k8s deployment |
| kubectl | 1.28+ | k8s management |
| OpenSSL | 1.1+ | Secret generation |
| `jq` | 1.6+ | Smoke test script |
| `pg_dump` / `pg_restore` | 16 | Backup/restore (optional, on backup host) |

---

## 2. Single-VM Install (Docker Compose)

### 2.1 Prepare the VM

```bash
# Install Docker Engine (Ubuntu 22.04)
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update && sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Install jq
sudo apt-get install -y jq
```

### 2.2 Prepare the data directory

```bash
sudo mkdir -p /var/lib/taskapp/{postgres,minio,redis,backups}
sudo chown -R 1000:1000 /var/lib/taskapp
```

### 2.3 Generate secrets

```bash
# Generate required secrets
DB_PASSWORD=$(openssl rand -base64 32 | tr -d /=+ | cut -c1-32)
AUTH_SECRET=$(openssl rand -hex 64)
S3_ACCESS_KEY=$(openssl rand -hex 10)
S3_SECRET_KEY=$(openssl rand -hex 40)
WEBHOOK_SECRET_ENCRYPTION_KEY=$(openssl rand -hex 32)
```

### 2.4 Configure environment

```bash
cp ops/docker/.env.prod.example .env.prod
chmod 600 .env.prod

# Edit .env.prod and fill in the generated secrets
# At minimum, set:
#   DB_PASSWORD, AUTH_SECRET, S3_ACCESS_KEY, S3_SECRET_KEY,
#   WEBHOOK_SECRET_ENCRYPTION_KEY
#   SMTP_* (if email is needed)
# Replace REPLACE_WITH_DB_PASSWORD in DATABASE_URL for host-side backup/restore.

# Supply customer-trusted TLS files at the paths in .env.prod.
# For local-only validation, generate an ignored self-signed certificate:
# bash scripts/generate-local-tls.sh
```

### 2.5 Start the stack

```bash
# Validate, build the app image, start all services, and wait for readiness.
bash scripts/deploy-compose.sh --env-file .env.prod --build

# Check logs
docker compose --env-file .env.prod -f ops/docker/docker-compose.prod.yml logs -f
```

### 2.6 Verify database migrations

```bash
# The dedicated `migrate` service runs `prisma migrate deploy` before app/worker start.
docker compose --env-file .env.prod -f ops/docker/docker-compose.prod.yml ps
```

### 2.7 Seed the admin user

```bash
export SEED_ADMIN_EMAIL='admin@example.com'
export SEED_ADMIN_PASSWORD='replace-with-a-strong-password-at-least-16-chars'
docker compose --env-file .env.prod -f ops/docker/docker-compose.prod.yml exec \
  -e ALLOW_PRODUCTION_SEED=true \
  -e SEED_ADMIN_EMAIL="$SEED_ADMIN_EMAIL" \
  -e SEED_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" \
  app-1 npx tsx prisma/seed.ts
```

Production seeding refuses to run without the explicit flag and operator-supplied
credentials. No default production account is created.

### 2.8 Run the smoke test

```bash
# Add CURL_OPTS=-k only when using the local self-signed certificate.
BASE_URL=https://localhost ADMIN_EMAIL="$SEED_ADMIN_EMAIL" ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" ./scripts/smoke.sh
```

### 2.9 First-time setup

1. Open `https://<your-server>` in a browser.
2. Log in with the operator-supplied seeded admin credentials.
3. Go to **Admin → Settings** to configure:
   - Site name, default locale, default accent color
   - SMTP (email notifications)
   - LDAP or SAML SSO (if applicable)
4. Create your first project and start adding tasks.

---

## 3. Kubernetes Install (Helm)

### 3.1 Prerequisites

```bash
# Install Helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Add the repository (if published) or use local chart
# helm repo add taskapp https://charts.taskapp.dev
```

### 3.2 Prepare values

```bash
cp ops/helm/taskapp/values.yaml values-prod.yaml
# Edit values-prod.yaml with your environment settings. These values are
# required before helm install: config.authUrl, secret.dbPassword,
# secret.authSecret, secret.webhookSecretEncryptionKey, secret.s3AccessKey,
# and secret.s3SecretKey. Use an external secret manager where available.
```

### 3.3 Create TLS secret (if not using cert-manager)

```bash
kubectl create secret tls taskapp-tls \
  --cert=/path/to/tls.crt \
  --key=/path/to/tls.key
```

### 3.4 Install the chart

```bash
# From local chart
helm install taskapp ops/helm/taskapp/ \
  --values values-prod.yaml \
  --set app.tag=1.0.0 \
  --set app.replicas=3 \
  --wait --wait-for-jobs

# Or from a repository
# helm repo add taskapp https://charts.taskapp.dev
# helm install taskapp taskapp/taskapp --values values-prod.yaml
```

### 3.5 Verify the installation

```bash
# Check pods
kubectl get pods -l app.kubernetes.io/instance=taskapp

# Check services
kubectl get svc -l app.kubernetes.io/instance=taskapp

# Get the ingress address
kubectl get ingress -l app.kubernetes.io/instance=taskapp
```

### 3.6 Run the smoke test

```bash
# Port-forward the app service
kubectl port-forward svc/taskapp-app 3000:3000 &

# Seed first with operator-supplied credentials, following the production
# seeding procedure above.
# Run smoke test
BASE_URL=http://localhost:3000 ADMIN_EMAIL="$SEED_ADMIN_EMAIL" ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" ./scripts/smoke.sh
```

### 3.7 First-time setup

Same as single-VM: log in with the seeded admin, configure site settings, SMTP, and auth providers.

---

## 4. High-Availability Reference Topology

For deployments requiring HA (≥ 2k users or production-critical), see [`DEPLOYMENT.md`](../DEPLOYMENT.md) §8 for the reference topology. The bundled Helm chart currently deploys single-instance PostgreSQL, Redis, and MinIO; it does not create the Sentinel, Patroni, or distributed-MinIO components listed below. Do not use the default chart as an HA installation without supplying equivalent externally managed services and wiring their endpoints into the deployment.

Key differences from single-VM:
- **Postgres:** Primary + synchronous replica managed by Patroni + etcd
- **Redis:** 3-node Sentinel cluster (quorum = 2)
- **MinIO:** Distributed mode (4 drives minimum)
- **App:** ≥ 2 replicas behind load balancer; each serves HTTP + Socket.IO (`/ws`), bridged by the Redis adapter for cross-instance events

---

## 5. Upgrade Procedure

### 5.1 Docker Compose

```bash
# 1. Pull the new image for every app/worker/migration service
docker compose --env-file .env.prod -f ops/docker/docker-compose.prod.yml pull app-1 app-2 worker migrate

# 2. Run database migrations (if applicable)
docker compose --env-file .env.prod -f ops/docker/docker-compose.prod.yml run --rm migrate

# 3. Restart services
docker compose --env-file .env.prod -f ops/docker/docker-compose.prod.yml up -d

# 4. Run smoke test
BASE_URL=https://localhost ADMIN_EMAIL="$SEED_ADMIN_EMAIL" ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" ./scripts/smoke.sh

# 5. If something goes wrong, rollback
# docker compose --env-file .env.prod -f ops/docker/docker-compose.prod.yml up -d app-1 app-2 worker
```

### 5.2 Kubernetes (Helm)

```bash
# 1. Push new image tag to your registry

# 2. Upgrade
helm upgrade taskapp ops/helm/taskapp/ \
  --set app.tag=$NEW_VERSION \
  --reuse-values \
  --wait \
  --wait-for-jobs

# 3. Monitor rollout
kubectl rollout status deployment/taskapp-app

# 4. Run smoke test
BASE_URL=https://taskapp.corp.example.com ./scripts/smoke.sh

# 5. Rollback if needed
# helm rollback taskapp 0
```

### 5.3 Database Migrations

Migrations are applied automatically during upgrade via a revisioned Kubernetes Job running `prisma migrate deploy`. App and worker init containers wait for `prisma migrate status` before starting. Use `--wait --wait-for-jobs` so Helm reports migration failures. The migration files are tracked in `prisma/migrations/` and are included in the Docker image.

**Important:** All migrations must be backward-compatible (add column nullable → backfill → add constraint). Never run destructive migrations without a confirmed backup.

---

## 6. Backup & Restore

### 6.1 Automated Backups

The platform includes a backup script at `scripts/backup.sh` that:

1. Dumps PostgreSQL (custom format, parallel jobs)
2. Snapshots MinIO object storage
3. Uploads to the configured destination (local, S3, or SCP)
4. Verifies the dump integrity
5. Applies retention (deletes dumps older than `BACKUP_RETENTION_DAYS`)

**Configure backup destination** in `.env.prod`:

```bash
BACKUP_DESTINATION=s3          # s3 | local | scp
BACKUP_S3_BUCKET=corp-backups
BACKUP_S3_ENDPOINT=https://s3.corp.example.com
BACKUP_RETENTION_DAYS=30
```

**Run manually:**

```bash
# Ensure DATABASE_URL is set (or use .env.prod)
export $(grep -v '^#' .env.prod | xargs)
./scripts/backup.sh
```

**Automated via cron:**

```bash
# Add to crontab (runs daily at 2 AM)
0 2 * * * cd /opt/taskapp && ./scripts/backup.sh >> /var/log/taskapp/backup.log 2>&1
```

In k8s, the backup is managed by a CronJob defined in the Helm chart (`backup-cronjob.yaml`).

### 6.2 Restore Procedure

```bash
# Restore from a local dump
./scripts/restore.sh /var/lib/taskapp/backups/taskapp-2024-12-01_020000.dump

# Restore from S3
./scripts/restore.sh s3://corp-backups/postgres/taskapp-2024-12-01_020000.dump

# Dry-run mode (validate without applying)
./scripts/restore.sh --dry-run /path/to/dump.dump
```

The restore script will:
1. Confirm with the operator (interactive prompt)
2. Stop app pods (or scale to 0 in k8s)
3. Drop and recreate the database
4. Run `pg_restore` with parallel jobs
5. Restore MinIO from snapshot
6. Restart app pods
7. Run the smoke test

**RPO:** 24 hours (nightly backup). **RTO:** 4 hours for full restore.

---

## 7. Monitoring Stack (Optional)

The repository does not currently bundle a monitoring Compose overlay. Deploy
Prometheus, Grafana, Loki, and Alertmanager using the customer's standard
observability platform, and configure it to scrape the app metrics endpoint.
The repository includes alert rules and Grafana dashboard JSON under `ops/`.

Pre-built Grafana dashboards:
- **API Overview:** request rate, p50/p95/p99 latency, error rate
- **DB Overview:** connections, query duration, lock waits, replication lag
- **Redis Overview:** memory, hit rate, evicted keys
- **Queue Overview:** BullMQ queue depth, job success/failure rate
- **Webhook Delivery Health:** delivery success rate, retry count, dead-letter count
- **Node:** CPU, RAM, disk, network per host

---

## 8. Troubleshooting

### 8.1 App won't start

```bash
# Check app logs (the HA stack has app-1 and app-2 services)
docker compose --env-file .env.prod -f ops/docker/docker-compose.prod.yml logs app-1 app-2

# Common issues:
# - DATABASE_URL wrong or DB not reachable
# - AUTH_SECRET not set
# - Port 443 already in use
```

### 8.2 Database connection fails

```bash
# Check if Postgres is running
docker compose --env-file .env.prod -f ops/docker/docker-compose.prod.yml exec postgres pg_isready -U taskapp

# Check PgBouncer
docker compose --env-file .env.prod -f ops/docker/docker-compose.prod.yml logs pgbouncer

# Verify DATABASE_URL in .env.prod
```

### 8.3 SAML metadata upload fails

- Ensure the IdP metadata XML is valid and contains the `X509Certificate` element
- Verify `SAML_ENTITY_ID` matches the SP entity ID configured in the IdP
- Check the callback URL matches `SAML_CALLBACK_URL` in `.env.prod`

### 8.4 Attachment upload fails

- Check MinIO is running: `docker compose --env-file .env.prod -f ops/docker/docker-compose.prod.yml exec minio-1 curl -f http://localhost:9000/minio/health/live`
- Verify `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` in `.env.prod`
- Check MinIO console at `http://<host>:9001` for bucket existence

### 8.5 Webhook delivery fails

- Verify the target URL is reachable from the app/worker containers
- Check the webhook delivery log in the admin UI for error details
- Ensure the target server is not blocking the request (SSRF protection blocks private IP ranges)
- If the target is on a private network, configure the firewall to allow egress from the app/worker

### 8.6 Browser shows an SSL warning / service worker fails to register

If you open the site by IP or hostname (for example `https://172.31.252.16/`) but
the self-signed certificate was generated for `localhost`, the browser rejects
the certificate. The login page can load only partially and the console shows:

```
SecurityError: Failed to register a ServiceWorker for scope ('https://172.31.252.16/')
with script ('https://172.31.252.16/sw.js'): An SSL certificate error occurred
when fetching the script.
```

Fix: regenerate the certificate with the address you actually use, then trust it
in the client browser (or replace it with a customer-trusted certificate):

```bash
rm -f ops/docker/certs/cert.pem ops/docker/certs/key.pem
TASKAPP_CERT_HOSTNAME=172.31.252.16 bash scripts/generate-local-tls.sh

# To also cover a hostname, pass both (any value that looks like an IP is
# emitted as an IP: SAN automatically):
# TASKAPP_CERT_HOSTNAME=taskapp.corp.example.com \
#   TASKAPP_CERT_SANS="172.31.252.16" bash scripts/generate-local-tls.sh

docker compose --env-file .env.prod -f ops/docker/docker-compose.prod.yml restart nginx
```

Then import `ops/docker/certs/cert.pem` into the client OS/browser trust store
(Chrome: Settings → Privacy and security → Security → Manage certificates →
Authorities → Import) and hard-reload the page. A self-signed certificate must
be trusted by the client for the service worker to register.

### 8.7 Run over plain HTTP (no TLS)

For internal/lab use the stack can serve the site over plain HTTP instead. The
application is HTTPS-agnostic — login, CSRF, and Socket.IO all work over HTTP —
but the PWA service worker requires a secure context, so it is skipped silently
(no offline mode, no install prompt) when the site is opened over plain HTTP.

1. In `.env.prod`, set:

   ```bash
   TASKAPP_HTTP_ONLY=true
   # Must match how you open the site; keep it https:// only when TLS is on,
   # otherwise the secure session cookie is dropped by the browser.
   AUTH_URL=http://<server-ip-or-hostname>
   ```

2. Make sure `ops/docker/certs/cert.pem` and `ops/docker/certs/key.pem` still
   exist — HTTP mode ignores them, but the Compose file still mounts them.

3. Redeploy:

   ```bash
   bash scripts/deploy-compose.sh --env-file .env.prod --build
   ```

4. Open `http://<server-ip-or-hostname>` (the HTTPS port 443 is unused).

Plain HTTP sends credentials unencrypted, so never use it outside internal
testing; the default deployment serves TLS on 443 and redirects port 80 to it.

---

## 9. Uninstall

### 9.1 Docker Compose

```bash
# Stop and remove containers, networks, volumes
docker compose --env-file .env.prod -f ops/docker/docker-compose.prod.yml down -v

# Remove data directory
sudo rm -rf /var/lib/taskapp
```

### 9.2 Kubernetes

```bash
# Uninstall the Helm release
helm uninstall taskapp

# Delete PVCs (data will be lost!)
kubectl delete pvc -l app.kubernetes.io/instance=taskapp

# Delete namespace (if using a dedicated namespace)
# kubectl delete namespace taskapp
```

**Warning:** These operations permanently delete all data. Ensure backups exist before proceeding.

---

## 10. Next Steps

After installation, refer to the following guides:

| Guide | Purpose |
|-------|---------|
| [`admin-guide.md`](./admin-guide.md) | Post-install configuration: LDAP, SAML, SMTP, users, departments |
| [`user-guide.md`](./user-guide.md) | End-user documentation for tasks, projects, custom fields |
| [`api-integration.md`](./api-integration.md) | Public REST API reference with OpenAPI spec |
| [`webhook-integration.md`](./webhook-integration.md) | Webhook event types, payloads, and signature verification |
| [`DEPLOYMENT.md`](../DEPLOYMENT.md) | Architecture, sizing, HA topology, observability stack |