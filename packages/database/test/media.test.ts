import { describe, expect, it } from "vitest";
import { contentAddressedPath, resolveMediaPath, sha256 } from "../src/media";

describe("content-addressed media storage", () => {
  it("hashes bytes and builds a sharded path", () => {
    const hash = sha256(new TextEncoder().encode("image"));
    expect(contentAddressedPath(hash, "image/jpeg")).toBe(
      `${hash.slice(0, 2)}/${hash}.jpg`,
    );
  });

  it("blocks path traversal", () => {
    expect(() => resolveMediaPath("/data/media", "../../secret.jpg")).toThrow(
      "traversal",
    );
  });
});
