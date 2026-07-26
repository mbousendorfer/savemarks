import { describe, expect, it } from "vitest";
import {
  captureTemplate,
  cursorPaths,
  extractCursor,
  fieldPaths,
  sanitizeUrl,
} from "../src";

describe("extraction diagnostics", () => {
  it("ignores all hosts outside the explicit source allowlist", () => {
    expect(sanitizeUrl("https://example.com/private")).toBeNull();
    expect(sanitizeUrl("https://x.com.example.com/private")).toBeNull();
  });

  it("redacts sensitive query values", () => {
    expect(sanitizeUrl("https://x.com/path?token=secret&count=20")).toBe(
      "https://x.com/path?token=%5BREDACTED%5D&count=20",
    );
  });

  it("records field names without retaining response values", () => {
    expect(fieldPaths({ data: { page_info: { end_cursor: "private" } } })).toEqual(
      ["data", "data.page_info", "data.page_info.end_cursor"],
    );
    expect(cursorPaths({ data: { next_cursor: "private" } })).toEqual([
      "data.next_cursor",
    ]);
  });

  it("extracts a cursor from an observed nested response", () => {
    expect(extractCursor({ data: { page_info: { end_cursor: "cursor-2" } } })).toBe(
      "cursor-2",
    );
  });

  it("removes authentication material from captured templates", () => {
    const template = captureTemplate("instagram", {
      source: "instagram",
      url: "https://www.instagram.com/observed?session=secret",
      method: "POST",
      headers: { authorization: "Bearer private" },
      body: { variables: { cursor: null }, csrfToken: "private" },
      capturedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(template).toMatchObject({
      body: { variables: { cursor: null }, csrfToken: "[REDACTED]" },
    });
    expect(JSON.stringify(template)).not.toContain("Bearer private");
  });
});
