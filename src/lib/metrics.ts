type MetricState = {
  httpRequests: Map<string, number>;
  httpDuration: Map<string, { count: number; sum: number }>;
  dbDuration: Map<string, { count: number; sum: number }>;
  redisOperations: Map<string, number>;
  queueJobs: Map<string, number>;
  workerReady: boolean;
  retentionDeleted: number;
};

const globalMetrics = globalThis as typeof globalThis & { __taskappMetricState?: MetricState };

function state(): MetricState {
  if (globalMetrics.__taskappMetricState) return globalMetrics.__taskappMetricState;
  const value: MetricState = {
    httpRequests: new Map(),
    httpDuration: new Map(),
    dbDuration: new Map(),
    redisOperations: new Map(),
    queueJobs: new Map(),
    workerReady: false,
    retentionDeleted: 0,
  };
  globalMetrics.__taskappMetricState = value;
  return value;
}

function increment(map: Map<string, number>, key: string, amount = 1): void {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function observe(map: Map<string, { count: number; sum: number }>, key: string, value: number): void {
  const current = map.get(key) ?? { count: 0, sum: 0 };
  current.count += 1;
  current.sum += value;
  map.set(key, current);
}

export function recordHttpRequest(method: string, route: string, status: number, durationMs: number): void {
  const current = state();
  increment(current.httpRequests, `${method}|${route}|${status}`);
  observe(current.httpDuration, `${method}|${route}`, durationMs / 1000);
}

export function recordDbQuery(durationMs: number, query: string): void {
  const operation = query.trim().split(/\s+/)[0]?.toUpperCase() || "UNKNOWN";
  observe(state().dbDuration, operation, durationMs / 1000);
}

export function recordRedisOperation(operation: string, status: "success" | "error"): void {
  increment(state().redisOperations, `${operation}|${status}`);
}

export function setQueueJobCounts(queue: string, counts: Record<string, number>): void {
  const current = state();
  for (const [jobState, count] of Object.entries(counts)) {
    current.queueJobs.set(`${queue}|${jobState}`, count);
  }
}

export function setWorkerReady(ready: boolean): void {
  state().workerReady = ready;
}

export function recordWebhookRetentionDeleted(count: number): void {
  if (count > 0) state().retentionDeleted += count;
}

function labels(values: Record<string, string>): string {
  const encoded = Object.entries(values)
    .map(([key, value]) => `${key}="${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`)
    .join(",");
  return encoded ? `{${encoded}}` : "";
}

export function renderApplicationMetrics(): string {
  const current = state();
  const lines: string[] = [
    "# HELP taskapp_worker_ready Whether the standalone worker is ready",
    "# TYPE taskapp_worker_ready gauge",
    `taskapp_worker_ready${labels({ worker: "bullmq" })} ${current.workerReady ? 1 : 0}`,
    "# HELP taskapp_webhook_retention_deleted_total Webhook deliveries removed by retention cleanup",
    "# TYPE taskapp_webhook_retention_deleted_total counter",
    `taskapp_webhook_retention_deleted_total ${current.retentionDeleted}`,
  ];

  lines.push("# HELP taskapp_http_requests_total Total HTTP requests handled by the application", "# TYPE taskapp_http_requests_total counter");
  for (const [key, count] of current.httpRequests) {
    const [method = "unknown", route = "unknown", status = "500"] = key.split("|");
    lines.push(`taskapp_http_requests_total${labels({ method, route, status })} ${count}`);
  }
  lines.push("# HELP taskapp_http_request_duration_seconds HTTP request duration in seconds", "# TYPE taskapp_http_request_duration_seconds summary");
  for (const [key, value] of current.httpDuration) {
    const [method = "unknown", route = "unknown"] = key.split("|");
    lines.push(`taskapp_http_request_duration_seconds_count${labels({ method, route })} ${value.count}`);
    lines.push(`taskapp_http_request_duration_seconds_sum${labels({ method, route })} ${value.sum}`);
  }
  lines.push("# HELP taskapp_db_query_duration_seconds Prisma query duration in seconds", "# TYPE taskapp_db_query_duration_seconds summary");
  for (const [operation, value] of current.dbDuration) {
    lines.push(`taskapp_db_query_duration_seconds_count${labels({ operation })} ${value.count}`);
    lines.push(`taskapp_db_query_duration_seconds_sum${labels({ operation })} ${value.sum}`);
  }
  lines.push("# HELP taskapp_redis_operations_total Redis operations observed by the application", "# TYPE taskapp_redis_operations_total counter");
  for (const [key, count] of current.redisOperations) {
    const [operation = "unknown", status = "error"] = key.split("|");
    lines.push(`taskapp_redis_operations_total${labels({ operation, status })} ${count}`);
  }
  lines.push("# HELP taskapp_queue_jobs Current BullMQ jobs by queue and state", "# TYPE taskapp_queue_jobs gauge");
  for (const [key, count] of current.queueJobs) {
    const [queue = "unknown", jobState = "unknown"] = key.split("|");
    lines.push(`taskapp_queue_jobs${labels({ queue, state: jobState })} ${count}`);
  }
  return `${lines.join("\n")}\n`;
}
