import { useEffect, useRef, useState } from "react";
import {
  bookCallPlaceholderHref,
  downloadPlaceholderHref,
  heroSignals,
  integrationGroups,
  mobileAppNote,
  storySections,
  type IntegrationService,
} from "./content";

function IntegrationLogo({ service }: { service: IntegrationService }) {
  const icon = (() => {
    switch (service.slug) {
      case "google-calendar":
        return (
          <svg viewBox="0 0 32 32" role="presentation">
            <rect x="4" y="6" width="24" height="22" rx="6" fill="#ffffff" />
            <path d="M10 4h2v6h-2z" fill="#34a853" />
            <path d="M20 4h2v6h-2z" fill="#4285f4" />
            <path d="M4 10h24v5H4z" fill="#ea4335" />
            <path
              d="M4 15h24v13a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6z"
              fill="#fbbc04"
              transform="translate(0 -6)"
            />
            <rect x="10" y="17" width="4" height="4" rx="1.2" fill="#4285f4" />
            <rect x="18" y="17" width="4" height="4" rx="1.2" fill="#34a853" />
          </svg>
        );
      case "notion-calendar":
        return (
          <svg viewBox="0 0 32 32" role="presentation">
            <rect x="4" y="4" width="24" height="24" rx="7" fill="#111111" />
            <path d="M9 11h14" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
            <path d="M11 8v5M21 8v5" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
            <path
              d="M11 18h4M17 18h4M11 22h10"
              stroke="#ffffff"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        );
      case "notion":
        return (
          <svg viewBox="0 0 32 32" role="presentation">
            <rect
              x="5"
              y="5"
              width="22"
              height="22"
              rx="4"
              fill="#ffffff"
              stroke="#111111"
              strokeWidth="2"
            />
            <path
              d="M11 22V10l10 12V10"
              stroke="#111111"
              strokeWidth="2.2"
              strokeLinejoin="round"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        );
      case "slack":
        return (
          <svg viewBox="0 0 32 32" role="presentation">
            <path d="M13 5a3 3 0 0 1 3 3v6h-3a3 3 0 1 1 0-6V5z" fill="#36c5f0" />
            <path d="M19 13a3 3 0 0 1 3-3h5v3a3 3 0 1 1-6 0h-2z" fill="#2eb67d" />
            <path d="M19 27a3 3 0 0 1-3-3v-6h3a3 3 0 1 1 0 6v3z" fill="#ecb22e" />
            <path d="M5 19a3 3 0 0 1 3-3h6v3a3 3 0 1 1-6 0H5z" fill="#e01e5a" />
          </svg>
        );
      case "attio":
        return (
          <svg viewBox="0 0 32 32" role="presentation">
            <circle cx="13" cy="16" r="7" fill="#111111" />
            <circle cx="20" cy="16" r="7" fill="#c8c2b8" />
          </svg>
        );
      case "teams":
        return (
          <svg viewBox="0 0 32 32" role="presentation">
            <circle cx="23" cy="11" r="4" fill="#7b83eb" />
            <rect x="8" y="11" width="15" height="14" rx="4" fill="#5b5fc7" />
            <rect x="5" y="9" width="13" height="16" rx="4" fill="#4447b8" />
            <path d="M9 13h7v2h-2v6h-3v-6H9z" fill="#ffffff" />
          </svg>
        );
      case "email":
        return (
          <svg viewBox="0 0 32 32" role="presentation">
            <rect
              x="5"
              y="8"
              width="22"
              height="16"
              rx="4"
              fill="#ffffff"
              stroke="#111111"
              strokeWidth="2"
            />
            <path
              d="M8 11.5 16 17l8-5.5"
              stroke="#111111"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        );
    }
  })();

  return (
    <div className="integration-logo" data-brand={service.slug}>
      <span className="integration-logo-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="integration-logo-name">{service.name}</span>
    </div>
  );
}

function DownloadButtonLabel() {
  return (
    <>
      <span className="button-icon" aria-hidden="true">
        <svg viewBox="0 0 20 20" role="presentation">
          <path
            d="M13.1 10.2c0-1.7 1.4-2.5 1.5-2.6-.8-1.2-2.1-1.4-2.6-1.4-1.1-.1-2.1.6-2.7.6-.6 0-1.5-.6-2.4-.6-1.3 0-2.4.7-3.1 1.8-1.3 2.2-.3 5.5 1 7.3.7.9 1.5 1.8 2.5 1.7 1 0 1.4-.6 2.6-.6 1.2 0 1.5.6 2.6.6 1.1 0 1.8-.9 2.5-1.8.8-1 1.1-2 1.1-2-.1 0-3-.8-3-3z"
            fill="currentColor"
          />
          <path
            d="M11.9 4.9c.6-.7 1-1.7.8-2.7-.9 0-1.9.6-2.5 1.3-.6.6-1 1.6-.8 2.5.9.1 1.8-.4 2.5-1.1z"
            fill="currentColor"
          />
        </svg>
      </span>
      <span>Download</span>
    </>
  );
}

export default function App() {
  const [activeSectionId, setActiveSectionId] = useState(storySections[0]?.id ?? "purpose");
  const [activeScenarioIndex, setActiveScenarioIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const heroSectionRef = useRef<HTMLElement | null>(null);
  const storySectionRef = useRef<HTMLElement | null>(null);

  // Reset scenario index when section changes
  useEffect(() => {
    setActiveScenarioIndex(0);
  }, [activeSectionId]);

  // Auto-slideshow effect - cycles every 5 seconds
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setActiveSectionId((currentId) => {
        const currentIndex = storySections.findIndex((s) => s.id === currentId);
        const nextIndex = (currentIndex + 1) % storySections.length;
        return storySections[nextIndex]?.id ?? storySections[0]?.id ?? "purpose";
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [isPaused]);

  // Pause slideshow when user hovers over story section
  const handleStoryMouseEnter = () => setIsPaused(true);
  const handleStoryMouseLeave = () => setIsPaused(false);

  // Allow clicking on cards to select them
  const handleCardClick = (sectionId: string) => {
    setActiveSectionId(sectionId);
    setIsPaused(true);
    // Resume after 10 seconds of no interaction
    setTimeout(() => setIsPaused(false), 10000);
  };

  // Parallax effect for hero section
  useEffect(() => {
    const heroSection = heroSectionRef.current;

    if (!heroSection || typeof window === "undefined") {
      return;
    }

    let frameId = 0;

    const updateParallax = () => {
      frameId = 0;

      const rect = heroSection.getBoundingClientRect();
      const progress = Math.min(Math.max(-rect.top / Math.max(rect.height, 1), 0), 1.2);
      const offset = progress * 56;

      heroSection.style.setProperty("--hero-parallax-y", `${offset.toFixed(1)}px`);
    };

    const requestParallaxUpdate = () => {
      if (frameId) {
        return;
      }

      frameId = window.requestAnimationFrame(updateParallax);
    };

    updateParallax();
    window.addEventListener("scroll", requestParallaxUpdate, { passive: true });
    window.addEventListener("resize", requestParallaxUpdate);

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }

      window.removeEventListener("scroll", requestParallaxUpdate);
      window.removeEventListener("resize", requestParallaxUpdate);
    };
  }, []);

  const activeSection =
    storySections.find((section) => section.id === activeSectionId) ?? storySections[0];

  return (
    <div className="page-shell">
      <header className="site-nav">
        <a className="brand-mark" href="#top">
          Marshall
        </a>
        <div className="nav-actions">
          <a className="text-link" href="#story">
            How it works
          </a>
          <a className="text-link" href="#integrations">
            Integrations
          </a>
          <a className="cta-button" href={downloadPlaceholderHref}>
            <DownloadButtonLabel />
          </a>
          <a className="secondary-button" href={bookCallPlaceholderHref}>
            Book a Call
          </a>
        </div>
      </header>

      <main>
        <section className="hero-section" id="top" ref={heroSectionRef}>
          <div className="hero-figure" aria-hidden="true">
            <div className="hero-figure-image" />
          </div>

          <div className="hero-copy">
            <span className="eyebrow">Meeting assistant for macOS</span>
            <h1>End every call with clear decisions and owners.</h1>
            <p className="hero-body">
              Marshall listens to your meetings and prompts you when conversations drift, decisions
              stall, or action items need owners.
            </p>
            <div className="hero-actions">
              <a className="cta-button" href={downloadPlaceholderHref}>
                <DownloadButtonLabel />
              </a>
              <a className="secondary-button" href={bookCallPlaceholderHref}>
                Book a Call
              </a>
              <a className="secondary-button" href="#story">
                See the flow
              </a>
            </div>
            <div className="hero-features">
              {heroSignals.map((signal, i) => (
                <div className="hero-feature" key={signal}>
                  <span className="feature-icon">{["👀", "❓", "✓"][i]}</span>
                  <span>{signal}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="hero-panel">
            <div className="macbook-frame">
              <div className="macbook-bezel">
                <div className="macbook-notch">
                  <div className="notch-camera" />
                </div>
              </div>
              <div className="macbook-screen">
                <div className="screen-menubar">
                  <span className="menubar-apple"></span>
                  <span className="menubar-app">Zoom</span>
                  <div className="menubar-right">
                    <span className="menubar-marshall">
                      <span className="marshall-icon" />
                      Marshall
                    </span>
                    <span>Tue 2:34 PM</span>
                  </div>
                </div>

                <div className="screen-content">
                  <div className="call-grid">
                    <div className="call-participant">
                      <div
                        className="participant-avatar"
                        style={{ background: "linear-gradient(135deg, #6b7280, #4b5563)" }}
                      >
                        SC
                      </div>
                      <span className="participant-name">Sarah</span>
                    </div>
                    <div className="call-participant">
                      <div
                        className="participant-avatar"
                        style={{ background: "linear-gradient(135deg, #78716c, #57534e)" }}
                      >
                        MW
                      </div>
                      <span className="participant-name">Marcus</span>
                    </div>
                    <div className="call-participant">
                      <div
                        className="participant-avatar"
                        style={{ background: "linear-gradient(135deg, #71717a, #52525b)" }}
                      >
                        PS
                      </div>
                      <span className="participant-name">Priya</span>
                    </div>
                    <div className="call-participant">
                      <div
                        className="participant-avatar"
                        style={{ background: "linear-gradient(135deg, #737373, #525252)" }}
                      >
                        AT
                      </div>
                      <span className="participant-name">Alicia</span>
                    </div>
                  </div>

                  <div className="marshall-panel">
                    <div className="panel-header">
                      <span className="panel-logo">Marshall</span>
                      <span className="panel-status">
                        <span className="status-dot" />
                        Live
                      </span>
                    </div>

                    <div className="panel-progress">
                      <div className="progress-ring">
                        <svg viewBox="0 0 36 36">
                          <path
                            className="progress-bg"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                          <path
                            className="progress-fill"
                            strokeDasharray="68, 100"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                        </svg>
                        <span className="progress-text">68%</span>
                      </div>
                      <span className="progress-label">Time elapsed</span>
                    </div>

                    <div className="panel-speakers">
                      <span className="section-label">Speaking</span>
                      <div className="speaker-bars">
                        <div className="speaker-row">
                          <span>Sarah</span>
                          <div className="speaker-bar">
                            <div style={{ width: "45%" }} />
                          </div>
                        </div>
                        <div className="speaker-row">
                          <span>Marcus</span>
                          <div className="speaker-bar">
                            <div style={{ width: "30%" }} />
                          </div>
                        </div>
                        <div className="speaker-row">
                          <span>Priya</span>
                          <div className="speaker-bar">
                            <div style={{ width: "15%" }} />
                          </div>
                        </div>
                        <div className="speaker-row">
                          <span>Alicia</span>
                          <div className="speaker-bar">
                            <div style={{ width: "10%" }} />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="panel-goals">
                      <span className="section-label">Agenda</span>
                      <div className="goal-list">
                        <div className="goal-item done">
                          <span className="goal-check">✓</span>
                          <span>Confirm ship date</span>
                        </div>
                        <div className="goal-item done">
                          <span className="goal-check">✓</span>
                          <span>Assign press release</span>
                        </div>
                        <div className="goal-item active">
                          <span className="goal-dot" />
                          <span>Legal review owner</span>
                        </div>
                        <div className="goal-item">
                          <span className="goal-dot" />
                          <span>Next steps</span>
                        </div>
                      </div>
                    </div>

                    <div className="panel-prompt">
                      <span className="prompt-label">Nudge</span>
                      <p>Ask who will own the legal review before wrapping up.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          className="story-section"
          id="story"
          ref={storySectionRef}
          onMouseEnter={handleStoryMouseEnter}
          onMouseLeave={handleStoryMouseLeave}
        >
          <div className="story-header">
            <span className="eyebrow">How it works</span>
            <h2>Marshall watches your calls so you can focus on the conversation.</h2>
          </div>

          {/* Navigation tabs with capability names */}
          <nav className="slideshow-nav" aria-label="Capability steps">
            {storySections.map((section) => (
              <button
                key={section.id}
                className={`slideshow-tab${section.id === activeSection.id ? " is-active" : ""}`}
                onClick={() => handleCardClick(section.id)}
                aria-current={section.id === activeSection.id ? "step" : undefined}
              >
                <span className="tab-dot" />
                <span className="tab-label">{section.eyebrow}</span>
              </button>
            ))}
            {/* Progress bar */}
            <div className="slideshow-progress">
              <div
                className="slideshow-progress-fill"
                style={{
                  width: `${((storySections.findIndex((s) => s.id === activeSection.id) + 1) / storySections.length) * 100}%`,
                }}
              />
            </div>
          </nav>

          {/* Single slide view: illustration left, context right */}
          <div className="slideshow-stage">
            {/* Left: Illustration */}
            <div className="slideshow-visual" key={activeSection.id}>
              <img
                src={`/images/how-it-works/${activeSection.id === "follow-up" ? "follow-up-orchestration" : activeSection.id === "ambient" ? "ambient-call-start" : activeSection.id === "purpose" ? "purpose-call-plan" : activeSection.id === "focus" ? "focus-refocus" : activeSection.id === "context" ? "context-retrieval" : "share-summary"}.svg`}
                alt={`${activeSection.title} illustration`}
                className="slideshow-illustration"
              />
            </div>

            {/* Right: Context card */}
            <article className="slideshow-context" key={`context-${activeSection.id}`}>
              <header className="context-header">
                <span className="context-eyebrow">{activeSection.eyebrow}</span>
                <h3 className="context-title">{activeSection.title}</h3>
              </header>

              <p className="context-description">{activeSection.description}</p>

              {/* Clickable scenarios */}
              <div className="context-scenarios">
                <div className="scenario-buttons">
                  {activeSection.scenarios.map((scenario, index) => (
                    <button
                      key={scenario.label}
                      className={`scenario-btn${index === activeScenarioIndex ? " is-active" : ""}`}
                      onClick={() => setActiveScenarioIndex(index)}
                    >
                      {scenario.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Example for selected scenario */}
              <div className="scenario-example">
                <span className="example-icon">→</span>
                <span className="example-text">
                  {activeSection.scenarios[activeScenarioIndex]?.example}
                </span>
              </div>
            </article>
          </div>
        </section>

        <section className="integrations-section" id="integrations">
          <div className="story-header compact">
            <span className="eyebrow">Integrations</span>
            <h2>Marshall fits around your schedule and the places follow-up already happens.</h2>
            <p>
              The workflow stays inside the tools your team already trusts, from calendars to the
              systems where decisions get shared.
            </p>
          </div>

          <div className="integrations-grid">
            {integrationGroups.map((group) => (
              <article className="integration-card" key={group.id}>
                <span className="eyebrow">{group.eyebrow}</span>
                <h3>{group.title}</h3>
                <div className="integration-logo-row" aria-label={`${group.title} services`}>
                  {group.services.map((service) => (
                    <IntegrationLogo key={service.slug} service={service} />
                  ))}
                </div>
                <p>{group.description}</p>
              </article>
            ))}

            <aside className="integration-card integration-card-soon">
              <span className="eyebrow">Coming soon</span>
              <h3>Mobile app</h3>
              <p>{mobileAppNote}</p>
            </aside>
          </div>
        </section>

        <section className="download-section" id="download">
          <span className="eyebrow">Get started</span>
          <h2>Free for personal use. No account required.</h2>
          <p>Download Marshall for macOS. Your audio stays on-device.</p>
          <a className="cta-button large" href={downloadPlaceholderHref}>
            <DownloadButtonLabel />
          </a>
        </section>
      </main>

      <footer className="site-footer">
        <span className="brand-mark">Marshall</span>
        <p>Meetings that end with clarity.</p>
      </footer>
    </div>
  );
}
