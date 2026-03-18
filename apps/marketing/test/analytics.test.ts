import { describe, expect, test } from "bun:test";
import { DEFAULT_PRIVACY_PREFERENCES, parsePrivacyPreferences } from "../src/analytics";

describe("analytics privacy preferences", () => {
  test("defaults to all optional tracking disabled", () => {
    expect(parsePrivacyPreferences(null)).toEqual(DEFAULT_PRIVACY_PREFERENCES);
  });

  test("keeps only explicit opt-in values", () => {
    expect(parsePrivacyPreferences(JSON.stringify({ analytics: true, marketing: "yes" }))).toEqual({
      analytics: true,
      marketing: false,
    });
  });

  test("falls back safely when storage is malformed", () => {
    expect(parsePrivacyPreferences("{invalid-json")).toEqual(DEFAULT_PRIVACY_PREFERENCES);
  });
});
