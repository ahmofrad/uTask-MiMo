function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match?.[1] ?? null;
}

/** Status codes that are safe to retry (transient server errors + network failures). */
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

type RetryConfig = {
  /** Maximum number of retry attempts (default 2). */
  maxRetries?: number;
  /** Base delay in ms before the first retry (default 500). */
  baseDelayMs?: number;
  /** Maximum delay cap in ms (default 8000). */
  maxDelayMs?: number;
};

const DEFAULT_RETRY: Required<RetryConfig> = {
  maxRetries: 2,
  baseDelayMs: 500,
  maxDelayMs: 8_000,
};

/**
 * Compute delay for a retry attempt using exponential backoff with full jitter.
 *
 * delay = min(cap, random(0, base × 2^attempt))
 *
 * Full-jitter (not just jittered-min) avoids thundering-herd correlations
 * when many clients see the same transient outage.
 */
function backoffDelay(attempt: number, baseMs: number, capMs: number): number {
  const maxRaw = baseMs * Math.pow(2, attempt);
  return Math.min(capMs, Math.floor(Math.random() * (maxRaw + 1)));
}

async function _fetch(
  url: string,
  options: RequestInit,
): Promise<Response> {
  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers);

  // Attach CSRF token on state-changing requests
  if (["POST", "PATCH", "DELETE", "PUT"].includes(method)) {
    const token = getCsrfToken();
    const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
    if (token && !headers.has("x-csrf-token")) {
      headers.set("x-csrf-token", token);
    }
    if (!headers.has("Content-Type") && options.body && !isFormData) {
      headers.set("Content-Type", "application/json");
    }

    if (
      method === "POST" &&
      !headers.has("Idempotency-Key") &&
      /\/api\/v1\/(?:(?:public\/)?tasks(?:\/[^/]+\/comments)?|groups\/[^/]+\/members)$/.test(
        new URL(url, window.location.origin).pathname,
      )
    ) {
      headers.set("Idempotency-Key", crypto.randomUUID());
    }
  }

  return fetch(url, { ...options, headers });
}

/**
 * Fetch wrapper with optional retry on transient errors.
 *
 * Retries are limited to safe HTTP methods (GET, HEAD, OPTIONS) and response
 * statuses 408, 429, 500, 502, 503, 504. Mutations (POST/PATCH/DELETE/PUT)
 * never retry automatically — the caller should use their own idempotency
 * mechanism and retry at the application level instead.
 *
 * @example
 * // With custom retry config
 * await apiFetch("/api/v1/tasks", { retry: { maxRetries: 3, baseDelayMs: 200 } });
 */
export async function apiFetch(
  url: string,
  options: RequestInit & { retry?: RetryConfig } = {},
): Promise<Response> {
  const { retry: retryConfig, ...fetchOptions } = options;
  const cfg = { ...DEFAULT_RETRY, ...retryConfig };

  // Never retry mutations — they might have side effects.
  const method = (fetchOptions.method || "GET").toUpperCase();
  const shouldRetry =
    method === "GET" || method === "HEAD" || method === "OPTIONS";

  let lastError: unknown;

  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    try {
      const response = await _fetch(url, fetchOptions);

      // If it's a retryable status and we have retries left, retry.
      if (
        attempt < cfg.maxRetries &&
        shouldRetry &&
        RETRYABLE_STATUSES.has(response.status)
      ) {
        const delay = backoffDelay(attempt, cfg.baseDelayMs, cfg.maxDelayMs);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      return response;
    } catch (err) {
      lastError = err;
      // Network errors (TypeError from fetch) are always retryable for safe methods.
      if (attempt < cfg.maxRetries && shouldRetry) {
        const delay = backoffDelay(attempt, cfg.baseDelayMs, cfg.maxDelayMs);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
    }
  }

  throw lastError;
}