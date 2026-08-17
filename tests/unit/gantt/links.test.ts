import { describe, it, expect } from "vitest";
import { linkShortLabel, linkLagSuffix } from "@/lib/gantt/links";

describe("linkShortLabel", () => {
  it("renders the type abbreviation alone when there is no lag", () => {
    expect(linkShortLabel({ type: "FINISH_TO_START", lag: 0, lagUnit: "DAY" })).toBe("FS");
    expect(linkShortLabel({ type: "START_TO_START", lag: 0, lagUnit: "DAY" })).toBe("SS");
    expect(linkShortLabel({ type: "FINISH_TO_FINISH", lag: 0, lagUnit: "DAY" })).toBe("FF");
    expect(linkShortLabel({ type: "RELATES_TO", lag: 0, lagUnit: "DAY" })).toBe("R");
  });

  it("appends positive and negative lag in day units", () => {
    expect(linkShortLabel({ type: "FINISH_TO_START", lag: 2, lagUnit: "DAY" })).toBe("FS +2d");
    expect(linkShortLabel({ type: "FINISH_TO_START", lag: -3, lagUnit: "DAY" })).toBe("FS -3d");
  });

  it("uses hours for hour-based lag", () => {
    expect(linkShortLabel({ type: "START_TO_START", lag: 4, lagUnit: "HOUR" })).toBe("SS +4h");
  });

  it("falls back to FS for an unknown type", () => {
    expect(linkShortLabel({ type: "BOGUS", lag: 0, lagUnit: "DAY" })).toBe("FS");
  });
});

describe("linkLagSuffix", () => {
  it("is empty when lag is zero", () => {
    expect(linkLagSuffix({ lag: 0, lagUnit: "DAY" })).toBe("");
  });

  it("formats day and hour lags with a leading space", () => {
    expect(linkLagSuffix({ lag: 5, lagUnit: "DAY" })).toBe(" +5d");
    expect(linkLagSuffix({ lag: -1, lagUnit: "DAY" })).toBe(" -1d");
    expect(linkLagSuffix({ lag: 2, lagUnit: "HOUR" })).toBe(" +2h");
  });
});
