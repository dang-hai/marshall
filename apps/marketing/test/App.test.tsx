import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import App from "../src/App";

describe("marketing app", () => {
  test("renders the hero, integrations section, story illustrations, and download CTA", () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain("End every call with clear decisions and owners.");
    expect(markup).toContain("How it works");
    expect(markup).toContain("Clarifies the plan before the conversation drifts.");
    expect(markup).toContain("Pulls in docs, threads, and web facts on demand.");
    expect(markup).toContain("Customer sync starts in 2 min");
    expect(markup).toContain("Security review follow-up");
    expect(markup).toContain("Marshall stays ahead of your next call.");
    expect(markup).toContain("Google Calendar");
    expect(markup).toContain("The mobile app is coming soon.");
    expect(markup).toContain("Download Marshall for macOS. Your audio stays on-device.");
    expect(markup).toContain('href="#download"');
    expect(markup).toContain('class="button-icon"');
    expect(markup).toContain(">Download</span>");
    expect(markup).toContain("Book a Call");
    expect(markup).toContain('href="#book-call"');
    expect(markup).toContain('href="#integrations"');
    expect(markup).toContain('class="hero-figure"');
  });
});
