import { describe, expect, it } from "vitest";
import { parseSettings } from "./settings";

describe("extension settings", () => {
  it("applies safe defaults to an empty profile", () => {
    expect(parseSettings({})).toEqual({
      diagnosticsEnabled: false,
      syncEnabled: true,
      syncIntervalMinutes: 15,
    });
  });

  it("recovers from corrupt legacy values without crashing the worker", () => {
    expect(
      parseSettings({
        serverUrl: "not a URL",
        apiToken: "short",
        diagnosticsEnabled: "yes",
        syncEnabled: null,
        syncIntervalMinutes: -1,
        lastSuccessfulSync: "yesterday",
      }),
    ).toEqual({
      diagnosticsEnabled: false,
      syncEnabled: true,
      syncIntervalMinutes: 15,
    });
  });
});
