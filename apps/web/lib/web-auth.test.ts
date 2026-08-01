import { afterEach, describe, expect, it } from "vitest";
import { validBasicAuthorization, webCredentialsConfigured } from "./web-auth";

const previousUsername = process.env.SAVEMARKS_WEB_USERNAME;
const previousPassword = process.env.SAVEMARKS_WEB_PASSWORD;

afterEach(() => {
  process.env.SAVEMARKS_WEB_USERNAME = previousUsername;
  process.env.SAVEMARKS_WEB_PASSWORD = previousPassword;
});

describe("web authentication", () => {
  it("requires both credentials", () => {
    process.env.SAVEMARKS_WEB_USERNAME = "savemarks";
    delete process.env.SAVEMARKS_WEB_PASSWORD;
    expect(webCredentialsConfigured()).toBe(false);
  });

  it("accepts only the configured basic credentials", () => {
    process.env.SAVEMARKS_WEB_USERNAME = "savemarks";
    process.env.SAVEMARKS_WEB_PASSWORD = "a-long-password";
    const valid = `Basic ${btoa("savemarks:a-long-password")}`;
    const invalid = `Basic ${btoa("savemarks:wrong")}`;
    expect(validBasicAuthorization(valid)).toBe(true);
    expect(validBasicAuthorization(invalid)).toBe(false);
    expect(validBasicAuthorization(null)).toBe(false);
  });
});
