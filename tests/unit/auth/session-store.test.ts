import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();
const sets = new Map<string, Set<string>>();

const redis = {
  get: vi.fn(async (key: string) => store.get(key) ?? null),
  set: vi.fn(async (key: string, value: string, _mode?: string, _ttl?: number) => {
    store.set(key, value);
  }),
  del: vi.fn(async (key: string) => {
    store.delete(key);
  }),
  sadd: vi.fn(async (setKey: string, member: string) => {
    if (!sets.has(setKey)) sets.set(setKey, new Set());
    sets.get(setKey)!.add(member);
  }),
  srem: vi.fn(async (setKey: string, member: string) => {
    sets.get(setKey)?.delete(member);
  }),
  smembers: vi.fn(async (setKey: string) => [...(sets.get(setKey) ?? [])]),
  multi: vi.fn(() => {
    const ops: Array<[string, ...string[]]> = [];
    return {
      get: (k: string) => ops.push(["get", k]),
      set: (k: string, v: string, _mode?: string, _ttl?: number) => ops.push(["set", k, v]),
      del: (k: string) => ops.push(["del", k]),
      exec: async () => {
        const results: Array<[null, string | null]> = [];
        for (const [cmd, ...args] of ops) {
          if (cmd === "get") {
            results.push([null, store.get(args[0]!) ?? null]);
          } else if (cmd === "set") {
            store.set(args[0]!, args[1]!);
            results.push([null, "OK"]);
          } else if (cmd === "del") {
            store.delete(args[0]!);
            results.push([null, 1]);
          }
        }
        return results;
      },
    };
  }),
};

vi.mock("@/lib/redis", () => ({ getRedis: vi.fn(async () => redis) }));

import {
  createSession,
  getSession,
  listUserSessions,
  revokeAllUserSessions,
  revokeSession,
} from "@/lib/auth/session-store";

describe("session-store", () => {
  beforeEach(() => {
    store.clear();
    sets.clear();
    vi.clearAllMocks();
  });

  it("creates a session and retrieves it", async () => {
    const id = await createSession("u1", "a@b.com", "admin");
    const data = await getSession(id);
    expect(data).not.toBeNull();
    expect(data!.userId).toBe("u1");
    expect(data!.email).toBe("a@b.com");
    expect(data!.role).toBe("admin");
    expect(data!.revoked).toBe(false);
    expect(typeof data!.createdAt).toBe("number");
    expect(typeof data!.lastUsedAt).toBe("number");
  });

  it("updates lastUsedAt on every get (sliding extension)", async () => {
    const id = await createSession("u1", "a@b.com", "member");
    const first = await getSession(id);
    expect(first).not.toBeNull();

    // Set lastUsedAt way back — well within idle TTL so getSession still succeeds.
    const backdated = { ...first!, lastUsedAt: first!.lastUsedAt - 10_000 };
    store.set(`session:${id}`, JSON.stringify(backdated));

    const second = await getSession(id);
    expect(second).not.toBeNull();
    // lastUsedAt bumped forward by getSession
    expect(second!.lastUsedAt).toBeGreaterThan(backdated.lastUsedAt);
  });

  it("returns null for a non-existent session", async () => {
    expect(await getSession("nope")).toBeNull();
  });

  it("returns null for a revoked session", async () => {
    const id = await createSession("u1", "a@b.com", "admin");
    await revokeSession(id);
    expect(await getSession(id)).toBeNull();
  });

  it("returns null when idle timeout is exceeded", async () => {
    const id = await createSession("u1", "a@b.com", "member");
    const data = await getSession(id);
    expect(data).not.toBeNull();

    // backdate lastUsedAt beyond idle TTL (30 min = 1_800_000 ms)
    data!.lastUsedAt = Date.now() - 31 * 60 * 1000;
    store.set(`session:${id}`, JSON.stringify(data));

    expect(await getSession(id)).toBeNull();
  });

  it("returns null when absolute timeout is exceeded", async () => {
    const id = await createSession("u1", "a@b.com", "member");
    const data = await getSession(id);
    expect(data).not.toBeNull();

    // backdate createdAt beyond absolute TTL (12 h = 43_200_000 ms)
    data!.createdAt = Date.now() - 13 * 60 * 60 * 1000;
    store.set(`session:${id}`, JSON.stringify(data));

    expect(await getSession(id)).toBeNull();
  });

  it("revokeAllUserSessions revokes all of a user's sessions", async () => {
    const id1 = await createSession("u1", "a@b.com", "admin");
    const id2 = await createSession("u1", "a@b.com", "admin");
    const id3 = await createSession("u2", "c@d.com", "member");

    await revokeAllUserSessions("u1");

    expect(await getSession(id1)).toBeNull();
    expect(await getSession(id2)).toBeNull();
    expect(await getSession(id3)).not.toBeNull();
  });

  it("does not touch other users on revokeAllUserSessions", async () => {
    const id1 = await createSession("u1", "a@b.com", "admin");
    const id2 = await createSession("u2", "c@d.com", "member");

    await revokeAllUserSessions("u1");

    expect(await getSession(id1)).toBeNull();
    expect(await getSession(id2)).not.toBeNull();
    expect((await getSession(id2))!.userId).toBe("u2");
  });

  it("listUserSessions returns active sessions sorted by lastUsedAt", async () => {
    const id1 = await createSession("u1", "a@b.com", "admin");
    // backdate id1 so id2 is the most-recently-used
    const data1 = await getSession(id1);
    data1!.lastUsedAt = Date.now() - 60_000;
    store.set(`session:${id1}`, JSON.stringify(data1));

    const id2 = await createSession("u1", "a@b.com", "admin");

    const list = await listUserSessions("u1");
    expect(list).toHaveLength(2);
    expect(list[0]!.id).toBe(id2); // most recent first
    expect(list[1]!.id).toBe(id1);
  });

  it("listUserSessions excludes revoked sessions", async () => {
    await createSession("u1", "a@b.com", "admin");
    const id2 = await createSession("u1", "a@b.com", "admin");
    await revokeSession(id2);
    const list = await listUserSessions("u1");
    expect(list).toHaveLength(1);
    expect(list[0]!.revoked).toBe(false);
  });

  it("listUserSessions excludes sessions with expired idle timeout", async () => {
    const id = await createSession("u1", "a@b.com", "member");
    const data = await getSession(id);
    data!.lastUsedAt = Date.now() - 31 * 60 * 1000;
    store.set(`session:${id}`, JSON.stringify(data));
    const list = await listUserSessions("u1");
    expect(list).toHaveLength(0);
  });
});