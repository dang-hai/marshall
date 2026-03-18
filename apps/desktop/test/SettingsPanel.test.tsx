import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SettingsPanel } from "../src/renderer/src/components/SettingsPanel";

describe("desktop settings panel", () => {
  test("renders the placeholder account section", () => {
    const markup = renderToStaticMarkup(<SettingsPanel onBack={() => {}} section="account" />);

    expect(markup).toContain("Current user");
    expect(markup).toContain("Hai Dang");
    expect(markup).toContain("Authentication is not wired in yet.");
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
