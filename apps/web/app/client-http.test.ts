import { describe, expect, it, vi } from "vitest";
import { fetchJson, responseErrorMessage } from "./client-http";

describe("client HTTP helpers", () => {
  it("uses the server error when it is safe to display", async () => {
    const response = Response.json(
      { error: "Origin not allowed" },
      { status: 403 },
    );
    await expect(responseErrorMessage(response, "Failed")).resolves.toBe(
      "Origin not allowed",
    );
  });

  it("uses a fallback for non-JSON errors", async () => {
    const response = new Response("upstream error", { status: 502 });
    await expect(responseErrorMessage(response, "Failed")).resolves.toBe(
      "Failed",
    );
  });

  it("reports connection failures consistently", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(fetchJson("/api/test", undefined, "Failed")).rejects.toThrow(
      "SaveMarks could not reach the server.",
    );
    vi.unstubAllGlobals();
  });
});
