export type RedisReadyClient = {
  status: string;
  once(_event: "ready" | "end", _listener: () => void): RedisReadyClient;
  removeListener(_event: "ready" | "end", _listener: () => void): RedisReadyClient;
};

const DEFAULT_TIMEOUT_MS = 10_000;

export function waitForRedisReady(
  client: RedisReadyClient,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<void> {
  if (client.status === "ready") return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      finish(new Error(`Redis did not become ready within ${timeoutMs}ms`));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timeout);
      client.removeListener("ready", onReady);
      client.removeListener("end", onEnd);
    };

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve();
    };

    const onReady = () => finish();
    const onEnd = () => finish(new Error("Redis connection ended before ready"));

    client.once("ready", onReady);
    client.once("end", onEnd);

    if (client.status === "ready") onReady();
  });
}
