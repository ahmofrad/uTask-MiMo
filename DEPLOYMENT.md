# DEPLOYMENT.md — On-Premise Deployment Guide

> How to install and operate the platform on customer infrastructure.
> Read this before implementing Phase 9.

---

## 1. Goals

- **Single-VM install** via `docker compose up` for small deployments (< 500 users).
- **Kubernetes install** via Helm for large deployments (1k–10k users).
- **HA topology** with active-passive failover in a single region.
- **Customer-operated backups** — we provide the scripts; they choose where the dumps go.
- **No outbound traffic** — the install must work on an air-gapped network.
- **Documented upgrade path** with zero (or minimal) downtime.

---

## 2. Hardware Sizing

### 2.1 Small deployment (single VM)

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 4 vCPU | 8 vCPU |
| RAM | 8 GB | 16 GB |
| Disk (system) | 40 GB SSD | 40 GB SSD |
| Disk (data) | 100 GB SSD | 500 GB SSD |
| Network | 100 Mbps | 1 Gbps |

**Capacity:** 500 users, 50k tasks, 10 GB attachments.

### 2.2 Medium deployment (k8s, single region)

| Component | Sizing |
|-----------|--------|
| App pods | 3 replicas × 2 vCPU / 4 GB RAM (serve HTTP + Socket.IO) |
| Worker pods | 2 replicas × 1 vCPU / 2 GB RAM |
| Postgres primary | 4 vCPU / 16 GB RAM / 200 GB SSD |
| Postgres replica | 4 vCPU / 16 GB RAM / 200 GB SSD |
| Redis (3-node Sentinel) | 3 × 2 vCPU / 4 GB RAM |
| MinIO (4-drive distributed) | 4 nodes × 2 vCPU / 4 GB RAM / 500 GB each |

**Capacity:** 2k users, 500k tasks, 100 GB attachments.

### 2.3 Large deployment (k8s, single region)

Same topology as medium, but:

- App pods: 6 replicas, HPA on CPU + queue depth.
- Postgres primary: 8 vCPU / 32 GB RAM / 500 GB SSD; +1 read replica for reports.
- Redis cluster (6 nodes, 3 shards × 2 replicas).
- MinIO: 4 nodes × 1 TB each.
- Separate **worker process** (`pnpm worker`) runs the BullMQ queues plus the scheduled jobs: **LDAP group sync** (every `syncIntervalHours`) and **due-soon notification** generation. Background schedulers do NOT run inside the Next.js app process.

**Capacity:** 10k users, 5M tasks, 1 TB attachments.

---

## 3. Topology

### 3.1 Small — single VM

```
┌─────────────────────────────────────────────────┐
│  VM (Ubuntu 22.04 LTS or RHEL 9)                │
│                                                  │
│  ┌────────────────────────────────────────┐      │
│  │ nginx (TLS termination, port 443)      │      │
│  └─────────────────┬──────────────────────┘      │
│                    │                             │
│  ┌─────────────────┴──────────────────────┐      │
│  │  Docker Compose network                │      │
│  │  ┌──────────────┐  ┌──────────────┐    │      │
│  │  │ app          │  │ app          │    │      │
│  │  │ (Next.js     │  │ (replica)    │    │      │
│  │  │ + Socket.IO) │  │              │    │      │
│  │  └──────┬───────┘  └──────┬───────┘    │      │
│  │         │                 │            │      │
│  │  ┌──────┴─────────────────┴──────┐     │      │
│  │  │ Redis 7 (rooms bridge via     │     │      │
│  │  │ @socket.io/redis-adapter)     │     │      │
│  │  └────────────┬──────────────────┘     │      │
│  │               │                        │      │
│  │  ┌────────────┴──────────────────┐     │      │
│  │  │ PgBouncer → Postgres 16       │     │      │
│  │  └────────────┬──────────────────┘     │      │
│  │               │                        │      │
│  │  ┌────────────┴──────────────────┐     │      │
│  │  │ MinIO (single-node)           │     │      │
│  │  └────────────┬──────────────────┘     │      │
│  │               │                        │      │
│  │  ┌────────────┴──────────────────┐     │      │
│  │  │ Worker (BullMQ consumer)      │     │      │
│  │  └───────────────────────────────┘     │      │
│  └────────────────────────────────────────┘      │
│                                                  │
│  Data volume: /var/lib/taskapp/                  │
│    ├── postgres/                                │
│    ├── minio/                                   │
│    ├── redis/                                   │
│    └── backups/                                 │
└─────────────────────────────────────────────────┘
```

### 3.2 Large — k8s

```
                  ┌──────────────────┐
                  │ Ingress (nginx)  │
                  │ TLS + rate limit │
                  └────────┬─────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        app Deployment          worker Deployment
   (6 replicas,            (3 replicas)
   HTTP + Socket.IO,
   rooms via Redis)
        │                  │
        └──────────────────┼──────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
   PgBouncer Service  Redis cluster    MinIO distributed
        │                  │                  │
        ▼                  ▼                  ▼
   Postgres primary   Redis shards      MinIO drives (4)
   + read replica
```

---

## 4. Docker Compose (small deployment)

### 4.1 File structure

```
ops/docker/
├── docker-compose.yml         # local dependency stack
├── docker-compose.prod.yml    # HA single-host production stack
├── nginx.conf                 # TLS reverse proxy
├── .env.prod.example
└── postgres/Dockerfile        # pg_partman-enabled database image
```

### 4.2 Services

```yaml
# docker-compose.yml (sketch)
version: '3.9'

services:
  nginx:
    image: nginx:1.27-alpine
    ports: ["443:443"]
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/nginx/certs:ro
    depends_on: [app]

  app:
    image: taskapp/app:${APP_VERSION}
    command: ["node", "server.js"]
    environment:
      DATABASE_URL: postgresql://taskapp:${DB_PASSWORD}@pgbouncer:6432/taskapp
      REDIS_URL: redis://redis:6379
      S3_ENDPOINT: http://minio:9000
      S3_ACCESS_KEY: ${MINIO_ACCESS_KEY}
      S3_SECRET_KEY: ${MINIO_SECRET_KEY}
      AUTH_SECRET: ${AUTH_SECRET}
      SMTP_HOST: ${SMTP_HOST}
      SMTP_PORT: ${SMTP_PORT}
      SMTP_USER: ${SMTP_USER}
      SMTP_PASSWORD: ${SMTP_PASSWORD}
      SMTP_FROM: ${SMTP_FROM}
      SAML_ENTITY_ID: ${SAML_ENTITY_ID}
      LDAP_URL: ${LDAP_URL}
      # ... etc
    depends_on: [pgbouncer, redis, minio]

  worker:
    image: taskapp/app:${APP_VERSION}
    command: ["node", "dist/worker.js"]
    environment: [same as app]
    depends_on: [pgbouncer, redis]

  pgbouncer:
    image: bitnamilegacy/pgbouncer:1.24.1-debian-12-r10
    environment:
      POSTGRESQL_HOST: postgres
      POSTGRESQL_PORT: 5432
      POSTGRESQL_DATABASE: taskapp
      POSTGRESQL_USERNAME: taskapp
      POSTGRESQL_PASSWORD: ${DB_PASSWORD}
    depends_on: [postgres]

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: taskapp
      POSTGRES_USER: taskapp
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - /var/lib/taskapp/postgres:/var/lib/postgresql/data
    command: postgres -c wal_level=replica -c max_wal_size=4GB -c shared_buffers=2GB

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --maxmemory 2gb --maxmemory-policy allkeys-lru
    volumes:
      - /var/lib/taskapp/redis:/data

  minio:
    image: minio/minio:RELEASE.2024-08-29T01-40-52Z
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY}
    volumes:
      - /var/lib/taskapp/minio:/data
    ports: ["9001:9001"]   # console; restrict by firewall

volumes:
  pgdata:
```

### 4.3 Volumes and backups

| Path | Contents | Backup? |
|------|----------|---------|
| `/var/lib/taskapp/postgres` | Postgres data | Yes — nightly `pg_dump` |
| `/var/lib/taskapp/minio` | Object storage | Yes — nightly `mc mirror` |
| `/var/lib/taskapp/redis` | Redis snapshot | Optional — session loss only |
| `/var/lib/taskapp/backups` | Backup output | Yes — copy off-host |

### 4.4 Environment variables

See `.env.example` for the full list. Critical ones:

```bash
APP_VERSION=1.0.0
DB_PASSWORD=<generated, 32 chars>
AUTH_SECRET=<generated, 64 chars>
S3_ACCESS_KEY=<generated>
S3_SECRET_KEY=<generated>

# Customer-specific
SITE_NAME="Acme Corp TaskApp"
DEFAULT_LOCALE=fa-IR
DEFAULT_ACCENT=#1d4ed8

# SMTP (customer provides)
SMTP_HOST=smtp.corp.example.com
SMTP_PORT=587
SMTP_USER=taskapp@corp.example.com
SMTP_PASSWORD=***
SMTP_FROM="TaskApp <taskapp@corp.example.com>"

# LDAP (optional)
# NOTE: LDAP is configured through the admin **SSO / LDAP** settings page and stored
# in the `Settings` table (scope=install, key=ldap). The application does NOT read
# LDAP_* env vars at runtime — the block below is legacy and ignored by the code.
# Config fields (see AUTH.md §4.2): url, bindUpn, bindPassword, upnSuffix,
# emailAttribute, nameAttribute, defaultRole, syncIntervalHours, tlsCaCert.
# LDAP_URL=ldaps://ldap.corp.example.com:636
# LDAP_BIND_DN=cn=svc-taskapp,...
# LDAP_BIND_PASSWORD=***
# LDAP_SEARCH_BASE=ou=people,dc=corp,dc=example,dc=com
# LDAP_DEFAULT_ROLE=member

# SAML (optional)
SAML_ENTITY_ID=https://taskapp.corp.example.com
SAML_IDP_METADATA_URL=https://login.microsoftonline.com/.../federationmetadata

# Backups
BACKUP_SCHEDULE="0 2 * * *"  # 02:00 nightly
BACKUP_DESTINATION=s3       # or local, or scp
BACKUP_S3_BUCKET=corp-backups
BACKUP_S3_ENDPOINT=https://s3.corp.example.com
BACKUP_RETENTION_DAYS=30
```

---

### 4.5 HA application stack with `docker-compose.prod.yml`

`ops/docker/docker-compose.prod.yml` is the bundled reference topology for a
single host that needs redundant application processes and HA cache/object
storage:

- `nginx` terminates TLS and load-balances `app-1` and `app-2`.
- `migrate` is the only service allowed to run `prisma migrate deploy`.
- `postgres` is one primary behind `pgbouncer`. This is not automatic database
  failover; use an external Patroni/managed PostgreSQL service when database
  failover is required.
- `redis-1`/`redis-2`/`redis-3` plus three Sentinel processes provide Redis
  failover. The app, worker, rate limiter, and Socket.IO adapter all consume
  the same Sentinel configuration.
- `minio-1` through `minio-4` run MinIO distributed mode. The shared Docker
  network alias `minio` is the S3 endpoint used by the application.

Copy `ops/docker/.env.prod.example` to `.env.prod` and set both
`REDIS_PASSWORD` and `REDIS_SENTINEL_PASSWORD` to the same generated value for
the bundled Sentinel topology. The application selects Sentinel mode when
`REDIS_SENTINELS` and `REDIS_SENTINEL_NAME` are present; otherwise it uses the
direct `REDIS_URL` fallback.

Validate the fully interpolated file before starting it. The wrapper rejects
unfilled secret markers and missing TLS files before starting services:

```bash
bash scripts/deploy-compose.sh --env-file .env.prod --check-only
bash scripts/deploy-compose.sh --env-file .env.prod --build
```

For CI or dry-run validation, use a temporary environment file containing safe
non-production placeholders; never put real credentials in shell history or
command output.

#### Webhook egress policy

Webhook delivery is initiated by the `worker` process, while test/synthetic
delivery can be initiated by an app process. The host firewall or an explicit
egress proxy must therefore allow outbound TCP 443 (and TCP 80 only when a
customer endpoint explicitly requires it) from `app-1`, `app-2`, and `worker`
to the customer-approved webhook destinations. Keep inbound access limited to
nginx on TCP 443. Docker bridge networking alone does not enforce a destination
allowlist, so a production installation must document and implement that
allowlist outside this Compose file.

The application still performs its own webhook URL validation and private-range
SSRF protection; the network policy is an additional egress boundary, not a
replacement for application validation.

---

## 5. Kubernetes / Helm

### 5.1 Chart structure

The bundled Helm chart provisions a production application/worker deployment
with single-instance PostgreSQL, Redis, and MinIO by default. It also creates
CPU-based HPAs for the app and worker plus PDBs that keep two app pods and one
worker pod available during voluntary disruptions. It does not provision Redis
Sentinel, a Redis cluster, Patroni/PostgreSQL replication, or distributed MinIO
drives. Treat the HA data-service topology in this document as a reference
architecture and provide those services externally until a chart implementation
for them is added.

```
ops/helm/taskapp/
├── Chart.yaml
├── values.yaml
├── templates/
│   ├── _helpers.tpl
│   ├── app-deployment.yaml
│   ├── app-service.yaml
│   ├── app-ingress.yaml
│   ├── worker-deployment.yaml
│   ├── postgres-statefulset.yaml
│   ├── postgres-service.yaml
│   ├── pgbouncer-deployment.yaml
│   ├── pgbouncer-service.yaml
│   ├── redis-statefulset.yaml
│   ├── redis-service.yaml
│   ├── minio-statefulset.yaml
│   ├── minio-service.yaml
│   ├── configmap.yaml
│   ├── secret.yaml
│   ├── migrate-job.yaml
│   ├── partman-cronjob.yaml
│   ├── backup-cronjob.yaml
│   ├── hpa.yaml
│   ├── worker-hpa.tpl
│   ├── app-pdb.tpl
│   ├── worker-pdb.tpl
│   ├── app-service.yaml
│   ├── app-ingress.yaml
│   └── worker-deployment.yaml
```

### 5.2 Key values

```yaml
# values.yaml (sketch)
app:
  image: taskapp/app
  tag: "1.0.0"
  replicas: 3
  resources:
    requests: { cpu: "500m", memory: "1Gi" }
    limits:   { cpu: "2",    memory: "4Gi" }
  autoscaling:
    enabled: true
    minReplicas: 3
    maxReplicas: 10
    targetCPUUtilizationPercentage: 70
    customMetrics:
      - name: taskapp_queue_depth
        targetAverageValue: "100"

postgres:
  enabled: true   # set false if using external managed Postgres
  storageSize: 200Gi
  storageClass: ssd
  version: "16"
  replication:
    enabled: true
    replicas: 1

redis:
  enabled: true
  mode: standalone
  sentinelCount: 1
  storageSize: 20Gi

minio:
  enabled: true
  mode: standalone
  drives: 1
  storageSize: 500Gi

ingress:
  enabled: true
  className: nginx
  tls:
    secretName: taskapp-tls
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod

backup:
  enabled: true
  schedule: "0 2 * * *"
  destination: s3
  s3:
    bucket: corp-backups
    endpoint: https://s3.corp.example.com
  retention: 30
```

### 5.3 Pre-flight checks

Before installing the chart, verify:

- [ ] All required values present.
- [ ] Storage classes exist.
- [ ] Ingress class available.
- [ ] TLS secret present (if not using cert-manager).
- [ ] Postgres can claim PVC.

---

## 6. Backup & Restore

### 6.1 Backup script (`scripts/backup.sh`)

Runs nightly via cron / CronJob:

1. `pg_dump --format=custom --jobs=4 --file=/tmp/taskapp-$(date +%F).dump $DATABASE_URL`
2. `mc mirror --remove $MINIO_ALIAS/taskapp /tmp/minio-$(date +%F)/` (if MinIO)
3. Upload to destination:
   - `s3`: `aws s3 cp /tmp/taskapp-*.dump s3://$BACKUP_BUCKET/postgres/`
   - `local`: copy to mounted volume
   - `scp`: `scp dump user@backup-host:/backups/`
4. Verify dump: `pg_restore --list /tmp/taskapp.dump > /dev/null`
5. Apply retention: delete dumps older than `$BACKUP_RETENTION_DAYS`
6. Log to file + Loki: backup size, duration, success/failure
7. Emit Prometheus metric: `taskapp_backup_last_success_timestamp_seconds`

### 6.2 Restore script (`scripts/restore.sh`)

```bash
./scripts/restore.sh [--dry-run] <dump-file-or-s3-key>

# Example:
./scripts/restore.sh s3://corp-backups/postgres/taskapp-2024-12-01.dump
```

1. Confirm with operator (interactive prompt).
2. Stop app pods (or scale to 0 in k8s).
3. Stop writes to Postgres (set `app.readonly=true` in config).
4. Drop and recreate `taskapp` database.
5. `pg_restore --jobs=4 --no-owner --dbname=taskapp $DUMP_FILE`
6. Restore MinIO from snapshot.
7. Restart app pods.
8. Smoke test: `scripts/smoke.sh`.
9. Emit `taskapp_restore_last_success_timestamp_seconds`.

### 6.3 Disaster Recovery targets

- **RPO (Recovery Point Objective):** 24 hours (nightly backup).
- **RTO (Recovery Time Objective):** 4 hours for full restore + smoke test.

---

## 7. Upgrade Procedure

### 7.1 Docker Compose

1. Pull new image: `docker compose --env-file .env.prod -f ops/docker/docker-compose.prod.yml pull app-1 app-2 worker migrate`.
2. Maintenance window (optional; many upgrades are zero-downtime):
   - If DB migration: `docker compose --env-file .env.prod -f ops/docker/docker-compose.prod.yml run --rm migrate` (runs `prisma migrate deploy` through the image entrypoint).
   - If breaking: set `app.MAINTENANCE_MODE=true`, take brief downtime.
3. `docker compose --env-file .env.prod -f ops/docker/docker-compose.prod.yml up -d app-1 app-2 worker`.
4. Run `scripts/smoke.sh`.
5. If broken: restore the previous image tag and run the same Compose command again; Docker Compose has no `rollback` subcommand.

### 7.2 Kubernetes

1. Push new image tag.
2. `helm upgrade taskapp ops/helm/taskapp/ --set app.tag=$NEW_VERSION --wait --wait-for-jobs`.
3. Helm performs rolling update (default `maxUnavailable=0`, `maxSurge=1`).
4. Helm creates a revisioned migration Job; app and worker init containers wait for `prisma migrate status` to report an up-to-date schema before starting.
5. Smoke test.
6. If broken: `helm rollback taskapp`.

### 7.3 DB migrations

- Applied with `prisma migrate deploy` (the revisioned migration Job in Kubernetes, or the `migrate` service in Compose).
- **Migrations must be committed and available in the deployed artifact.** The repository tracks `prisma/migrations/`; verify the migration directory is included in image builds before relying on `prisma migrate deploy` for installs/upgrades.
- Backward-compatible migrations only (add column nullable → backfill → add constraint).
- Multi-step migrations for breaking changes (deprecate old column in V1.1, drop in V1.2).
- Never run a destructive migration without an explicit `--confirm-destructive` flag and a tested backup.

#### Local development database

The local dev DB (`pnpm docker:up`) is kept in sync with `prisma db push`, not `migrate dev`, and has been
baselined against the existing migration history so `prisma migrate deploy` is a no-op there instead of
re-applying every migration onto already-present tables.

If you recreate the dev database from scratch, run `pnpm db:baseline` (see `scripts/db-baseline.ts`) to
create the required Postgres extensions, sync the schema with `prisma db push`, and record the migration
history — all in one idempotent step (`migrate resolve` records history without executing SQL).

**Known divergence:** several migrations contain raw SQL that Prisma does not model in `schema.prisma`
(pg_partman partitioning of `AuditLog`/`WebhookDelivery`, FTS indexes, materialized views). A fresh
`prisma migrate deploy` therefore produces a schema that `prisma migrate diff` reports as drifted from
`schema.prisma` (e.g. partitioned tables have no single-column primary key). This is intentional — new
migrations should be created with `prisma migrate dev --create-only` and hand-edited to preserve that
raw DDL, as done historically.

---

### 7.4 Webhook egress requirements

The platform makes outbound HTTPS calls to deliver webhooks. The customer's network must allow:

- **Outbound HTTPS (port 443)** from the **app/worker pods** to the **webhook target URLs** registered by the customer.
- **DNS resolution** for those target hostnames.
- **No requirement for static egress IP** — webhook receivers should authenticate via the `X-TaskApp-Signature` header.

If the customer requires IP allowlisting on the receiving end, document the egress IP in the deployment notes. In k8s this may require a NAT gateway with a fixed IP.

If the deployment is fully air-gapped, webhooks can be disabled per-installation in admin settings; document this in the deployment guide.

### 7.5 Secrets management

The platform uses the following secret material that must be protected by the customer:

- `DB_PASSWORD` — Postgres user password.
- `AUTH_SECRET` — JWT signing secret (32+ bytes, random).
- `WEBHOOK_SECRET_ENCRYPTION_KEY` — AES-256-GCM key for encrypting webhook signing secrets at rest (32 bytes, random). It also encrypts the Calendarific egress API key saved in the holiday-download settings. **If this key is lost, all registered webhook secrets become unrecoverable.** Rotating this key requires re-issuing every webhook; a changed key also silently breaks holiday downloads (the settings page warns and asks you to re-enter the API key).
- `LDAP_BIND_PASSWORD`, `SAML_IDP_CERTIFICATE`, `SMTP_PASSWORD` — sensitive credentials.
- `MINIO_ROOT_PASSWORD`, `REDIS_PASSWORD` (if used).

All secrets are read from environment variables only — never written to the database or config files. The `.env.prod` file (if used) must be chmod 600, owned by the deploy user, and excluded from backups.

For k8s, use sealed-secrets, external-secrets-operator, or the cloud provider's secret manager (AWS Secrets Manager, Azure Key Vault, GCP Secret Manager). Never commit secrets.

## 8. High Availability (active-passive)

### 8.1 Postgres HA

- **Primary + 1 synchronous replica** using Patroni + etcd.
- Automatic failover in < 30 s.
- Witness in a third zone to avoid split-brain.
- App connects via PgBouncer which uses a virtual IP that follows the primary.

### 8.2 Redis HA

- 3-node Sentinel.
- Quorum = 2.
- Automatic failover in < 10 s.

### 8.3 App HA

- ≥ 2 stateless replicas behind LB.
- No session affinity needed (sessions in Redis).

### 8.4 MinIO HA

- Distributed mode (4 drives / 4 nodes minimum).
- Erasure coding for durability.
- Or use customer's managed S3 (AWS S3, MinIO subscription, etc.).

### 8.5 Failure scenarios tested

- [ ] Kill Postgres primary → replica promoted in < 30 s.
- [ ] Kill Redis primary → Sentinel promotes replica in < 10 s.
- [ ] Kill app pod → LB routes to other pods; users don't notice.
- [ ] Kill an app pod → LB routes to other pods (HTTP + Socket.IO); live state resumes via Redis adapter.
- [ ] Kill one MinIO drive → no data loss (erasure coding).
- [ ] Network partition between app and DB → app returns 503 with friendly error, not crash.

---

## 9. Observability Stack (optional but recommended)

### 9.1 Docker Compose — monitoring stack

The repository does not currently bundle a monitoring Compose overlay. Use the
customer's standard Prometheus/Grafana/Loki/Alertmanager deployment to scrape
`/metrics` and ship logs. Pre-built Grafana dashboards and Prometheus alert
rules remain under `ops/grafana/` and `ops/prometheus/`.

### 9.2 Pre-built Grafana dashboards

- **API Overview:** request rate, p50/p95/p99 latency, error rate, status code distribution.
- **DB Overview:** connections (used/free), query duration, lock waits, replication lag.
- **Redis Overview:** memory, hit rate, evicted keys, connected clients.
- **Queue Overview:** BullMQ queue depth, job success/failure rate, job duration.
- **Audit:** audit events by action, by user, top actors.
- **Realtime:** WebSocket connections, messages/sec, disconnects.
- **Node:** CPU, RAM, disk, network per host.

### 9.3 Alert rules

```yaml
# ops/alertmanager/rules.yaml (sketch)
groups:
  - name: taskapp
    rules:
      - alert: HighErrorRate
        expr: rate(taskapp_http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        severity: critical
        annotations:
          summary: "5xx rate > 5% for 5 minutes"

      - alert: SlowAPI
        expr: histogram_quantile(0.95, taskapp_http_request_duration_seconds_bucket) > 0.3
        for: 10m
        severity: warning

      - alert: QueueBacklog
        expr: taskapp_queue_depth > 1000
        for: 15m
        severity: warning

      - alert: DiskFull
        expr: (node_filesystem_avail_bytes / node_filesystem_size_bytes) < 0.1
        for: 5m
        severity: critical

      - alert: BackupFailed
        expr: time() - taskapp_backup_last_success_timestamp_seconds > 86400 * 2
        for: 1m
        severity: critical
        annotations:
          summary: "Backup has not succeeded in 2 days"
```

---

## 10. Security Hardening Checklist

- [ ] TLS 1.2+ only; TLS 1.3 preferred.
- [ ] HSTS with preload.
- [ ] All ports except 443 firewalled off.
- [ ] Postgres not exposed on public network.
- [ ] Redis not exposed on public network (Sentinel auth + ACL).
- [ ] MinIO not exposed on public network (or use external S3).
- [ ] SSH key-only auth on the VM.
- [ ] Fail2ban on SSH.
- [ ] Unattended security updates enabled (Ubuntu) or yum-cron (RHEL).
- [ ] App runs as non-root user inside container.
- [ ] Read-only root filesystem where possible.
- [ ] No `latest` tags in production — pin versions.
- [ ] Secrets only via env vars; never in images.
- [ ] `.env.prod` chmod 600, owned by deploy user.
- [ ] Audit log backup verified weekly.
- [ ] Pen test before GA.
- [ ] Documented incident response procedure.

---

## 11. Installation Documentation

The customer-facing install guide should cover:

1. **Prerequisites** — supported OS, hardware sizing table, network requirements.
2. **Single-VM install** — `docker compose up`, smoke test, first-user setup.
3. **k8s install** — `helm install`, smoke test, first-user setup.
4. **HA install** — additional steps for replication, Sentinel, distributed MinIO.
5. **Backup configuration** — destination, schedule, retention, drill procedure.
6. **Upgrade** — both Docker and k8s paths.
7. **Monitoring** — how to enable the optional monitoring stack.
8. **Troubleshooting** — common issues and fixes (DB connection, SAML metadata, attachment upload fails).
9. **Uninstall** — full data removal (with confirmation).

A separate **Admin Guide** covers UI configuration (LDAP, SAML, SMTP, etc.) and is referenced from `SPEC.md`.

---

## 12. Smoke Test Script (`scripts/smoke.sh`)

Runs after install/upgrade to verify the platform is operational:

```bash
#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://localhost}"
COOKIE_JAR=$(mktemp)

echo "1. Health check..."
curl -sf "$BASE_URL/api/v1/health" > /dev/null

echo "2. Local login as seed admin..."
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@local}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin}"
curl -sf -c "$COOKIE_JAR" -X POST "$BASE_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" > /dev/null

echo "3. Create a task..."
TASK_ID=$(curl -sf -b "$COOKIE_JAR" -X POST "$BASE_URL/api/v1/tasks" \
  -H "Content-Type: application/json" \
  -d '{"projectId":"'"$(curl -sf -b "$COOKIE_JAR" $BASE_URL/api/v1/projects | jq -r '.data[0].id')"'","title":"Smoke test task"}' \
  | jq -r '.data.id')

echo "4. Complete the task..."
curl -sf -b "$COOKIE_JAR" -X PATCH "$BASE_URL/api/v1/tasks/$TASK_ID" \
  -H "Content-Type: application/json" \
  -d '{"status":"done"}' > /dev/null

echo "5. Verify audit log entry..."
AUDIT_COUNT=$(curl -sf -b "$COOKIE_JAR" "$BASE_URL/api/v1/audit?entityType=task&entityId=$TASK_ID" | jq '.data | length')
[ "$AUDIT_COUNT" -ge 2 ] || { echo "Audit log missing entries"; exit 1; }

echo "6. Logout..."
curl -sf -b "$COOKIE_JAR" -X POST "$BASE_URL/api/v1/auth/logout" > /dev/null

rm -f "$COOKIE_JAR"
echo "✅ Smoke test passed."
```

---

## 13. Open Decisions

- **Postgres HA tool:** Patroni vs repmgr vs cloud-native (RDS, Cloud SQL). Patroni for self-hosted; managed Postgres for cloud.
- **Backup destination default:** `s3` (configurable to local / scp / nfs).
- **TLS source:** Let's Encrypt via cert-manager (if internet egress available) or customer-provided cert.
- **Postgres extensions:** `pg_trgm` (FTS), `citext` (case-insensitive email), `pg_partman` (audit log partitioning), `uuid-ossp` (UUID generation), `pgcrypto` (encryption helpers).
- **Email queue:** direct from worker pods, or separate MTA? Direct for now.
- **Multi-region DR:** V2. V1 is single-region HA only.