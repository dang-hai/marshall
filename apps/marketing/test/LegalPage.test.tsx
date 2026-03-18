import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { LegalPage } from "../src/legal-page";

describe("legal pages", () => {
  test("renders the privacy page as plain text content", () => {
    const markup = renderToStaticMarkup(<LegalPage sectionId="privacy" />);

    expect(markup).toContain("Marshall is built to keep meeting context local by default.");
    expect(markup).toContain("What we collect");
    expect(markup).toContain("How Marshall handles meeting data");
    expect(markup).toContain("Home");
    expect(markup).not.toContain("legal-card");
  });

  test("renders the terms page on its own path", () => {
    const markup = renderToStaticMarkup(<LegalPage sectionId="terms" />);

    expect(markup).toContain("Use Marshall with reviewable judgment, not blind trust.");
    expect(markup).toContain("Responsible use");
    expect(markup).toContain('href="/privacy/"');
    expect(markup).toContain('href="/terms/"');
    expect(markup).toContain('href="/"');
  });
});
