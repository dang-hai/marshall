import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { FloatingOverlayPill } from "../src/renderer/src/components/FloatingOverlayPill";

describe("floating overlay pill", () => {
  test("renders the brand glyph and idle state", () => {
    const markup = renderToStaticMarkup(<FloatingOverlayPill isActive={false} />);

    expect(markup).toContain("Marshall recorder idle");
    expect(markup).toContain("overlay-wave");
    expect(markup).not.toContain("backdrop-blur-md overlay-pill-active");
  });

  test("renders the active pulse state", () => {
    const markup = renderToStaticMarkup(<FloatingOverlayPill isActive />);

    expect(markup).toContain("Marshall recorder active");
    expect(markup).toContain("overlay-pill-active");
    expect(markup).toContain("overlay-wave-active");
  });
});
