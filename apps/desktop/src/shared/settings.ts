import type { WhisperModelName } from "@marshall/transcription";

export interface AppSettings {
  transcription: {
    selectedModel: WhisperModelName;
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
  calendar: {
    visibleCalendars: {
      work: boolean;
      personal: boolean;
      shared: boolean;
    };
    showDeclinedEvents: boolean;
    showWeekends: boolean;
    compactView: boolean;
  };
  app: {
    startMinimized: boolean;
    closeToTray: boolean;
    checkUpdates: boolean;
  };
}

export const defaultAppSettings: AppSettings = {
  transcription: {
    selectedModel: "tiny.en",
    language: "en",
    useGPU: true,
    streamingEnabled: true,
  },
  audio: {
    source: "microphone",
    sampleRate: 48000,
    vadThreshold: 0.015,
    vadEnabled: true,
  },
  ui: {
    showTimestamps: true,
    autoScroll: true,
    theme: "system",
  },
  calendar: {
    visibleCalendars: {
      work: true,
      personal: true,
      shared: false,
    },
    showDeclinedEvents: true,
    showWeekends: false,
    compactView: false,
  },
  app: {
    startMinimized: false,
    closeToTray: true,
    checkUpdates: true,
  },
};
