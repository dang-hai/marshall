import Store from "electron-store";
import { ipcMain } from "electron";
import type { WhisperModelName } from "@marshall/transcription";

export interface AppSettings {
  // Transcription settings
  transcription: {
    selectedModel: WhisperModelName;
    language: string;
    useGPU: boolean;
    streamingEnabled: boolean;
  };
  // Audio settings
  audio: {
    source: "microphone" | "system" | "both";
    sampleRate: number;
    vadThreshold: number;
    vadEnabled: boolean;
  };
  // UI settings
  ui: {
    showTimestamps: boolean;
    autoScroll: boolean;
    theme: "light" | "dark" | "system";
  };
  // Calendar settings
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
  // App settings
  app: {
    startMinimized: boolean;
    closeToTray: boolean;
    checkUpdates: boolean;
  };
}

const defaults: AppSettings = {
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

const store = new Store<AppSettings>({
  name: "marshall-settings",
  defaults,
  schema: {
    transcription: {
      type: "object",
      properties: {
        selectedModel: { type: "string" },
        language: { type: "string" },
        useGPU: { type: "boolean" },
        streamingEnabled: { type: "boolean" },
      },
      required: ["selectedModel", "language", "useGPU", "streamingEnabled"],
    },
    audio: {
      type: "object",
      properties: {
        source: { type: "string", enum: ["microphone", "system", "both"] },
        sampleRate: { type: "number" },
        vadThreshold: { type: "number" },
        vadEnabled: { type: "boolean" },
      },
      required: ["source", "sampleRate", "vadThreshold", "vadEnabled"],
    },
    ui: {
      type: "object",
      properties: {
        showTimestamps: { type: "boolean" },
        autoScroll: { type: "boolean" },
        theme: { type: "string", enum: ["light", "dark", "system"] },
      },
      required: ["showTimestamps", "autoScroll", "theme"],
    },
    calendar: {
      type: "object",
      properties: {
        visibleCalendars: {
          type: "object",
          properties: {
            work: { type: "boolean" },
            personal: { type: "boolean" },
            shared: { type: "boolean" },
          },
          required: ["work", "personal", "shared"],
        },
        showDeclinedEvents: { type: "boolean" },
        showWeekends: { type: "boolean" },
        compactView: { type: "boolean" },
      },
      required: ["visibleCalendars", "showDeclinedEvents", "showWeekends", "compactView"],
    },
    app: {
      type: "object",
      properties: {
        startMinimized: { type: "boolean" },
        closeToTray: { type: "boolean" },
        checkUpdates: { type: "boolean" },
      },
      required: ["startMinimized", "closeToTray", "checkUpdates"],
    },
  },
});

export function setupSettingsIPC(): void {
  // Get all settings
  ipcMain.handle("settings:get-all", () => {
    return store.store;
  });

  // Get specific setting
  ipcMain.handle("settings:get", (_event, key: keyof AppSettings) => {
    return store.get(key);
  });

  // Set specific setting
  ipcMain.handle(
    "settings:set",
    <K extends keyof AppSettings>(
      _event: Electron.IpcMainInvokeEvent,
      key: K,
      value: AppSettings[K]
    ) => {
      store.set(key, value);
      return true;
    }
  );

  // Update partial settings
  ipcMain.handle("settings:update", (_event, updates: Partial<AppSettings>) => {
    for (const [key, value] of Object.entries(updates)) {
      const existingValue = store.get(key as keyof AppSettings);
      if (typeof existingValue === "object" && typeof value === "object") {
        store.set(key as keyof AppSettings, { ...existingValue, ...value });
      } else {
        store.set(key as keyof AppSettings, value);
      }
    }
    return store.store;
  });

  // Reset to defaults
  ipcMain.handle("settings:reset", () => {
    store.clear();
    return store.store;
  });

  // Get setting path (for debugging)
  ipcMain.handle("settings:get-path", () => {
    return store.path;
  });
}

export function getSettings(): AppSettings {
  return store.store;
}

export function getSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
  return store.get(key);
}

export function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
  store.set(key, value);
}
