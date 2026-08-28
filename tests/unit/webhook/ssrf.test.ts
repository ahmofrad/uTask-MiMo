import { describe, it, expect } from "vitest";
import { isPrivateIp, validateWebhookUrl } from "@/lib/webhook/ssrf";

describe("SSRF deny-list", () => {
  describe("isPrivateIp", () => {
    it("blocks 10.x.x.x private range", () => {
      expect(isPrivateIp("10.0.0.1")).toBe(true);
      expect(isPrivateIp("10.255.255.255")).toBe(true);
    });

    it("blocks 172.16.x.x private range", () => {
      expect(isPrivateIp("172.16.0.1")).toBe(true);
      expect(isPrivateIp("172.31.255.255")).toBe(true);
    });

    it("blocks 192.168.x.x private range", () => {
      expect(isPrivateIp("192.168.0.1")).toBe(true);
      expect(isPrivateIp("192.168.100.200")).toBe(true);
    });

    it("blocks loopback 127.x.x.x", () => {
      expect(isPrivateIp("127.0.0.1")).toBe(true);
      expect(isPrivateIp("127.255.255.255")).toBe(true);
    });

    it("blocks link-local 169.254.x.x", () => {
      expect(isPrivateIp("169.254.0.1")).toBe(true);
      expect(isPrivateIp("169.254.169.254")).toBe(true);
    });

    it("blocks 0.0.0.0", () => {
      expect(isPrivateIp("0.0.0.0")).toBe(true);
    });

    it("blocks IPv6 loopback ::1", () => {
      expect(isPrivateIp("::1")).toBe(true);
    });

    it("blocks IPv6 link-local fe80::", () => {
      expect(isPrivateIp("fe80::1")).toBe(true);
    });

    it("blocks IPv6 ULA fc00::", () => {
      expect(isPrivateIp("fc00::1")).toBe(true);
    });

    it("blocks IPv4-mapped IPv6 ::ffff:127.0.0.1", () => {
      expect(isPrivateIp("::ffff:127.0.0.1")).toBe(true);
    });

    it("allows public IPs", () => {
      expect(isPrivateIp("8.8.8.8")).toBe(false);
      expect(isPrivateIp("1.1.1.1")).toBe(false);
      expect(isPrivateIp("93.184.216.34")).toBe(false);
    });

    it("allows public IPv6", () => {
      expect(isPrivateIp("2001:4860:4860::8888")).toBe(false);
    });
  });

  describe("validateWebhookUrl", () => {
    it("allows valid public HTTPS URLs", () => {
      expect(validateWebhookUrl("https://hooks.example.com/webhook")).toBe(true);
      expect(validateWebhookUrl("https://api.slack.com/incoming")).toBe(true);
    });

    it("rejects HTTP URLs (HTTPS only)", () => {
      expect(validateWebhookUrl("http://hooks.example.com/webhook")).toBe(false);
    });

    it("rejects localhost", () => {
      expect(validateWebhookUrl("https://localhost/webhook")).toBe(false);
      expect(validateWebhookUrl("https://localhost:8080/webhook")).toBe(false);
    });

    it("rejects .local domains", () => {
      expect(validateWebhookUrl("https://myhost.local/webhook")).toBe(false);
    });

    it("rejects .internal domains", () => {
      expect(validateWebhookUrl("https://myhost.internal/webhook")).toBe(false);
    });

    it("rejects private IP addresses", () => {
      expect(validateWebhookUrl("https://10.0.0.1/webhook")).toBe(false);
      expect(validateWebhookUrl("https://192.168.1.1/webhook")).toBe(false);
      expect(validateWebhookUrl("https://127.0.0.1/webhook")).toBe(false);
    });

    it("rejects invalid URLs", () => {
      expect(validateWebhookUrl("not-a-url")).toBe(false);
      expect(validateWebhookUrl("")).toBe(false);
      expect(validateWebhookUrl("ftp://hooks.example.com/webhook")).toBe(false);
    });
  });
});
