import { describe, it, expect } from "vitest";
import { parseMentions } from "@/lib/mentions";

describe("parseMentions", () => {
  it("finds @username mentions in plain text", () => {
    const result = parseMentions("Hello @alice, check this");
    expect(result).toHaveLength(1);
    expect(result[0]?.text).toBe("alice");
  });

  it("finds multiple mentions", () => {
    const result = parseMentions("@alice and @bob should review");
    expect(result).toHaveLength(2);
  });

  it("finds markdown-style mentions @[Name](userId)", () => {
    const result = parseMentions("Hey @[Alice Johnson](user-123)!");
    expect(result).toHaveLength(1);
    expect(result[0]?.text).toBe("Alice Johnson");
    expect(result[0]?.userId).toBe("user-123");
  });

  it("returns empty for no mentions", () => {
    const result = parseMentions("Just a normal message");
    expect(result).toHaveLength(0);
  });

  it("handles mixed mention styles", () => {
    const result = parseMentions("@alice and @[Bob](user-42)");
    expect(result).toHaveLength(2);
  });
});
