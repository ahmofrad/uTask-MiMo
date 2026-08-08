import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { waitForRedisReady } from "@/lib/queue/connection";
import { webhookJobId } from "@/lib/queue";

class FakeRedis extends EventEmitter {
  status = "connecting";

  markReady() {
    this.status = "ready";
    this.emit("ready");
  }
}

describe("waitForRedisReady", () => {
  it("waits for a Redis client that is still connecting", async () => {
    const client = new FakeRedis();
    const ready = waitForRedisReady(client, 100);

    client.markReady();

    await expect(ready).resolves.toBeUndefined();
  });

  it("resolves immediately for an already-ready client", async () => {
    const client = new FakeRedis();
    client.status = "ready";

    await expect(waitForRedisReady(client, 100)).resolves.toBeUndefined();
  });

  it("rejects when Redis closes before becoming ready", async () => {
    const client = new FakeRedis();
    const ready = waitForRedisReady(client, 100);

    client.emit("end");

    await expect(ready).rejects.toThrow("Redis connection ended before ready");
  });
});

describe("webhookJobId", () => {
  it("creates deterministic BullMQ-safe IDs without colons", () => {
    const first = webhookJobId("webhook:1", "event:1");
    expect(first).toBe(webhookJobId("webhook:1", "event:1"));
    expect(first).not.toContain(":");
  });
});
