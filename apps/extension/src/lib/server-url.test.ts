import { describe, expect, it } from "vitest";
import {
  isLocalServerHostname,
  normalizeServerUrl,
  serverOriginPattern,
} from "./server-url";

describe("SaveMarks server URLs", () => {
  it.each([
    "localhost",
    "scarif.local",
    "127.0.0.1",
    "10.0.0.20",
    "172.16.4.2",
    "172.31.255.254",
    "192.168.1.10",
    "[::1]",
    "[fd7a:115c:a1e0::1]",
  ])("recognizes local hostname %s", (hostname) => {
    expect(isLocalServerHostname(hostname)).toBe(true);
  });

  it.each(["example.com", "savemarks.example.com", "172.32.0.1", "8.8.8.8"])(
    "recognizes remote hostname %s",
    (hostname) => {
      expect(isLocalServerHostname(hostname)).toBe(false);
    },
  );

  it("normalizes HTTPS origins used away from home", () => {
    expect(normalizeServerUrl(" https://savemarks.example.com/ ")).toBe(
      "https://savemarks.example.com",
    );
    expect(serverOriginPattern("https://savemarks.example.com")).toBe(
      "https://savemarks.example.com/*",
    );
  });

  it("keeps HTTP available for private LAN servers", () => {
    expect(normalizeServerUrl("http://192.168.1.20:3210")).toBe(
      "http://192.168.1.20:3210",
    );
  });

  it("rejects insecure remote servers", () => {
    expect(() => normalizeServerUrl("http://savemarks.example.com")).toThrow(
      "must use HTTPS",
    );
  });

  it.each([
    "ftp://savemarks.example.com",
    "https://user:secret@savemarks.example.com",
    "https://savemarks.example.com/app",
    "https://savemarks.example.com/?token=secret",
  ])("rejects unsafe or unsupported URL %s", (value) => {
    expect(() => normalizeServerUrl(value)).toThrow();
  });
});
