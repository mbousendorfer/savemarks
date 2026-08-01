import { afterEach, describe, expect, it } from "vitest";
import { isSameOriginRequest } from "./request-origin";

const previousBaseUrl = process.env.SAVEMARKS_BASE_URL;

afterEach(() => {
  if (previousBaseUrl === undefined) delete process.env.SAVEMARKS_BASE_URL;
  else process.env.SAVEMARKS_BASE_URL = previousBaseUrl;
});

function request(
  origin?: string,
  forwarded?: { host: string; protocol: string },
) {
  const headers = new Headers();
  if (origin) headers.set("origin", origin);
  if (forwarded) {
    headers.set("x-forwarded-host", forwarded.host);
    headers.set("x-forwarded-proto", forwarded.protocol);
  }
  return new Request("http://web:3210/api/read-later", { headers });
}

describe("isSameOriginRequest", () => {
  it("allows non-browser requests without an Origin header", () => {
    expect(isSameOriginRequest(request())).toBe(true);
  });

  it("allows the direct request origin", () => {
    expect(isSameOriginRequest(request("http://web:3210"))).toBe(true);
  });

  it("allows the configured public base URL", () => {
    process.env.SAVEMARKS_BASE_URL = "https://marks.example.com/path";
    expect(isSameOriginRequest(request("https://marks.example.com"))).toBe(
      true,
    );
  });

  it("allows the origin supplied by a reverse proxy", () => {
    expect(
      isSameOriginRequest(
        request("https://marks.example.com", {
          host: "marks.example.com",
          protocol: "https",
        }),
      ),
    ).toBe(true);
  });

  it("rejects unrelated and malformed origins", () => {
    process.env.SAVEMARKS_BASE_URL = "javascript:alert(1)";
    expect(isSameOriginRequest(request("https://evil.example"))).toBe(false);
  });
});
