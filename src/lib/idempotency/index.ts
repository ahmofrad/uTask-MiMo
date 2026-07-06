type IdempotencyEntry = {
  response: { status: number; body: unknown };
  createdAt: number;
};

const store = new Map<string, IdempotencyEntry>();
const TTL_MS = 60 * 60 * 24; // 24 hours

export function checkIdempotency(
  key: string,
): { hit: true; response: { status: number; body: unknown } } | { hit: false } {
  const entry = store.get(key);
  if (entry && Date.now() - entry.createdAt < TTL_MS) {
    return { hit: true, response: entry.response };
  }
  if (entry) store.delete(key);
  return { hit: false };
}

export function setIdempotencyResult(
  key: string,
  status: number,
  body: unknown,
): void {
  store.set(key, { response: { status, body }, createdAt: Date.now() });
}

// Cleanup stale entries every 10 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now - entry.createdAt > TTL_MS) store.delete(key);
    }
  }, 600_000);
}
