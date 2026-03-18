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
            {/* Google */}
            <div className="trusted-logo">
              <svg viewBox="0 0 272 92" aria-label="Google">
                <path
                  d="M115.75 47.18c0 12.77-9.99 22.18-22.25 22.18s-22.25-9.41-22.25-22.18C71.25 34.32 81.24 25 93.5 25s22.25 9.32 22.25 22.18zm-9.74 0c0-7.98-5.79-13.44-12.51-13.44S80.99 39.2 80.99 47.18c0 7.9 5.79 13.44 12.51 13.44s12.51-5.55 12.51-13.44z"
                  fill="currentColor"
                />
                <path
                  d="M163.75 47.18c0 12.77-9.99 22.18-22.25 22.18s-22.25-9.41-22.25-22.18c0-12.85 9.99-22.18 22.25-22.18s22.25 9.32 22.25 22.18zm-9.74 0c0-7.98-5.79-13.44-12.51-13.44s-12.51 5.46-12.51 13.44c0 7.9 5.79 13.44 12.51 13.44s12.51-5.55 12.51-13.44z"
                  fill="currentColor"
                />
                <path
                  d="M209.75 26.34v39.82c0 16.38-9.66 23.07-21.08 23.07-10.75 0-17.22-7.19-19.66-13.07l8.48-3.53c1.51 3.61 5.21 7.87 11.17 7.87 7.31 0 11.84-4.51 11.84-13v-3.19h-.34c-2.18 2.69-6.38 5.04-11.68 5.04-11.09 0-21.25-9.66-21.25-22.09 0-12.52 10.16-22.26 21.25-22.26 5.29 0 9.49 2.35 11.68 4.96h.34v-3.61h9.25zm-8.56 20.92c0-7.81-5.21-13.52-11.84-13.52-6.72 0-12.35 5.71-12.35 13.52 0 7.73 5.63 13.36 12.35 13.36 6.63 0 11.84-5.63 11.84-13.36z"
                  fill="currentColor"
                />
                <path d="M225 3v65h-9.5V3h9.5z" fill="currentColor" />
                <path
                  d="M262.02 54.48l7.56 5.04c-2.44 3.61-8.32 9.83-18.48 9.83-12.6 0-22.01-9.74-22.01-22.18 0-13.19 9.49-22.18 20.92-22.18 11.51 0 17.14 9.16 18.98 14.11l1.01 2.52-29.65 12.28c2.27 4.45 5.8 6.72 10.75 6.72 4.96 0 8.4-2.44 10.92-6.14zm-23.27-7.98l19.82-8.23c-1.09-2.77-4.37-4.7-8.23-4.7-4.95 0-11.84 4.37-11.59 12.93z"
                  fill="currentColor"
                />
                <path
                  d="M35.29 41.41V32H67c.31 1.64.47 3.58.47 5.68 0 7.06-1.93 15.79-8.15 22.01-6.05 6.3-13.78 9.66-24.02 9.66C16.32 69.35.36 53.89.36 34.91.36 15.93 16.32.47 35.3.47c10.5 0 17.98 4.12 23.6 9.49l-6.64 6.64c-4.03-3.78-9.49-6.72-16.97-6.72-13.86 0-24.7 11.17-24.7 25.03 0 13.86 10.84 25.03 24.7 25.03 8.99 0 14.11-3.61 17.39-6.89 2.66-2.66 4.41-6.46 5.1-11.65l-22.49.01z"
                  fill="currentColor"
                />
              </svg>
            </div>

            {/* Meta */}
            <div className="trusted-logo">
              <svg viewBox="0 0 512 102" aria-label="Meta">
                <path
                  d="M115.2 50.8c0-20.6 14.2-35.4 33.8-35.4 12.4 0 20.8 5.6 26 13.4l-10.8 6.2c-3.2-4.8-8.4-8.2-15.2-8.2-13 0-22.2 10.4-22.2 24s9.2 24 22.2 24c6.8 0 12-3.4 15.2-8.2l10.8 6.2c-5.2 7.8-13.6 13.4-26 13.4-19.6 0-33.8-14.8-33.8-35.4zM256.6 15.4v70h-11.4V72c-4.8 9-13.4 14.8-25.2 14.8-18.8 0-33.4-15.4-33.4-36s14.6-36 33.4-36c11.8 0 20.4 5.8 25.2 14.8V15.4h11.4zm-11.4 35.4c0-14.4-9.8-24.6-23.4-24.6s-23.4 10.2-23.4 24.6 9.8 24.6 23.4 24.6 23.4-10.2 23.4-24.6zM308.8 15.4v11.4h-16.6v58.6h-11.4V26.8h-11.4V15.4h11.4V5h11.4v10.4h16.6zM363.8 15.4v70h-11.4V72c-4.8 9-13.4 14.8-25.2 14.8-18.8 0-33.4-15.4-33.4-36s14.6-36 33.4-36c11.8 0 20.4 5.8 25.2 14.8V15.4h11.4zm-11.4 35.4c0-14.4-9.8-24.6-23.4-24.6s-23.4 10.2-23.4 24.6 9.8 24.6 23.4 24.6 23.4-10.2 23.4-24.6z"
                  fill="currentColor"
                />
                <path
                  d="M81.8 15.4C63.4 15.4 51 30.6 51 50.8s12.4 35.4 30.8 35.4c12.4 0 21.2-6.6 26.4-15.6l-9.8-5.6c-3.4 6-9.2 10-16.6 10-12.2 0-19.2-9-19.8-20.2h48.6v-4c0-20.2-12.4-35.4-28.8-35.4zm-19 29.8c1.8-10.2 9.2-18.6 19-18.6s17.2 8.4 19 18.6h-38zM0 50.8C0 20 21.8 0 48.8 0c14.8 0 27.4 6 35.2 15.8L73.2 24c-5.6-6.8-14-10.8-24.4-10.8C29.6 13.2 13.2 29.2 13.2 50.8S29.6 88.4 48.8 88.4c10.4 0 18.8-4 24.4-10.8l10.8 8.2C76.2 95.6 63.6 102 48.8 102 21.8 102 0 81.6 0 50.8z"
                  fill="currentColor"
                />
              </svg>
            </div>

            {/* Microsoft */}
            <div className="trusted-logo">
              <svg viewBox="0 0 512 110" aria-label="Microsoft">
                <path
                  d="M164.4 22.6v71.8h-12.2V37.6L128 94.4h-7.6L96.2 37.6v56.8H84V22.6h16.4l22.8 52.2 22.8-52.2h18.4zm17.2 10.8c0-4.2 3.2-7.4 7.6-7.4s7.6 3.2 7.6 7.4-3.2 7.4-7.6 7.4-7.6-3.2-7.6-7.4zm1.4 14.8h12.2v46.2h-12.2V48.2zm51.8-1.4c9.6 0 16.6 4.2 20.4 10.4l-10 5.8c-2.2-3.6-5.8-5.8-10.4-5.8-8 0-13.6 6.2-13.6 14.6s5.6 14.6 13.6 14.6c4.6 0 8.2-2.2 10.4-5.8l10 5.8c-3.8 6.2-10.8 10.4-20.4 10.4-15 0-25.8-10.8-25.8-25s10.8-25 25.8-25zm42.8 0c7.4 0 12.4 3.2 15.4 7.4v-6.4h12.2v46.2c0 14.6-10.8 23.4-26.2 23.4-10.6 0-19.4-4.4-23.8-12.6l10.4-6c2.4 5.2 7.6 8.2 13.8 8.2 8.2 0 13.6-5 13.6-13v-5.8c-3 4.2-8 7.4-15.4 7.4-13.4 0-23.2-10.8-23.2-24.2s9.8-24.6 23.2-24.6zm2.4 10.4c-7.6 0-13.4 5.8-13.4 14.2s5.8 14.2 13.4 14.2 13.4-5.8 13.4-14.2-5.8-14.2-13.4-14.2zm57.8-10.4c7 0 11.6 3 14.2 6.4v-5.4h12.2v46.2h-12.2v-5.4c-2.6 3.4-7.2 6.4-14.2 6.4-12.8 0-22.4-11-22.4-24.6s9.6-23.6 22.4-23.6zm2.4 10.4c-7 0-12.8 5.6-12.8 13.6s5.8 13.6 12.8 13.6 12.8-5.6 12.8-13.6-5.8-13.6-12.8-13.6zm64.6-10.4c13.8 0 22.4 10.2 22.4 24.6v3.4h-34c1 7.4 6.8 12.2 14.4 12.2 5.6 0 10.4-2.4 13-6.6l9 5.2c-4.6 7.6-13.2 12-22.4 12-15.2 0-26.2-10.8-26.2-25s11-25.8 23.8-25.8zm-11.4 20.4h22c-1.2-6.4-6.2-10.4-11.2-10.4-6 0-9.6 4-10.8 10.4zM453.8 33c4.4 0 8 3.6 8 8s-3.6 8-8 8-8-3.6-8-8 3.6-8 8-8zm-5.4 15h12.2v46.4h-12.2V48zm48.2-1.4c5.8 0 10.8 2 14.4 6v-4.8h12v46.6h-12v-4.8c-3.6 4-8.6 6-14.4 6-12.6 0-22.4-10.8-22.4-24.6s9.8-24.4 22.4-24.4zm2.4 10.4c-7 0-12.8 5.6-12.8 14s5.8 14 12.8 14 12.8-5.6 12.8-14-5.8-14-12.8-14z"
                  fill="currentColor"
                />
                <path
                  d="M0 0h52.4v52.4H0zM57.6 0H110v52.4H57.6zM0 57.6h52.4V110H0zM57.6 57.6H110V110H57.6z"
                  fill="currentColor"
                />
              </svg>
            </div>

            {/* Harvard */}
            <div className="trusted-logo">
              <svg viewBox="0 0 280 60" aria-label="Harvard">
                <path
                  d="M26.4 10.8v38.4h-8.8V33.6H8.8v15.6H0V10.8h8.8v14.4h8.8V10.8h8.8zm30.8 0l12.4 38.4h-9.2l-2.4-8.4H45.2l-2.4 8.4h-9.2L46 10.8h11.2zm-2.8 22.4l-4-14-4 14h8zm51.6-22.4v38.4h-8.8V33.6h-8.8v15.6h-8.8V10.8h8.8v14.4h8.8V10.8h8.8zm32 38.4l-8.8-15.6h-3.6v15.6h-8.8V10.8h16c9.2 0 15.2 5.6 15.2 13.6 0 5.6-3.2 10-8 12l10 12.8h-12zm-12.4-22.8h6.8c4 0 6.4-2.4 6.4-6s-2.4-6-6.4-6h-6.8v12zm56.4-15.6l12.4 38.4h-9.2l-2.4-8.4h-12.8l-2.4 8.4h-9.2l12.4-38.4h11.2zm-2.8 22.4l-4-14-4 14h8zm56.8-22.4v38.4h-8.8V33.6h-8.8v15.6h-8.8V10.8h8.8v14.4h8.8V10.8h8.8zm17.6 0c13.2 0 21.6 8.4 21.6 19.2s-8.4 19.2-21.6 19.2h-14V10.8h14zm-5.2 30h5.2c7.6 0 12.4-4.4 12.4-10.8s-4.8-10.8-12.4-10.8h-5.2v21.6z"
                  fill="currentColor"
                />
              </svg>
            </div>

            {/* Stanford */}
            <div className="trusted-logo">
              <svg viewBox="0 0 340 60" aria-label="Stanford">
                <path
                  d="M27.6 30c0-5.2-3.6-8-9.6-8.8l-6-1c-3.2-.4-4.8-1.6-4.8-3.6 0-2.4 2.4-4.4 6.8-4.4 4.8 0 7.6 2 8.8 5.6l7.6-2.8c-2-6-7.6-10.4-16.4-10.4-9.6 0-16 5.6-16 13.2 0 6.8 4.8 10.8 12.4 11.6l6 .8c3.2.4 4.8 1.6 4.8 4 0 2.8-2.8 4.8-7.6 4.8-5.6 0-9.2-2.4-10.8-6.8L-5.6 35c2.4 7.6 9.6 12.8 19.2 12.8 10.4 0 17.2-5.6 17.2-14zm23.6-24.8v8h11.6v35.6h8.8V13.2H83.2v-8H51.2zm68.8 0l-17.2 43.6h9.2l3.6-10h15.6l3.6 10h9.2L126.8 5.2h-6.8zM120 31.6l5.2-14.4 5.2 14.4H120zm62.4-26.4v23.2L164 5.2h-8.4v43.6h8.4V26.4l18.4 22.4h8.4V5.2h-8.4zm51.2-.8h-17.2v43.6h8.8v-15.2h8.4c10.4 0 17.2-5.6 17.2-14.4s-6.8-14-17.2-14zm-.8 21.2h-7.6V12.4h7.6c5.6 0 8.8 2.8 8.8 6.8s-3.2 6.8-8.8 6.8zm64-20.4c-13.2 0-22 9.2-22 22.4s8.8 22.4 22 22.4 22-9.2 22-22.4-8.8-22.4-22-22.4zm0 36.8c-8 0-12.8-5.6-12.8-14.4s4.8-14.4 12.8-14.4 12.8 5.6 12.8 14.4-4.8 14.4-12.8 14.4zm71.6-36h-8.8v15.2h-8.8V5.2h-8.8v43.6h8.8V28.4h8.8v20.4h8.8V5.2zm32.4 0c-10 0-17.2 6-17.2 14.8 0 7.6 4.8 12.4 13.2 14l5.2.8c5.2.8 7.2 2.4 7.2 5.2 0 3.6-3.6 6-9.2 6-6 0-10.4-2.8-12-7.6l-7.6 3.6c2.8 7.2 10 12 19.6 12 10.8 0 18-6 18-15.2 0-7.6-4.8-12-13.6-13.6l-5.2-.8c-4.8-.8-6.8-2.4-6.8-5.2 0-3.2 3.2-5.6 8.4-5.6 5.2 0 8.4 2.4 10 6.4l7.6-3.2c-2.8-6.8-9.2-11.6-17.6-11.6z"
                  fill="currentColor"
                />
              </svg>
            </div>

            {/* Lumera */}
            <div className="trusted-logo">
              <svg viewBox="0 0 200 50" aria-label="Lumera">
                <path
                  d="M0 8h8v26h16v8H0V8zm52 0v34h-8V8h8zm20 34H64V8h8v34zm24-26v26h-8V16h-8V8h24v8h-8zm32 26V8h24v8h-16v6h14v8h-14v6h16v8h-24zm56-34c10 0 16 6 16 14v20h-8V24c0-4-3-8-8-8s-8 4-8 8v18h-8V22c0-8 6-14 16-14z"
                  fill="currentColor"
                />
              </svg>
            </div>

            {/* OSapiens */}
            <div className="trusted-logo">
              <svg viewBox="0 0 280 50" aria-label="OSapiens">
                <path
                  d="M22 4C10 4 0 14 0 26s10 22 22 22 22-10 22-22S34 4 22 4zm0 36c-8 0-14-6-14-14s6-14 14-14 14 6 14 14-6 14-14 14zm46-30c-8 0-14 4-14 12 0 6 4 10 10 11l5 1c3 0 5 2 5 4s-3 4-7 4c-5 0-8-2-10-6l-6 4c3 6 9 10 16 10 9 0 15-5 15-13 0-6-4-10-11-11l-5-1c-3 0-4-2-4-4s2-4 6-4c4 0 7 2 8 5l6-3c-2-6-8-9-14-9zm54 0l-2 8c-2-5-7-8-13-8-11 0-18 9-18 21s7 21 18 21c6 0 11-3 13-8l2 7h7V10h-7zm-14 36c-7 0-12-6-12-14s5-14 12-14 12 6 12 14-5 14-12 14zm46-36h-7v5c-3-4-8-6-13-6-12 0-20 9-20 22s8 22 20 22c5 0 10-2 13-6v5h7V10zm-19 36c-8 0-13-6-13-14s5-14 13-14 13 6 13 14-5 14-13 14zm40-36h-8v42h8V10zm28 0h-24v8h8v34h8V18h8v-8zm24 0h-8v42h8V10zm32-6c-12 0-22 10-22 22s10 22 22 22 22-10 22-22-10-22-22-22zm0 36c-8 0-14-6-14-14s6-14 14-14 14 6 14 14-6 14-14 14z"
                  fill="currentColor"
                />
              </svg>
            </div>

            {/* Autodesk */}
            <div className="trusted-logo">
              <svg viewBox="0 0 340 60" aria-label="Autodesk">
                <path
                  d="M41.6 5.2L24.4 48.8h9.2l3.6-10h15.6l3.6 10h9.2L48.4 5.2h-6.8zM40 31.6l5.2-14.4 5.2 14.4H40zm78.4-26.4v23.2L100 5.2h-8.4v43.6h8.4V26.4l18.4 22.4h8.4V5.2h-8.4zm44.4 0v8h11.6v35.6h8.8V13.2H195.2v-8h-32.4zm74.4 0c-13.2 0-22 9.2-22 22.4s8.8 22.4 22 22.4 22-9.2 22-22.4-8.8-22.4-22-22.4zm0 36.8c-8 0-12.8-5.6-12.8-14.4s4.8-14.4 12.8-14.4 12.8 5.6 12.8 14.4-4.8 14.4-12.8 14.4zm37.6-36.8h-8.8v43.6h8.8V5.2zm57.6 14c0-8.8-6.4-14-16.8-14H296v43.6h8.8v-15.2h8.4l10 15.2H335l-11.2-16.4c5.2-2 8.8-6.4 8.8-13.2zm-17.6 6.8h-8v-12.8h8c5.6 0 8.8 2.8 8.8 6.4s-3.2 6.4-8.8 6.4z"
                  fill="currentColor"
                />
              </svg>
            </div>

            {/* Adobe */}
            <div className="trusted-logo">
              <svg viewBox="0 0 200 52" aria-label="Adobe">
                <path
                  d="M72.8 0H54L29.2 52h12.4l6-13.2h20.8L62 26H47.6l12-26.4L78 52h12.4L72.8 0zM116 10.8c-2.8-3.2-6.8-5.2-12-5.2-10.8 0-18.4 8.4-18.4 20.8s7.6 20.8 18.4 20.8c5.2 0 9.2-2 12-5.2v4.4h9.6V6.4H116v4.4zm-10 28c-6.4 0-10.8-4.8-10.8-12.4s4.4-12.4 10.8-12.4 10.8 4.8 10.8 12.4-4.4 12.4-10.8 12.4zm50.8-33.2c-12 0-20 8.4-20 20.8s8 20.8 20 20.8 20-8.4 20-20.8-8-20.8-20-20.8zm0 33.2c-6.4 0-10.8-4.8-10.8-12.4s4.4-12.4 10.8-12.4 10.8 4.8 10.8 12.4-4.4 12.4-10.8 12.4zM0 52h18.4L0 12v40zm18.4-52L0 0l18.4 40.8V0z"
                  fill="currentColor"
                />
              </svg>
            </div>

            {/* Warner Bros */}
            <div className="trusted-logo">
              <svg viewBox="0 0 360 60" aria-label="Warner Bros">
                <path
                  d="M42.4 5.2L34 32.8 25.6 5.2H16L7.6 32.8 0 5.2h-9.6L3.6 48.8h10L22 22l8.4 26.8h10l13.2-43.6h-11.2zm44 0l-17.2 43.6h9.2l3.6-10h15.6l3.6 10h9.2L93.2 5.2h-6.8zm-2.8 26.4l5.2-14.4 5.2 14.4h-10.4zm72-26.4h-8.8v15.2h-8.8V5.2h-8.8v43.6h8.8V28.4h8.8v20.4h8.8V5.2zm32.4 0v23.2L169.6 5.2h-8.4v43.6h8.4V26.4l18.4 22.4h8.4V5.2H188zm40 0H204v43.6h24v-8h-15.2V31.6h13.2v-8h-13.2V13.2H228v-8zm61.2 14c0-8.8-6.4-14-16.8-14H253.6v43.6h8.8v-15.2h8.4l10 15.2h11.6l-11.2-16.4c5.2-2 8.8-6.4 8.8-13.2zm-17.6 6.8h-8v-12.8h8c5.6 0 8.8 2.8 8.8 6.4s-3.2 6.4-8.8 6.4zm88 7.6c0-5.2-3.6-8-9.6-8.8l-6-1c-3.2-.4-4.8-1.6-4.8-3.6 0-2.4 2.4-4.4 6.8-4.4 4.8 0 7.6 2 8.8 5.6l7.6-2.8c-2-6-7.6-10.4-16.4-10.4-9.6 0-16 5.6-16 13.2 0 6.8 4.8 10.8 12.4 11.6l6 .8c3.2.4 4.8 1.6 4.8 4 0 2.8-2.8 4.8-7.6 4.8-5.6 0-9.2-2.4-10.8-6.8l-7.6 3.2c2.4 7.6 9.6 12.8 19.2 12.8 10.4 0 17.2-5.6 17.2-14z"
                  fill="currentColor"
                />
              </svg>
            </div>
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
