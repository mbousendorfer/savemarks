import { afterEach, describe, expect, it, vi } from "vitest";
import { corsHeaders, originAllowed } from "./cors";

const extensionId = "abcdefghijklmnopabcdefghijklmnop";
const extensionOrigin = `chrome-extension://${extensionId}`;

function requestFrom(origin: string): Request {
  return new Request("http://localhost:3210/api/pairing/exchange", {
    headers: { origin },
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("extension origins", () => {
  it("allows a valid Chrome extension automatically in local development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SAVEMARKS_ALLOWED_EXTENSION_IDS", "");

    const request = requestFrom(extensionOrigin);

    expect(originAllowed(request)).toBe(true);
    expect(new Headers(corsHeaders(request)).get("Access-Control-Allow-Origin")).toBe(
      extensionOrigin,
    );
  });

  it("still requires an explicit extension ID in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SAVEMARKS_ALLOWED_EXTENSION_IDS", "");

    expect(originAllowed(requestFrom(extensionOrigin))).toBe(false);
  });

  it("allows an explicitly configured extension ID in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SAVEMARKS_ALLOWED_EXTENSION_IDS", extensionId);

    expect(originAllowed(requestFrom(extensionOrigin))).toBe(true);
  });

  it("rejects malformed extension origins in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SAVEMARKS_ALLOWED_EXTENSION_IDS", "");

    expect(originAllowed(requestFrom("chrome-extension://not-an-extension"))).toBe(
      false,
    );
  });
});
