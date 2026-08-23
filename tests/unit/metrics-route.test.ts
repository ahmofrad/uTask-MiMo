import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockMetrics } = vi.hoisted(() => ({ mockMetrics: vi.fn() }));

vi.mock("prom-client", () => ({
  register: {
    metrics: mockMetrics,
    contentType: "text/plain; version=0.0.4",
  },
}));

import { GET } from "@/app/metrics/route";

describe("GET /metrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.METRICS_AUTH_TOKEN;
    mockMetrics.mockResolvedValue("taskapp_up 1\n");
  });

  it("serves metrics when no token is configured", async () => {
    const response = await GET(new Request("http://localhost/metrics"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(await response.text()).toBe("taskapp_up 1\n");
  });

  it("rejects requests with a missing or invalid bearer token", async () => {
    process.env.METRICS_AUTH_TOKEN = "metrics-secret";

    const missing = await GET(new Request("http://localhost/metrics"));
    const invalid = await GET(new Request("http://localhost/metrics", {
      headers: { Authorization: "Bearer wrong-secret" },
    }));

    expect(missing.status).toBe(401);
    expect(invalid.status).toBe(401);
    expect(missing.headers.get("www-authenticate")).toBe("Bearer");
    expect(mockMetrics).not.toHaveBeenCalled();
  });

  it("accepts the configured bearer token", async () => {
    process.env.METRICS_AUTH_TOKEN = "metrics-secret";

    const response = await GET(new Request("http://localhost/metrics", {
      headers: { Authorization: "Bearer metrics-secret" },
    }));

    expect(response.status).toBe(200);
    expect(mockMetrics).toHaveBeenCalledOnce();
  });
});
