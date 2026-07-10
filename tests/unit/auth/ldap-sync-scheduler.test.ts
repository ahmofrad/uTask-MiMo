import { describe, it, expect } from "vitest";
import { startLdapSyncScheduler, stopLdapSyncScheduler } from "@/lib/auth/ldap-sync-scheduler";

describe("ldap sync scheduler", () => {
  it("starts and stops without throwing", () => {
    expect(() => {
      startLdapSyncScheduler();
      startLdapSyncScheduler(); // idempotent
      stopLdapSyncScheduler();
    }).not.toThrow();
  });
});
