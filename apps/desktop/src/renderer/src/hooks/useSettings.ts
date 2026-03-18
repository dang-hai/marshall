import { useState, useCallback, useEffect } from "react";
import type { AppSettings } from "../../../shared/settings";

export type { AppSettings } from "../../../shared/settings";

export function buildSectionUpdate<K extends keyof AppSettings>(
  settings: AppSettings | null,
  key: K,
  updates: Partial<AppSettings[K]>
): Pick<AppSettings, K> | null {
  if (!settings) {
    return null;
  }

  return {
    [key]: { ...settings[key], ...updates },
  } as Pick<AppSettings, K>;
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const allSettings = await window.settingsAPI.getAll();
      setSettings(allSettings);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load settings";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateSettings = useCallback(async (updates: Partial<AppSettings>) => {
    try {
      setError(null);
      const newSettings = await window.settingsAPI.update(updates);
      setSettings(newSettings);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update settings";
      setError(message);
      return false;
    }
  }, []);

  const updateSection = useCallback(
    async <K extends keyof AppSettings>(key: K, updates: Partial<AppSettings[K]>) => {
      const nextUpdate = buildSectionUpdate(settings, key, updates);
      if (!nextUpdate) {
        return false;
      }

      return updateSettings(nextUpdate);
    },
    [settings, updateSettings]
  );

  const resetSettings = useCallback(async () => {
    try {
      setError(null);
      const defaultSettings = await window.settingsAPI.reset();
      setSettings(defaultSettings);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to reset settings";
      setError(message);
      return false;
    }
  }, []);

  return {
    settings,
    loading,
    error,
    loadSettings,
    updateSettings,
    updateSection,
    resetSettings,
  };
}
