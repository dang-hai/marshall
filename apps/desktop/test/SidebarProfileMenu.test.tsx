import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SidebarProfileMenu } from "../src/renderer/src/components/SidebarProfileMenu";

describe("sidebar profile menu", () => {
  test("renders only the settings entry when opened", () => {
    const markup = renderToStaticMarkup(
      <SidebarProfileMenu active={false} isOpen onOpenSettings={() => {}} onToggle={() => {}} />
    );

    expect(markup).toContain('role="menu"');
    expect(markup).toContain("Profile menu");
    expect(markup).toContain("Settings");
    expect(markup).not.toContain("Calendar preferences");
    expect(markup).toContain("Signed in");
  });
});
