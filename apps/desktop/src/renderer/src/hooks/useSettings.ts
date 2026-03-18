import { useState, useCallback, useEffect } from "react";

export interface AppSettings {
  transcription: {
    selectedModel: string;
    language: string;
    useGPU: boolean;
    streamingEnabled: boolean;
  };
  audio: {
    source: "microphone" | "system" | "both";
    sampleRate: number;
    vadThreshold: number;
    vadEnabled: boolean;
  };
  ui: {
    showTimestamps: boolean;
    autoScroll: boolean;
    theme: "light" | "dark" | "system";
  };
  app: {
    startMinimized: boolean;
    closeToTray: boolean;
    checkUpdates: boolean;
  };
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

  const updateTranscription = useCallback(
    async (updates: Partial<AppSettings["transcription"]>) => {
      if (!settings) return false;
      return updateSettings({
        transcription: { ...settings.transcription, ...updates },
      });
    },
    [settings, updateSettings]
  );

  const updateAudio = useCallback(
    async (updates: Partial<AppSettings["audio"]>) => {
      if (!settings) return false;
      return updateSettings({
        audio: { ...settings.audio, ...updates },
      });
    },
    [settings, updateSettings]
  );

  const updateUI = useCallback(
    async (updates: Partial<AppSettings["ui"]>) => {
      if (!settings) return false;
      return updateSettings({
        ui: { ...settings.ui, ...updates },
      });
    },
    [settings, updateSettings]
  );

  const updateApp = useCallback(
    async (updates: Partial<AppSettings["app"]>) => {
      if (!settings) return false;
      return updateSettings({
        app: { ...settings.app, ...updates },
      });
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
    updateTranscription,
    updateAudio,
    updateUI,
    updateApp,
    resetSettings,
  };
}
