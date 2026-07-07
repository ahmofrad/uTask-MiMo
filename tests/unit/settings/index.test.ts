import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    settings: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      upsert: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn({
        settings: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({}),
          update: vi.fn().mockResolvedValue({}),
          upsert: vi.fn().mockResolvedValue({}),
        },
      });
    }),
  },
}));

import { prisma } from "@/lib/db";
import { getSettings, updateSettings } from "@/lib/settings";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getSettings", () => {
  it("returns key-value map from settings", async () => {
    vi.mocked(prisma.settings.findMany).mockResolvedValue([
      { key: "host", valueJson: "smtp.example.com" },
      { key: "port", valueJson: 587 },
    ] as never);

    const result = await getSettings("org", "smtp");

    expect(result).toEqual({
      host: "smtp.example.com",
      port: 587,
    });
  });

  it("returns empty object when no settings exist", async () => {
    vi.mocked(prisma.settings.findMany).mockResolvedValue([]);

    const result = await getSettings("org", "smtp");

    expect(result).toEqual({});
  });
});

describe("updateSettings", () => {
  it("calls $transaction with callback", async () => {
    await updateSettings("org", "smtp", {
      host: "smtp.example.com",
      port: 587,
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(typeof prisma.$transaction.mock.calls[0]![0]).toBe("function");
  });

  it("uses upsert for non-null scopeId", async () => {
    const mockTx = {
      settings: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
        upsert: vi.fn().mockResolvedValue({}),
      },
    };
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn(mockTx);
    });

    await updateSettings("user", "user-1", { theme: "dark" });

    expect(mockTx.settings.upsert).toHaveBeenCalledTimes(1);
  });
});
