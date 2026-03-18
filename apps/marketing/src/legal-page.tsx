import { ConsentAwareAnalytics } from "./ConsentAwareAnalytics";
import { legalSections, type MarketingLegalSection } from "./content";

function findSection(id: MarketingLegalSection["id"]) {
  const section = legalSections.find((entry) => entry.id === id);

  if (!section) {
    throw new Error(`Unknown legal section: ${id}`);
  }

  return section;
}

export function LegalPage({ sectionId }: { sectionId: MarketingLegalSection["id"] }) {
  const section = findSection(sectionId);

  return (
    <div className="page-shell legal-page-shell">
      <header className="site-nav legal-nav">
        <a className="brand-mark" href="/">
          Marshall
        </a>
        <div className="nav-actions">
          <a className="text-link" href="/">
            Home
          </a>
          <a
            className={`text-link${section.id === "privacy" ? " is-active" : ""}`}
            href="/privacy/"
          >
            Privacy
          </a>
          <a className={`text-link${section.id === "terms" ? " is-active" : ""}`} href="/terms/">
            Terms
          </a>
        </div>
      </header>

      <main className="legal-page-main">
        <section className="legal-page-header">
          <span className="eyebrow">{section.eyebrow}</span>
          <h1>{section.title}</h1>
          <p className="legal-effective">Effective {section.effectiveDate}</p>
        </section>

        <article className="legal-prose">
          <p>{section.intro}</p>

          {section.blocks.map((block) => (
            <section className="legal-prose-section" key={block.title}>
              <h2>{block.title}</h2>
              <ul>
                {block.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </section>
          ))}

          <p>{section.closing}</p>
        </article>
      </main>

      <footer className="site-footer legal-footer">
        <div className="footer-brand">
          <span className="brand-mark">Marshall</span>
          <p>Meetings that end with clarity.</p>
        </div>

        <nav className="footer-links">
          <a href="/" className="footer-link">
            Home
          </a>
          <a href="/privacy/" className="footer-link">
            Privacy
          </a>
          <a href="/terms/" className="footer-link">
            Terms
          </a>
        </nav>

        <p className="footer-copyright">© 2026 Marshall. All rights reserved.</p>
      </footer>

      <ConsentAwareAnalytics />
    </div>
  );
}
