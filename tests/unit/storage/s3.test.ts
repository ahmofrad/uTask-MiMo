import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn(),
}));

vi.mock("@aws-sdk/client-s3", () => {
  class FakeCommand {
    input: Record<string, unknown>;
    constructor(input: Record<string, unknown>) { this.input = input; }
  }
  return {
    PutObjectCommand: FakeCommand,
    DeleteObjectCommand: FakeCommand,
    GetObjectCommand: FakeCommand,
    HeadBucketCommand: FakeCommand,
    CreateBucketCommand: FakeCommand,
  };
});

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn().mockResolvedValue("https://s3.example.com/bucket/key?signed=1"),
}));

vi.mock("@/lib/storage/index", () => ({
  getS3Client: vi.fn().mockReturnValue({ send: mockSend }),
  getBucket: vi.fn().mockReturnValue("test-bucket"),
}));

import { putObject } from "@/lib/storage/upload";
import { removeObject } from "@/lib/storage/delete";
import { presignedGet } from "@/lib/storage/download";
import { ensureBucket } from "@/lib/storage/ensure";
import { getS3Client, getBucket } from "@/lib/storage/index";

describe("storage upload", () => {
  beforeEach(() => {
    mockSend.mockReset();
    mockSend.mockResolvedValue({});
  });

  it("calls Send with correct params", async () => {
    await putObject("tasks/abc/file.pdf", Buffer.from("data"), "application/pdf");
    expect(getS3Client().send).toHaveBeenCalledTimes(1);
    expect(getBucket).toHaveBeenCalled();
  });
});

describe("storage delete", () => {
  beforeEach(() => {
    mockSend.mockReset();
    mockSend.mockResolvedValue({});
  });

  it("calls Send with correct key", async () => {
    await removeObject("tasks/abc/file.pdf");
    expect(getS3Client().send).toHaveBeenCalledTimes(1);
  });
});

describe("storage download", () => {
  beforeEach(() => {
    mockSend.mockReset();
    mockSend.mockResolvedValue({});
  });

  it("returns a presigned URL", async () => {
    const url = await presignedGet("tasks/abc/file.pdf", 3600);
    expect(url).toContain("https://");
    expect(url).toContain("signed=1");
  });
});

describe("storage ensureBucket", () => {
  beforeEach(() => {
    mockSend.mockReset();
    mockSend.mockResolvedValue({});
  });

  it("does nothing if bucket exists (HeadBucket succeeds)", async () => {
    await ensureBucket();
    expect(mockSend).toHaveBeenCalledTimes(1);
  });
});

describe("storage config validation", () => {
  it("getS3Client returns the mock client", () => {
    const client = getS3Client();
    expect(client).toBeDefined();
    expect(typeof client.send).toBe("function");
  });

  it("getBucket returns the configured bucket", () => {
    expect(getBucket()).toBe("test-bucket");
  });
});
