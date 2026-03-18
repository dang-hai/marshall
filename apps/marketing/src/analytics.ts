export type PrivacyPreferences = {
  analytics: boolean;
  marketing: boolean;
};

export const PRIVACY_PREFERENCES_STORAGE_KEY = "marshall-privacy-prefs";

export const DEFAULT_PRIVACY_PREFERENCES: PrivacyPreferences = {
  analytics: false,
  marketing: false,
};

declare global {
  interface Window {
    dataLayer?: unknown[][];
    gtag?: (...args: unknown[]) => void;
  }
}

const measurementId = import.meta.env?.VITE_GA_MEASUREMENT_ID?.trim() ?? "";

let analyticsBootstrapped = false;
let consentState: PrivacyPreferences = DEFAULT_PRIVACY_PREFERENCES;

export function parsePrivacyPreferences(raw: string | null): PrivacyPreferences {
  if (!raw) {
    return DEFAULT_PRIVACY_PREFERENCES;
  }

  try {
    const parsed = JSON.parse(raw);

    return {
      analytics: parsed?.analytics === true,
      marketing: parsed?.marketing === true,
    };
  } catch {
    return DEFAULT_PRIVACY_PREFERENCES;
  }
}

export function getStoredPrivacyPreferences(): PrivacyPreferences {
  if (typeof window === "undefined") {
    return DEFAULT_PRIVACY_PREFERENCES;
  }

  try {
    return parsePrivacyPreferences(window.localStorage.getItem(PRIVACY_PREFERENCES_STORAGE_KEY));
  } catch {
    return DEFAULT_PRIVACY_PREFERENCES;
  }
}

export function hasStoredPrivacyPreferences(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(PRIVACY_PREFERENCES_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

export function savePrivacyPreferences(preferences: PrivacyPreferences): PrivacyPreferences {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(PRIVACY_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // Ignore storage write failures and still honor the in-memory preference change.
    }
  }

  return preferences;
}

function ensureAnalyticsLibrary() {
  if (
    analyticsBootstrapped ||
    !measurementId ||
    typeof window === "undefined" ||
    typeof document === "undefined"
  ) {
    return analyticsBootstrapped;
  }

  window.dataLayer = window.dataLayer ?? [];
  window.gtag =
    window.gtag ??
    ((...args: unknown[]) => {
      window.dataLayer?.push(args);
    });

  const existingScript = document.querySelector<HTMLScriptElement>(
    `script[data-marshall-analytics="${measurementId}"]`
  );

  if (!existingScript) {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    script.dataset.marshallAnalytics = measurementId;

    document.head.append(script);
  }

  window.gtag("consent", "default", {
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
  window.gtag("js", new Date());
  window.gtag("config", measurementId, { send_page_view: false });

  analyticsBootstrapped = true;

  return true;
}

export function syncAnalyticsConsent(preferences: PrivacyPreferences): boolean {
  consentState = preferences;

  if (!preferences.analytics && !analyticsBootstrapped) {
    return false;
  }

  if (!ensureAnalyticsLibrary() || !window.gtag) {
    return false;
  }

  window.gtag("consent", "update", {
    analytics_storage: preferences.analytics ? "granted" : "denied",
    ad_storage: preferences.marketing ? "granted" : "denied",
    ad_user_data: preferences.marketing ? "granted" : "denied",
    ad_personalization: preferences.marketing ? "granted" : "denied",
  });

  return preferences.analytics;
}

export function trackPageView(path = window.location.pathname + window.location.search) {
  if (
    !consentState.analytics ||
    !analyticsBootstrapped ||
    typeof window === "undefined" ||
    !window.gtag
  ) {
    return;
  }

  window.gtag("event", "page_view", {
    page_title: document.title,
    page_location: window.location.href,
    page_path: path,
  });
}

export function trackEvent(eventName: string, params: Record<string, string>) {
  if (!consentState.analytics || !analyticsBootstrapped || typeof window === "undefined") {
    return;
  }

  window.gtag?.("event", eventName, params);
}
