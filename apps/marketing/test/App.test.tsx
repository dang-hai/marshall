import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import App from "../src/App";

describe("marketing app", () => {
  test("renders the hero, legal links, and download CTA", () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain("Meetings that actually end with decisions.");
    expect(markup).toContain("How it works");
    expect(markup).toContain("Walk in prepared, not scrambling.");
    expect(markup).toContain(
      "Marshall surfaces relevant context 5 minutes before your call starts."
    );
    expect(markup).toContain("Fits into the way you already work.");
    expect(markup).toContain("Google Calendar");
    expect(markup).toContain("Download for macOS and run your first meeting in under a minute.");
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
