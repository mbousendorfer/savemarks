import { describe, expect, it } from "vitest";
import { isPublicAddress, pinnedLookupResult } from "./public-fetch";

describe("public fetch address policy", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "172.16.0.1",
    "192.168.1.20",
    "169.254.169.254",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
  ])("blocks private address %s", (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it.each(["1.1.1.1", "8.8.8.8", "2606:4700:4700::1111"])(
    "allows public address %s",
    (address) => {
      expect(isPublicAddress(address)).toBe(true);
    },
  );
});

describe("pinned DNS lookup", () => {
  const pinned = { address: "203.0.113.10", family: 4 as const };

  it("returns the address list expected by Node when all results are requested", () => {
    expect(pinnedLookupResult(pinned, true)).toEqual([pinned]);
  });

  it("returns one address for the legacy lookup callback", () => {
    expect(pinnedLookupResult(pinned, false)).toEqual(pinned);
  });
});
