import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import App from "../src/App";

describe("marketing app", () => {
  test("renders the hero, legal links, and download CTA", () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain("End every call with clear decisions and owners.");
    expect(markup).toContain("How it works");
    expect(markup).toContain("Ready when you are.");
    expect(markup).toContain("A quiet nudge appears before your call.");
    expect(markup).toContain("Works with tools you already use.");
    expect(markup).toContain("Google Calendar");
    expect(markup).toContain("Download Marshall for macOS. Your audio stays on-device.");
    expect(markup).toContain('href="/privacy/"');
    expect(markup).toContain('href="/terms/"');
    expect(markup).toContain('href="#download"');
    expect(markup).toContain('class="button-icon"');
    expect(markup).toContain(">Download</span>");
    expect(markup).toContain("Book a Call");
    expect(markup).toContain('href="#book-call"');
    expect(markup).toContain('href="#integrations"');
    expect(markup).toContain('class="hero-figure"');
  });
});
