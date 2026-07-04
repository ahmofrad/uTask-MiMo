# Installation Guide

## 1. Prerequisites

| Requirement        | Minimum Version / Spec     |
|--------------------|----------------------------|
| Docker             | 24+                        |
| Docker Compose     | v2                         |
| Node.js            | 20 (LTS, for build only)   |
| CPU                | 4 vCPU                     |
| RAM                | 8 GB                       |
| Disk               | 20 GB available            |
| PostgreSQL         | 16 (provided by Docker)    |
| Redis              | 7 (provided by Docker)     |
| Network            | Outbound HTTPS for webhooks|

The application and all dependencies are containerised; you only need Docker and Node.js on the host.

---

## 2. Quick Start (Single VM)

### 2.1 Clone the repository

```bash
git clone <repo-url> taskapp
cd taskapp
```

### 2.2 Configure environment

Copy the production environment template:

```bash
cp .env.prod.example .env.prod
```

Edit `.env.prod` and set at minimum:

| Variable             | Description                            |
|----------------------|----------------------------------------|
| `DATABASE_URL`       | Postgres connection string             |
| `REDIS_URL`          | Redis connection string                |
| `AUTH_SECRET`        | Random 64-char hex (for session/JWT)   |
| `ENCRYPTION_KEY`     | Random 64-char hex (for secrets at rest) |
| `NEXTAUTH_URL`       | Public-facing URL of the instance      |
| `BACKUP_DEST`        | S3-compatible or local path for backups|

All other variables have safe defaults.

### 2.3 Start services

```bash
docker compose -f ops/docker/docker-compose.prod.yml up -d
```

This starts: app, postgres, redis, minio (S3), postgres-exporter, redis-exporter, node-exporter.

### 2.4 Run smoke test

```bash
./scripts/smoke.sh
```

The script checks that the app is reachable, returns a 200 on `/health`, and that database migrations are applied.

---

## 3. Kubernetes Install

### 3.1 Prerequisites

- Helm 3
- kubectl configured for the target cluster
- A Kubernetes cluster (v1.27+ recommended)

### 3.2 Install the chart

```bash
helm install taskapp ops/helm/taskapp/ \
  --values ops/helm/taskapp/values.yaml
```

### 3.3 Configure secrets

Create or update secrets for the required values:

```bash
kubectl create secret generic taskapp-secrets \
  --from-literal=auth-secret='<64-char-hex>' \
  --from-literal=encryption-key='<64-char-hex>' \
  --from-literal=database-url='<postgres-connection-string>' \
  --from-literal=redis-url='<redis-connection-string>'
```

Reference the secret name in your `values.yaml` override under `extraEnvFrom`.

### 3.4 Run smoke test

```bash
./scripts/smoke.sh --target http://<service-url>
```

---

## 4. HA Setup

For production deployments requiring high availability:

### PostgreSQL replication

- Set up streaming replication (primary + 1+ replicas).
- Use PgBouncer or HAProxy for connection pooling and failover.
- Configure `DATABASE_URL` to point to the pooler.

### Redis Sentinel

- Deploy Redis with 3 sentinel nodes and 1 primary + 2 replicas.
- Update `REDIS_URL` to use the sentinel connection format: `redis-sentinel://sentinel-0:26379,sentinel-1:26379,sentinel-2:26379?sentinelMasterId=mymaster`.

### Minio distributed mode

- Deploy MinIO in distributed mode (at least 4 drives / 2 nodes).
- Update `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` in `.env.prod`.

### App replicas

- **Docker Compose:** scale with `docker compose up -d --scale app=3 app`.
- **Kubernetes:** set `app.replicaCount` in Helm values or use HPA based on CPU / RPS.

### Shared state

- File storage → MinIO (already off-host).
- Sessions / queues → Redis (already off-host).
- No local sticky state; all replicas are stateless.

---

## 5. Backup & Restore

### 5.1 Configure backup destination

Set in `.env.prod`:

```
BACKUP_DEST=s3://my-bucket/taskapp-backups
# or
BACKUP_DEST=/mnt/backup
```

For S3 destinations, also set `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`.

### 5.2 Manual backup

```bash
./scripts/backup.sh
```

This dumps Postgres (via `pg_dump`), archives uploads from MinIO, and pushes both to `BACKUP_DEST`. On completion a metric timestamp is written for the `BackupFailed` alert.

### 5.3 Restore

First verify:

```bash
./scripts/restore.sh --dry-run /path/to/dump.sql.gz
```

Then perform the restore:

```bash
./scripts/restore.sh /path/to/dump.sql.gz
```

The restore script:
1. Drops and recreates the database.
2. Imports the SQL dump.
3. Restores file uploads from the backup archive.
4. Does **not** restart services — you must restart the app container manually or via `docker compose restart app`.

---

## 6. Upgrade

### Docker Compose

```bash
docker compose pull app
docker compose up -d app
./scripts/smoke.sh
```

For zero-downtime, scale up new replicas before draining old ones:

```bash
docker compose up -d --scale app=3 app
# wait for health checks
docker compose up -d --scale app=2 app   # replace old
```

### Kubernetes

```bash
helm upgrade taskapp ops/helm/taskapp/ \
  --set app.tag=$NEW_VERSION
```

Use `--set` or a values override file. Always run the smoke test afterward:

```bash
./scripts/smoke.sh --target http://<service-url>
```

### Rollback

Docker Compose — re-run with the previous image tag:

```bash
docker compose up -d app:<previous-tag>
```

Kubernetes:

```bash
helm rollback taskapp <revision>
```

---

## 7. Monitoring

To enable the monitoring stack (Prometheus + Grafana + Alertmanager), add the compose override file:

```bash
docker compose -f ops/docker/docker-compose.prod.yml \
  -f ops/docker/docker-compose.monitoring.yml up -d
```

This starts:
- **Prometheus** — metrics collection (configs in `ops/prometheus/`)
- **Grafana** — dashboards (JSON models in `ops/grafana/`)
- **Alertmanager** — alert routing (config in `ops/alertmanager/`)
- **postgres-exporter** — PG metrics
- **redis-exporter** — Redis metrics
- **node-exporter** — host metrics

Dashboards are auto-provisioned. Import manually from `ops/grafana/*.json` if auto-provisioning is not configured.

Default credentials for Grafana: `admin` / `admin` (change on first login).

---

## 8. Webhook Egress

The application sends outbound webhooks to user-configured URLs. Ensure your firewall / NAT allows egress HTTPS (TCP/443) to external hosts.

If your network uses an HTTP proxy, set the `HTTPS_PROXY` environment variable in the `app` container.

### SSRF protection

Webhook target URLs are validated at creation and delivery time:
- Private / loopback IP ranges are blocked by default (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, `169.254.0.0/16`, `::1/128`, `fc00::/7`).
- The blocklist can be overridden per webhook in the admin UI for customers that need internal endpoints.

---

## 9. Troubleshooting

### DB connection refused

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

1. Verify Postgres is running: `docker compose ps postgres`.
2. Check logs: `docker compose logs postgres`.
3. Confirm `DATABASE_URL` in `.env.prod` points to the correct host and port.
4. If using a separate Postgres host, ensure the host is reachable and port 5432 is open.

### SAML metadata upload fails

```
Error: Invalid SAML metadata
```

1. Validate the XML against the SAML 2.0 schema (use `xmllint` or an online validator).
2. Ensure the `entityID` in the metadata matches the `NEXTAUTH_URL` value.
3. Check that the certificate embedded in the metadata is not expired.
4. Some IdPs require ACS URL and Entity ID to be pre-registered — verify both values in the IdP console.

### Attachment upload fails

```
Error: upload failed
```

1. Check MinIO is running: `docker compose ps minio`.
2. Check MinIO logs: `docker compose logs minio`.
3. Verify `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` are correct.
4. Verify the bucket exists. The app auto-creates it on first use, but a restrictive S3 policy may prevent this.
5. Check disk space on the MinIO host.

### Rate limiting too aggressive

Users report 429 Too Many Requests on normal usage.

1. Rate limit defaults are conservative. Adjust per-IP, per-user, and per-token limits in `.env.prod`:

```
RATE_LIMIT_PER_IP=100
RATE_LIMIT_PER_USER=200
RATE_LIMIT_PER_TOKEN=500
```

All values are requests per minute per key.

2. If behind a reverse proxy, ensure `TRUSTED_PROXY_IPS` includes the proxy's IP so the real client IP is used for rate limiting.
3. Check rate limit headers (`X-RateLimit-Remaining`) in responses to debug which scope is the bottleneck.
