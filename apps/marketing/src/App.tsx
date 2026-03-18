import { useEffect, useRef, useState } from "react";
import {
  getStoredPrivacyPreferences,
  hasStoredPrivacyPreferences,
  savePrivacyPreferences,
  syncAnalyticsConsent,
  trackEvent,
  trackPageView,
  type PrivacyPreferences,
} from "./analytics";
import {
  bookCallPlaceholderHref,
  downloadPlaceholderHref,
  heroSignals,
  integrationGroups,
  storySections,
  type IntegrationService,
} from "./content";

function OptOutPopup({
  isOpen,
  preferences,
  onClose,
  onSave,
}: {
  isOpen: boolean;
  preferences: PrivacyPreferences;
  onClose: () => void;
  onSave: (preferences: PrivacyPreferences) => void;
}) {
  const [analyticsEnabled, setAnalyticsEnabled] = useState(preferences.analytics);
  const [marketingEnabled, setMarketingEnabled] = useState(preferences.marketing);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setAnalyticsEnabled(preferences.analytics);
    setMarketingEnabled(preferences.marketing);
  }, [isOpen, preferences.analytics, preferences.marketing]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({ analytics: analyticsEnabled, marketing: marketingEnabled });
  };

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-container" onClick={(e) => e.stopPropagation()}>
        <button className="popup-close" onClick={onClose} aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M15 5L5 15M5 5L15 15"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <div className="popup-header">
          <span className="popup-icon">🔒</span>
          <h3>Privacy Preferences</h3>
        </div>

        <p className="popup-description">
          Control how Marshall uses your data. Your audio always stays on-device — these settings
          only affect optional analytics and communications.
        </p>

        <div className="popup-options">
          <label className="popup-toggle">
            <span className="toggle-info">
              <span className="toggle-label">Essential cookies</span>
              <span className="toggle-hint">Required for the app to function</span>
            </span>
            <span className="toggle-switch disabled">
              <span className="toggle-knob" />
            </span>
          </label>

          <label className="popup-toggle">
            <span className="toggle-info">
              <span className="toggle-label">Analytics</span>
              <span className="toggle-hint">Help us improve Marshall with usage data</span>
            </span>
            <button
              type="button"
              className={`toggle-switch${analyticsEnabled ? " is-on" : ""}`}
              onClick={() => setAnalyticsEnabled(!analyticsEnabled)}
              role="switch"
              aria-checked={analyticsEnabled}
            >
              <span className="toggle-knob" />
            </button>
          </label>

          <label className="popup-toggle">
            <span className="toggle-info">
              <span className="toggle-label">Marketing communications</span>
              <span className="toggle-hint">Receive updates about new features</span>
            </span>
            <button
              type="button"
              className={`toggle-switch${marketingEnabled ? " is-on" : ""}`}
              onClick={() => setMarketingEnabled(!marketingEnabled)}
              role="switch"
              aria-checked={marketingEnabled}
            >
              <span className="toggle-knob" />
            </button>
          </label>
        </div>

        <div className="popup-actions">
          <button className="popup-btn secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="popup-btn primary" onClick={handleSave}>
            Save preferences
          </button>
        </div>
      </div>
    </div>
  );
}

function IntegrationLogo({ service }: { service: IntegrationService }) {
  const logoPath = `/images/integrations/${service.slug}.svg`;

  return (
    <div className="integration-logo" data-brand={service.slug}>
      <span className="integration-logo-icon" aria-hidden="true">
        <img src={logoPath} alt="" />
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
  const [isPrivacyPopupOpen, setIsPrivacyPopupOpen] = useState(false);
  const [privacyPreferences, setPrivacyPreferences] = useState<PrivacyPreferences>(
    getStoredPrivacyPreferences
  );
  const heroSectionRef = useRef<HTMLElement | null>(null);
  const storySectionRef = useRef<HTMLElement | null>(null);
  const previousPrivacyPreferencesRef = useRef<PrivacyPreferences | null>(null);

  useEffect(() => {
    if (!hasStoredPrivacyPreferences()) {
      setIsPrivacyPopupOpen(true);
    }
  }, []);

  useEffect(() => {
    syncAnalyticsConsent(privacyPreferences);

    const previousPreferences = previousPrivacyPreferencesRef.current;
    const analyticsJustEnabled =
      privacyPreferences.analytics &&
      (previousPreferences === null || !previousPreferences.analytics);
    const preferencesChanged =
      previousPreferences !== null &&
      (previousPreferences.analytics !== privacyPreferences.analytics ||
        previousPreferences.marketing !== privacyPreferences.marketing);

    if (analyticsJustEnabled) {
      trackPageView();
    }

    if (preferencesChanged && privacyPreferences.analytics) {
      trackEvent("privacy_preferences_updated", {
        analytics_enabled: privacyPreferences.analytics ? "true" : "false",
        marketing_enabled: privacyPreferences.marketing ? "true" : "false",
      });
    }

    previousPrivacyPreferencesRef.current = privacyPreferences;
  }, [privacyPreferences]);

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
    trackEvent("story_section_selected", { section_id: sectionId });
    // Resume after 10 seconds of no interaction
    setTimeout(() => setIsPaused(false), 10000);
  };

  const handlePrivacyPreferencesSave = (preferences: PrivacyPreferences) => {
    setPrivacyPreferences(savePrivacyPreferences(preferences));
    setIsPrivacyPopupOpen(false);
  };

  const handleNavigationClick = (target: string, location: string) => {
    trackEvent("navigation_click", {
      target,
      location,
    });
  };

  const handleCtaClick = (ctaName: string, location: string) => {
    trackEvent("cta_click", {
      cta_name: ctaName,
      location,
    });
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
          <a
            className="text-link"
            href="#story"
            onClick={() => handleNavigationClick("story", "header")}
          >
            How it works
          </a>
          <a
            className="text-link"
            href="#integrations"
            onClick={() => handleNavigationClick("integrations", "header")}
          >
            Integrations
          </a>
          <a
            className="cta-button"
            href={downloadPlaceholderHref}
            onClick={() => handleCtaClick("download", "header")}
          >
            <DownloadButtonLabel />
          </a>
          <a
            className="secondary-button"
            href={bookCallPlaceholderHref}
            onClick={() => handleCtaClick("book_call", "header")}
          >
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
              <a
                className="cta-button"
                href={downloadPlaceholderHref}
                onClick={() => handleCtaClick("download", "hero")}
              >
                <DownloadButtonLabel />
              </a>
              <a
                className="secondary-button"
                href={bookCallPlaceholderHref}
                onClick={() => handleCtaClick("book_call", "hero")}
              >
                Book a Call
              </a>
              <a
                className="secondary-button"
                href="#story"
                onClick={() => handleNavigationClick("story", "hero")}
              >
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
                      onClick={() => {
                        setActiveScenarioIndex(index);
                        trackEvent("story_scenario_selected", {
                          section_id: activeSection.id,
                          scenario_label: scenario.label,
                        });
                      }}
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
            <h2>Works with tools you already use.</h2>
          </div>

          <div className="integrations-logo-strip">
            {integrationGroups.flatMap((group) =>
              group.services.map((service) => (
                <IntegrationLogo key={service.slug} service={service} />
              ))
            )}
          </div>
        </section>

        <section className="trusted-section">
          <span className="trusted-label">Trusted by teams from</span>
          <div className="trusted-logos">
            {/* Google - Simple Icons */}
            <div className="trusted-logo" aria-label="Google">
              <svg viewBox="0 0 24 24">
                <path
                  d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                  fill="currentColor"
                />
              </svg>
            </div>

            {/* Meta - Simple Icons */}
            <div className="trusted-logo" aria-label="Meta">
              <svg viewBox="0 0 24 24">
                <path
                  d="M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a6.624 6.624 0 0 0 .265.86 5.297 5.297 0 0 0 .371.761c.696 1.159 1.818 1.927 3.593 1.927 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.756-1.339.186-.325c.061.1.121.196.183.3l2.152 3.595c.724 1.21 1.665 2.556 2.47 3.314 1.046.987 1.992 1.22 3.06 1.22 1.075 0 1.876-.355 2.455-.843a3.743 3.743 0 0 0 .81-.973c.542-.939.861-2.127.861-3.745 0-2.72-.681-5.357-2.084-7.45-1.282-1.912-2.957-2.93-4.716-2.93-1.047 0-2.088.467-3.053 1.308-.763.665-1.473 1.57-2.14 2.663-.215.352-.415.707-.602 1.063a21.36 21.36 0 0 0-.534-1.024c-.615-1.085-1.29-1.983-2.033-2.64a4.573 4.573 0 0 0-3.016-1.14zm.752 2.14c.398 0 .763.145 1.118.433.588.475 1.2 1.27 1.833 2.33.108.178.214.366.32.56l.026.044-2.042 3.454c-.882 1.491-1.69 2.548-2.514 3.364v.001c-.547.54-1.026.746-1.478.746-.994 0-1.594-.776-1.594-2.365 0-2.403.66-4.86 1.741-6.565.878-1.384 1.741-2.002 2.59-2.002zm10.049.015c.96 0 1.905.618 2.866 1.958 1.168 1.632 1.803 3.861 1.803 6.157 0 1.088-.182 1.823-.478 2.27a.997.997 0 0 1-.27.298c-.096.074-.203.1-.395.1-.466 0-1.004-.321-1.714-1.065-.523-.547-1.203-1.4-1.778-2.323-.898-1.442-1.657-2.772-2.157-3.614l-.214-.36c.471-.77.964-1.478 1.47-2.063.623-.72 1.157-1.04 1.612-1.182a1.98 1.98 0 0 1 .555-.076z"
                  fill="currentColor"
                />
              </svg>
            </div>

            {/* Microsoft - Simple Icons */}
            <div className="trusted-logo" aria-label="Microsoft">
              <svg viewBox="0 0 24 24">
                <path
                  d="M0 0h11.377v11.372H0zm12.623 0H24v11.372H12.623zM0 12.623h11.377V24H0zm12.623 0H24V24H12.623z"
                  fill="currentColor"
                />
              </svg>
            </div>

            {/* Adobe - Simple Icons */}
            <div className="trusted-logo" aria-label="Adobe">
              <svg viewBox="0 0 24 24">
                <path
                  d="M13.966 22.624l-1.69-4.281H8.122l3.892-9.144 5.662 13.425zM8.884 1.376H0v21.248zm15.116 0h-8.884L24 22.624z"
                  fill="currentColor"
                />
              </svg>
            </div>

            {/* Autodesk - Simple Icons */}
            <div className="trusted-logo" aria-label="Autodesk">
              <svg viewBox="0 0 24 24">
                <path
                  d="m.129 20.202 14.7-9.136h7.625c.235 0 .445.188.445.445 0 .21-.092.305-.21.375l-7.222 4.323c-.47.283-.633.845-.633 1.265l-.008 2.725H24V4.362a.561.561 0 0 0-.585-.562h-8.752L0 12.893V20.2h.129z"
                  fill="currentColor"
                />
              </svg>
            </div>

            {/* Text wordmarks for brands without simple vector logos */}
            <span className="trusted-wordmark">Harvard</span>
            <span className="trusted-wordmark">Stanford</span>
            <span className="trusted-wordmark">Lumera</span>
            <span className="trusted-wordmark">McKinsey</span>
            <span className="trusted-wordmark">Bain & Company</span>
            <span className="trusted-wordmark">Warner Bros.</span>
          </div>
        </section>

        <section className="download-section" id="download">
          <span className="eyebrow">Get started</span>
          <h2>Free for personal use. No account required.</h2>
          <p>Download Marshall for macOS. Your audio stays on-device.</p>
          <a
            className="cta-button large"
            href={downloadPlaceholderHref}
            onClick={() => handleCtaClick("download", "download_section")}
          >
            <DownloadButtonLabel />
          </a>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-brand">
          <span className="brand-mark">Marshall</span>
          <p>Meetings that end with clarity.</p>
        </div>

        <nav className="footer-links">
          <a href="#about" className="footer-link">
            About
          </a>
          <a
            href="/privacy/"
            className="footer-link"
            onClick={() => handleNavigationClick("privacy", "footer")}
          >
            Privacy
          </a>
          <a
            href="/terms/"
            className="footer-link"
            onClick={() => handleNavigationClick("terms", "footer")}
          >
            Terms
          </a>
          <button
            type="button"
            className="footer-link footer-link-button"
            onClick={() => {
              setIsPrivacyPopupOpen(true);
              trackEvent("manage_cookies_opened", { location: "footer" });
            }}
          >
            Manage Cookies
          </button>
        </nav>

        <p className="footer-copyright">© 2026 Marshall. All rights reserved.</p>
      </footer>

      <OptOutPopup
        isOpen={isPrivacyPopupOpen}
        preferences={privacyPreferences}
        onClose={() => setIsPrivacyPopupOpen(false)}
        onSave={handlePrivacyPreferencesSave}
      />
    </div>
  );
}
