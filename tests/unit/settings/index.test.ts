import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    settings: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    $transaction: vi.fn((ops) => Promise.all(ops)),
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
  it("upserts each key-value pair", async () => {
    vi.mocked(prisma.settings.upsert).mockResolvedValue({} as never);

    await updateSettings("org", "smtp", {
      host: "smtp.example.com",
      port: 587,
    });

    expect(prisma.settings.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});
