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

  it("cancels an unbounded streamed body as soon as it exceeds the limit", async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new TextEncoder().encode("12345"));
      },
      cancel() {
        cancelled = true;
      },
    });
    const result = await readJson(
      new Request("http://localhost", {
        method: "POST",
        body,
        duplex: "half",
      } as RequestInit),
      4,
    );
    expect(result.ok).toBe(false);
    expect(cancelled).toBe(true);
    if (!result.ok) expect(result.response.status).toBe(413);
  });
});
