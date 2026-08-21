import { describe, expect, it } from "vitest";
import { transitionStatus } from "@/lib/timesheets";
import type { TimesheetTransition } from "@/lib/timesheets";

describe("timesheet transitionStatus", () => {
  it("submits an open period", () => {
    expect(transitionStatus("open", "submit")).toBe("submitted");
  });

  it("resubmits a rejected period", () => {
    expect(transitionStatus("rejected", "submit")).toBe("submitted");
  });

  it("resubmits a reopened period", () => {
    expect(transitionStatus("reopened", "submit")).toBe("submitted");
  });

  it("approves a submitted period", () => {
    expect(transitionStatus("submitted", "approve")).toBe("approved");
  });

  it("rejects a submitted period", () => {
    expect(transitionStatus("submitted", "reject")).toBe("rejected");
  });

  it("reopens an approved period", () => {
    expect(transitionStatus("approved", "reopen")).toBe("reopened");
  });

  it("rejects illegal transitions", () => {
    const illegal: Array<[Parameters<typeof transitionStatus>[0], TimesheetTransition]> = [
      ["open", "approve"],
      ["open", "reject"],
      ["open", "reopen"],
      ["approved", "submit"],
      ["approved", "approve"],
      ["approved", "reject"],
      ["rejected", "approve"],
      ["rejected", "reopen"],
      ["reopened", "reopen"],
    ];
    for (const [status, transition] of illegal) {
      expect(transitionStatus(status, transition)).toBeNull();
    }
  });

  it("is total across every status/transition pair", () => {
    const statuses = ["open", "submitted", "approved", "rejected", "reopened"] as const;
    const transitions: TimesheetTransition[] = ["submit", "approve", "reject", "reopen"];
    for (const status of statuses) {
      for (const transition of transitions) {
        const result = transitionStatus(status, transition);
        expect(result === null || statuses.includes(result as (typeof statuses)[number])).toBe(true);
      }
    }
  });
});
