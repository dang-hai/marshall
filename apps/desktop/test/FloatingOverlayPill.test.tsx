import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { getOverlayPillState } from "../src/renderer/src/OverlayPillApp";
import { FloatingOverlayPill } from "../src/renderer/src/components/FloatingOverlayPill";

describe("floating overlay pill", () => {
  test("renders the brand glyph and idle state", () => {
    const markup = renderToStaticMarkup(<FloatingOverlayPill isActive={false} />);

    expect(markup).toContain("Marshall recorder idle");
    expect(markup).toContain("text-stone-300");
    expect(markup).not.toContain('class="micro-wave-bar"');
  });

  test("renders the active pulse state", () => {
    const markup = renderToStaticMarkup(<FloatingOverlayPill isActive />);

    expect(markup).toContain("Marshall recorder active");
    expect(markup).toContain("pill-pulse");
    expect(markup).toContain("micro-wave-bar");
  });
});

describe("getOverlayPillState", () => {
  test("hides the overlay when transcription is idle", () => {
    expect(getOverlayPillState("idle")).toEqual({
      isVisible: false,
      isActive: false,
    });
  });

  test("shows the overlay for active sessions and only animates while recording", () => {
    expect(getOverlayPillState("recording")).toEqual({
      isVisible: true,
      isActive: true,
    });

    expect(getOverlayPillState("transcribing")).toEqual({
      isVisible: true,
      isActive: false,
    });
  });
});
