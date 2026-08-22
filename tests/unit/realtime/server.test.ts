import { describe, it, expect, vi, beforeEach } from "vitest";

const mockEmit = vi.fn();

vi.mock("next-auth/jwt", () => ({ decode: vi.fn() }));
vi.mock("@/lib/auth/session-store", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/logging", () => ({ logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/db", () => ({ prisma: { user: { findUnique: vi.fn() } } }));
vi.mock("@/lib/rbac", () => ({ canReadProject: vi.fn().mockResolvedValue(true), canReadTask: vi.fn().mockResolvedValue(true) }));
vi.mock("ioredis", () => ({ default: class {} }));
vi.mock("@socket.io/redis-adapter", () => ({ createAdapter: () => () => {} }));
vi.mock("@/lib/queue/connection", () => ({ waitForRedisReady: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/redis/config", () => ({ getRedisConnectionOptions: () => "redis://localhost:6379" }));

import { emitToUser, emitToProject, emitToTask, getIO } from "@/lib/realtime/server";

const GLOBAL_KEY = "__taskapp_socketio__";

function stubIO() {
  Object.defineProperty(globalThis, GLOBAL_KEY, {
    value: { to: vi.fn().mockReturnValue({ emit: mockEmit }) },
    writable: true,
    configurable: true,
  });
}

function clearIO() {
  delete (globalThis as Record<string, unknown>)[GLOBAL_KEY];
}

describe("realtime emit helpers", () => {
  beforeEach(() => {
    clearIO();
    mockEmit.mockReset();
  });

  it("emits to user room with requestId", () => {
    stubIO();
    emitToUser("u1", "event", { data: 1 });
    expect(mockEmit).toHaveBeenCalledWith("event", expect.objectContaining({ data: 1, requestId: expect.any(String) }));
  });

  it("emits to project room with requestId", () => {
    stubIO();
    emitToProject("p1", "event", { data: 2 });
    expect(mockEmit).toHaveBeenCalledWith("event", expect.objectContaining({ data: 2, requestId: expect.any(String) }));
  });

  it("emits to task room with requestId", () => {
    stubIO();
    emitToTask("t1", "event", { data: 3 });
    expect(mockEmit).toHaveBeenCalledWith("event", expect.objectContaining({ data: 3, requestId: expect.any(String) }));
  });

  it("preserves an existing requestId on emit", () => {
    stubIO();
    emitToUser("u1", "event", { requestId: "req-123" });
    expect(mockEmit).toHaveBeenCalledWith("event", expect.objectContaining({ requestId: "req-123" }));
  });

  it("wraps non-object payloads with requestId", () => {
    stubIO();
    emitToTask("t1", "event", "plain");
    const emitted = mockEmit.mock.calls[0]![1] as Record<string, unknown>;
    expect(emitted.data).toBe("plain");
    expect(typeof emitted.requestId).toBe("string");
  });

  it("does not throw when io is uninitialized", () => {
    expect(() => emitToUser("u1", "e", {})).not.toThrow();
    expect(() => emitToProject("p1", "e", {})).not.toThrow();
    expect(() => emitToTask("t1", "e", {})).not.toThrow();
    expect(getIO()).toBeNull();
  });
});