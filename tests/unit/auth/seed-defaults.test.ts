import { describe, expect, it } from "vitest";
import { LOCAL_SEED_PASSWORD } from "@/lib/auth/seed-defaults";

describe("local seed defaults", () => {
  it("uses password as the local-only seed password", () => {
    expect(LOCAL_SEED_PASSWORD).toBe("password");
  });
});
