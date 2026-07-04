import { describe, it, expect } from "vitest";
import {
  parsePaginationParams,
  buildPaginatedMeta,
} from "@/lib/db/pagination";

describe("parsePaginationParams", () => {
  it("returns default values when no params given", () => {
    const result = parsePaginationParams({});
    expect(result.take).toBe(51); // limit + 1
    expect(result.skip).toBe(0);
    expect(result.cursor).toBeUndefined();
    expect(result.limit).toBe(50);
  });

  it("uses provided limit within bounds", () => {
    const result = parsePaginationParams({ limit: 20 });
    expect(result.take).toBe(21);
    expect(result.limit).toBe(20);
  });

  it("caps limit at MAX_PAGE_LIMIT", () => {
    const result = parsePaginationParams({ limit: 999 });
    expect(result.limit).toBe(200);
    expect(result.take).toBe(201);
  });

  it("enforces minimum limit of 1", () => {
    const result = parsePaginationParams({ limit: 0 });
    expect(result.limit).toBe(1);
    expect(result.take).toBe(2);
  });

  it("sets cursor when provided", () => {
    const result = parsePaginationParams({ cursor: "abc-123" });
    expect(result.cursor).toEqual({ id: "abc-123" });
    expect(result.skip).toBe(1);
  });
});

describe("buildPaginatedMeta", () => {
  it("returns no nextCursor when items <= limit", () => {
    const items = [{ id: "1" }, { id: "2" }];
    const result = buildPaginatedMeta(items, 5);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
    expect(items).toHaveLength(2);
  });

  it("returns nextCursor and pops extra when items > limit", () => {
    const items = [{ id: "1" }, { id: "2" }, { id: "3" }];
    const result = buildPaginatedMeta(items, 2);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe("2");
    expect(items).toHaveLength(2);
  });

  it("handles empty array", () => {
    const items: { id: string }[] = [];
    const result = buildPaginatedMeta(items, 10);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it("handles single item within limit", () => {
    const items = [{ id: "single" }];
    const result = buildPaginatedMeta(items, 5);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
    expect(items).toHaveLength(1);
  });
});
