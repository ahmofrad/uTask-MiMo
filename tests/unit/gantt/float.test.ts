import { describe, it, expect } from "vitest";
import { formatFloatDays } from "@/lib/gantt/float";

describe("formatFloatDays", () => {
  it("formats zero float as 0d", () => {
    expect(formatFloatDays(0)).toBe("0d");
    expect(formatFloatDays(-0)).toBe("0d");
  });

  it("prefixes positive float with a plus sign", () => {
    expect(formatFloatDays(2)).toBe("+2d");
    expect(formatFloatDays(1.5)).toBe("+1.5d");
  });

  it("keeps the minus sign on negative float", () => {
    expect(formatFloatDays(-3)).toBe("-3d");
    expect(formatFloatDays(-1.5)).toBe("-1.5d");
  });

  it("rounds sub-day floats to one decimal", () => {
    // A sub-day float rounds to zero — displayed as on the critical path.
    expect(formatFloatDays(0.04)).toBe("0d");
    expect(formatFloatDays(0.45)).toBe("+0.5d");
    expect(formatFloatDays(-0.26)).toBe("-0.3d");
  });
});
