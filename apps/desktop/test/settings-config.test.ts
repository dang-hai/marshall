import { describe, expect, test } from "bun:test";
import {
  SETTINGS_SECTIONS,
  settingsSidebarItems,
} from "../src/renderer/src/components/settings-config";

describe("settings config", () => {
  test("derives sidebar items from the section lookup", () => {
    expect(settingsSidebarItems.map((item) => item.id)).toEqual(Object.keys(SETTINGS_SECTIONS));
    expect(settingsSidebarItems.find((item) => item.id === "account")?.label).toBe(
      SETTINGS_SECTIONS.account.label
    );
  });
});
