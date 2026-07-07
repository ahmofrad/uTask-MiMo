type IdempotencyEntry = {
  response: { status: number; body: unknown };
  createdAt: number;
};

const store = new Map<string, IdempotencyEntry>();
const TTL_MS = 60 * 60 * 24; // 24 hours
const MAX_STORE_SIZE = 50_000;
const pending = new Set<string>();

function evictOldest() {
  let oldestKey: string | null = null;
  let oldestTime = Infinity;
  for (const [key, entry] of store) {
    if (entry.createdAt < oldestTime) {
      oldestTime = entry.createdAt;
      oldestKey = key;
    }
  }
  if (oldestKey) store.delete(oldestKey);
}

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
  if (store.size >= MAX_STORE_SIZE) evictOldest();
  store.set(key, { response: { status, body }, createdAt: Date.now() });
  pending.delete(key);
}

/** Returns true if this key is currently being processed (prevents duplicate concurrent writes). */
export function acquirePending(key: string): boolean {
  if (pending.has(key)) return false;
  pending.add(key);
  return true;
}

export function releasePending(key: string): void {
  pending.delete(key);
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
