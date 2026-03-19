import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SettingsPanel } from "../src/renderer/src/components/SettingsPanel";

describe("desktop settings panel", () => {
  test("renders the account section with fallback when no user", () => {
    const markup = renderToStaticMarkup(<SettingsPanel onBack={() => {}} section="account" />);

    expect(markup).toContain("Current user");
    expect(markup).toContain("User");
    expect(markup).toContain("Not signed in");
    expect(markup).not.toContain("Sections");
  });

  test("renders calendar visibility and display preferences", () => {
    const markup = renderToStaticMarkup(<SettingsPanel onBack={() => {}} section="calendar" />);

    expect(markup).toContain("Visible calendars");
    expect(markup).toContain("Work");
    expect(markup).toContain("Personal");
    expect(markup).toContain("Shared");
    expect(markup).toContain("Display options");
    expect(markup).toContain("Show weekends");
    expect(markup).toContain("Compact layout");
  });
});
