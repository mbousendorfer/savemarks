import { describe, expect, it } from "vitest";
import {
  bookmarkIdentity,
  normalizeUrl,
  normalizedBookmarkSchema,
  redactSecrets,
} from "../src";

describe("shared contracts", () => {
  it("normalizes URLs and removes tracking", () => {
    expect(
      normalizeUrl("https://X.com/alice/status/1/?utm_source=test&t=secret"),
    ).toBe("https://x.com/alice/status/1");
  });

  it("creates stable deduplication identities", () => {
    expect(bookmarkIdentity("x", "123")).toBe("x:123");
  });

  it("redacts secret keys and embedded cookie values", () => {
    expect(
      redactSecrets({
        headers: { authorization: "Bearer secret", accept: "json" },
        note: "sessionid=private",
      }),
    ).toEqual({
      headers: { authorization: "[REDACTED]", accept: "json" },
      note: "[REDACTED]",
    });
  });

  it("rejects malformed normalized bookmarks", () => {
    expect(
      normalizedBookmarkSchema.safeParse({
        source: "x",
        sourceItemId: "",
      }).success,
    ).toBe(false);
  });
});
