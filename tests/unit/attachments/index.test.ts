import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockFindMany, mockFindUnique, mockCreate, mockUpdate, mockDelete,
  mockPutObject, mockRemoveObject, mockPresignedGet, mockLogAudit, mockEmitTaskEvent,
} = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockFindUnique: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockPutObject: vi.fn(),
  mockRemoveObject: vi.fn(),
  mockPresignedGet: vi.fn(),
  mockLogAudit: vi.fn(),
  mockEmitTaskEvent: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    attachment: {
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      create: mockCreate,
      update: mockUpdate,
      delete: mockDelete,
    },
  },
}));

vi.mock("@/lib/storage/upload", () => ({ putObject: mockPutObject }));
vi.mock("@/lib/storage/delete", () => ({ removeObject: mockRemoveObject }));
vi.mock("@/lib/storage/download", () => ({ presignedGet: mockPresignedGet }));
vi.mock("@/lib/audit/log", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/webhook/emit", () => ({ emitTaskEvent: mockEmitTaskEvent }));
vi.mock("@/lib/crypto", () => ({ randomUUID: () => "fixed-uuid" }));

import {
  MAX_FILE_SIZE,
  getAttachmentsByTask,
  getPresignedUrl,
  createAttachment,
  updateAttachment,
  deleteAttachment,
} from "@/lib/attachments";

const attachment = {
  id: "att1",
  taskId: "t1",
  filename: "report.pdf",
  mimeType: "application/pdf",
  sizeBytes: 1024,
  storageKey: "tasks/t1/fixed-uuid-report.pdf",
  uploadedById: "u1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("getAttachmentsByTask", () => {
  it("lists attachments newest first", async () => {
    mockFindMany.mockResolvedValue([attachment]);
    const result = await getAttachmentsByTask("t1");
    expect(result).toHaveLength(1);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { taskId: "t1" }, orderBy: { createdAt: "desc" } }),
    );
  });
});

describe("getPresignedUrl", () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    mockPresignedGet.mockReset();
  });

  it("returns a presigned URL for an attachment of the task", async () => {
    mockFindUnique.mockResolvedValue(attachment);
    mockPresignedGet.mockResolvedValue("https://signed-url");
    const url = await getPresignedUrl("att1", "t1");
    expect(url).toBe("https://signed-url");
    expect(mockPresignedGet).toHaveBeenCalledWith(attachment.storageKey);
  });

  it("returns null when attachment is missing", async () => {
    mockFindUnique.mockResolvedValue(null);
    const url = await getPresignedUrl("nope", "t1");
    expect(url).toBeNull();
  });

  it("returns null when attachment belongs to another task", async () => {
    mockFindUnique.mockResolvedValue(attachment);
    const url = await getPresignedUrl("att1", "t2");
    expect(url).toBeNull();
    expect(mockPresignedGet).not.toHaveBeenCalled();
  });
});

describe("createAttachment", () => {
  beforeEach(() => {
    mockPutObject.mockReset().mockResolvedValue(undefined);
    mockCreate.mockReset().mockResolvedValue(attachment);
    mockLogAudit.mockReset().mockResolvedValue(undefined);
    mockEmitTaskEvent.mockReset().mockResolvedValue(undefined);
  });

  it("uploads, persists, audits and emits", async () => {
    const file = { name: "report.pdf", type: "application/pdf", size: 1024, buffer: Buffer.from("x") };
    const result = await createAttachment("t1", file, "u1");
    expect(mockPutObject).toHaveBeenCalledWith("tasks/t1/fixed-uuid-report.pdf", file.buffer, file.type);
    expect(mockCreate).toHaveBeenCalled();
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: "u1",
      entityType: "attachment",
      after: { taskId: "t1", filename: "report.pdf" },
    }));
    expect(mockEmitTaskEvent).toHaveBeenCalledWith(
      "attachment.created",
      "t1",
      expect.objectContaining({ filename: "report.pdf" }),
      "u1",
    );
    expect(result).toEqual(attachment);
  });

  it("rejects files over 25 MB", async () => {
    const file = { name: "big.bin", type: "application/octet-stream", size: MAX_FILE_SIZE + 1, buffer: Buffer.from("x") };
    await expect(createAttachment("t1", file, "u1")).rejects.toThrow("25 MB");
    expect(mockPutObject).not.toHaveBeenCalled();
  });
});

describe("updateAttachment", () => {
  beforeEach(() => {
    mockFindUnique.mockReset().mockResolvedValue({ id: "att1", taskId: "t1", filename: "old.pdf" });
    mockUpdate.mockReset().mockResolvedValue({ ...attachment, filename: "new.pdf" });
    mockLogAudit.mockReset().mockResolvedValue(undefined);
    mockEmitTaskEvent.mockReset().mockResolvedValue(undefined);
  });

  it("renames, audits before/after and emits", async () => {
    const result = await updateAttachment("att1", "t1", "u1", { name: "new.pdf" });
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { filename: "new.pdf" } }));
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      before: { taskId: "t1", filename: "old.pdf" },
      after: { taskId: "t1", filename: "new.pdf" },
    }));
    expect(mockEmitTaskEvent).toHaveBeenCalledWith("attachment.updated", "t1", expect.any(Object), "u1");
    expect(result.filename).toBe("new.pdf");
  });

  it("throws when attachment belongs to another task", async () => {
    await expect(updateAttachment("att1", "t2", "u1", { name: "x.pdf" })).rejects.toThrow("not found");
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("deleteAttachment", () => {
  beforeEach(() => {
    mockFindUnique.mockReset().mockResolvedValue({ id: "att1", storageKey: "tasks/t1/key", filename: "old.pdf", taskId: "t1" });
    mockRemoveObject.mockReset().mockResolvedValue(undefined);
    mockDelete.mockReset().mockResolvedValue({});
    mockLogAudit.mockReset().mockResolvedValue(undefined);
    mockEmitTaskEvent.mockReset().mockResolvedValue(undefined);
  });

  it("removes storage, deletes row, audits and emits", async () => {
    await deleteAttachment("att1", "t1", "u1");
    expect(mockRemoveObject).toHaveBeenCalledWith("tasks/t1/key");
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "att1" } });
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "deleted",
      entityId: "att1",
      before: { taskId: "t1", filename: "old.pdf" },
    }));
    expect(mockEmitTaskEvent).toHaveBeenCalledWith("attachment.deleted", "t1", expect.any(Object), "u1");
  });

  it("throws when attachment is missing", async () => {
    mockFindUnique.mockResolvedValue(null);
    await expect(deleteAttachment("nope", "t1", "u1")).rejects.toThrow("not found");
    expect(mockRemoveObject).not.toHaveBeenCalled();
  });
});