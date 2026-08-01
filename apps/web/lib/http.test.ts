import { describe, expect, it } from "vitest";
import { readJson } from "./http";

describe("readJson", () => {
  it("parses a bounded JSON request", async () => {
    const result = await readJson(
      new Request("http://localhost", { method: "POST", body: '{"ok":true}' }),
    );
    expect(result).toEqual({ ok: true, value: { ok: true } });
  });

  it("returns 400 for malformed JSON", async () => {
    const result = await readJson(
      new Request("http://localhost", { method: "POST", body: "{" }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(400);
  });

  it("returns 413 when the body is too large", async () => {
    const result = await readJson(
      new Request("http://localhost", { method: "POST", body: "12345" }),
      4,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(413);
  });
});
