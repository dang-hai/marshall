export type PrivacyPreferences = {
  analytics: boolean;
  marketing: boolean;
};

export const PRIVACY_PREFERENCES_STORAGE_KEY = "marshall-privacy-prefs";

export const DEFAULT_PRIVACY_PREFERENCES: PrivacyPreferences = {
  analytics: false,
  marketing: false,
};

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
