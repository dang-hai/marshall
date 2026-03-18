import { describe, expect, test } from "bun:test";
import { defaultAppSettings } from "../src/shared/settings";
import { buildSectionUpdate } from "../src/renderer/src/hooks/useSettings";

describe("useSettings helpers", () => {
  test("buildSectionUpdate merges a partial section update", () => {
    const result = buildSectionUpdate(defaultAppSettings, "audio", {
      source: "system",
      vadEnabled: false,
    });

    expect(result).toEqual({
      audio: {
        ...defaultAppSettings.audio,
        source: "system",
        vadEnabled: false,
      },
    });
  });

  test("buildSectionUpdate returns null when settings are unavailable", () => {
    const result = buildSectionUpdate(null, "calendar", {
      showWeekends: true,
    });

    expect(result).toBeNull();
  });
});
