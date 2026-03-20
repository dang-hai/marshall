import { contextBridge, ipcRenderer } from "electron";
import type {
  CodexMonitorNotePatch,
  CodexMonitorSessionInput,
  CodexMonitorState,
  CreateNoteInput,
  NoteRecord,
  NoteTranscriptionSnapshot,
  SaveNoteTranscriptionInput,
  UpdateNoteInput,
} from "@marshall/shared";
import type { DesktopNavigationRoute } from "../shared/navigation";
import type { AppSettings } from "../shared/settings";

// Electron API
contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  onNavigate: (callback: (path: DesktopNavigationRoute) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, path: DesktopNavigationRoute) =>
      callback(path);
    ipcRenderer.on("navigate", handler);
    return () => ipcRenderer.removeListener("navigate", handler);
  },
  navigate: (path: DesktopNavigationRoute) => {
    // Emit navigate event locally to trigger the listener in App.tsx
    ipcRenderer.emit("navigate", {}, path);
  },
  minimize: () => ipcRenderer.send("window:minimize"),
  maximize: () => ipcRenderer.send("window:maximize"),
  close: () => ipcRenderer.send("window:close"),
  openPath: (path: string) => ipcRenderer.invoke("shell:open-path", path),
});

// Auth API (custom desktop auth flow)
contextBridge.exposeInMainWorld("authAPI", {
  // Request authentication (opens browser)
  requestAuth: (options?: { provider?: string }) => ipcRenderer.invoke("auth:request", options),
  // Get stored auth token
  getToken: () => ipcRenderer.invoke("auth:get-token"),
  // Get current user from server
  getUser: () => ipcRenderer.invoke("auth:get-user"),
  // Sign out
  signOut: () => ipcRenderer.invoke("auth:sign-out"),
});

// Desktop Capturer API for system audio capture (via IPC - required for Electron 30+)
contextBridge.exposeInMainWorld("electron", {
  desktopCapturer: {
    getSources: (options: { types: Array<"screen" | "window"> }) =>
      ipcRenderer.invoke("desktop-capturer:get-sources", options),
  },
});

// Settings API
contextBridge.exposeInMainWorld("settingsAPI", {
  getAll: () => ipcRenderer.invoke("settings:get-all"),
  get: (key: string) => ipcRenderer.invoke("settings:get", key),
  set: (key: string, value: unknown) => ipcRenderer.invoke("settings:set", key, value),
  update: (updates: Record<string, unknown>) => ipcRenderer.invoke("settings:update", updates),
  reset: () => ipcRenderer.invoke("settings:reset"),
  getPath: () => ipcRenderer.invoke("settings:get-path"),
});

// Call Detection API
contextBridge.exposeInMainWorld("callDetectionAPI", {
  startMonitoring: () => ipcRenderer.invoke("call-detection:start-monitoring"),
  stopMonitoring: () => ipcRenderer.invoke("call-detection:stop-monitoring"),
  getDetectedCalls: () => ipcRenderer.invoke("call-detection:get-detected-calls"),
  dismissCall: (callId: string) => ipcRenderer.invoke("call-detection:dismiss-call", callId),
  isMonitoring: () => ipcRenderer.invoke("call-detection:is-monitoring"),

  // Events
  onCallDetected: (callback: (call: unknown) => void) => {
    ipcRenderer.on("call-detection:call-detected", (_event, call) => callback(call));
    return () => ipcRenderer.removeAllListeners("call-detection:call-detected");
  },
  onCallDismissed: (callback: (callId: string) => void) => {
    ipcRenderer.on("call-detection:call-dismissed", (_event, callId) => callback(callId));
    return () => ipcRenderer.removeAllListeners("call-detection:call-dismissed");
  },
});

contextBridge.exposeInMainWorld("notesAPI", {
  list: () => ipcRenderer.invoke("notes:list"),
  create: (input?: CreateNoteInput) => ipcRenderer.invoke("notes:create", input),
  update: (noteId: string, input: UpdateNoteInput) =>
    ipcRenderer.invoke("notes:update", noteId, input),
  saveTranscription: (noteId: string, input: SaveNoteTranscriptionInput) =>
    ipcRenderer.invoke("notes:save-transcription", noteId, input),
});

contextBridge.exposeInMainWorld("codexMonitorAPI", {
  updateSession: (input: CodexMonitorSessionInput) =>
    ipcRenderer.invoke("codex-monitor:update-session", input),
  clearSession: (noteId?: string) => ipcRenderer.invoke("codex-monitor:clear-session", noteId),
  getState: () => ipcRenderer.invoke("codex-monitor:get-state"),
  dismissWindow: () => ipcRenderer.invoke("codex-monitor:dismiss-window"),
  sendChat: (message: string) => ipcRenderer.invoke("codex-monitor:send-chat", message),
  onState: (callback: (state: CodexMonitorState) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: CodexMonitorState) =>
      callback(state);
    ipcRenderer.on("codex-monitor:state", handler);
    return () => ipcRenderer.removeListener("codex-monitor:state", handler);
  },
  onNotePatch: (callback: (patch: CodexMonitorNotePatch) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, patch: CodexMonitorNotePatch) =>
      callback(patch);
    ipcRenderer.on("codex-monitor:note-patch", handler);
    return () => ipcRenderer.removeListener("codex-monitor:note-patch", handler);
  },
});

// AI API
contextBridge.exposeInMainWorld("aiAPI", {
  completion: (input: { prompt: string; system?: string }) =>
    ipcRenderer.invoke("ai:completion", input),
});

// Transcription API
contextBridge.exposeInMainWorld("transcriptionAPI", {
  // Models
  getModels: () => ipcRenderer.invoke("transcription:get-models"),
  getStorageInfo: () => ipcRenderer.invoke("transcription:get-storage-info"),
  downloadModel: (modelName: string) =>
    ipcRenderer.invoke("transcription:download-model", modelName),
  deleteModel: (modelName: string) => ipcRenderer.invoke("transcription:delete-model", modelName),
  isModelDownloaded: (modelName: string) =>
    ipcRenderer.invoke("transcription:is-model-downloaded", modelName),

  // CoreML (macOS only)
  generateCoreML: (modelName: string) =>
    ipcRenderer.invoke("transcription:generate-coreml", modelName),
  isCoreMLAvailable: (modelName: string) =>
    ipcRenderer.invoke("transcription:is-coreml-available", modelName),

  // Permissions
  getPermissions: () => ipcRenderer.invoke("transcription:get-permissions"),
  requestMicPermission: () => ipcRenderer.invoke("transcription:request-mic-permission"),
  requestScreenPermission: () => ipcRenderer.invoke("transcription:request-screen-permission"),
  checkSystemAudio: () => ipcRenderer.invoke("transcription:check-system-audio"),

  // Transcription
  init: (config: {
    modelName: string;
    language?: string;
    useGPU?: boolean;
    streamingEnabled?: boolean;
    vadEnabled?: boolean;
    vadThreshold?: number;
  }) => ipcRenderer.invoke("transcription:init", config),
  startRecording: (sampleRate?: number) =>
    ipcRenderer.invoke("transcription:start-recording", sampleRate),
  addChunk: (chunkData: number[], isStereo?: boolean) =>
    ipcRenderer.invoke("transcription:add-chunk", chunkData, isStereo),
  stopAndTranscribe: () => ipcRenderer.invoke("transcription:stop-and-transcribe"),
  transcribeFile: (filePath: string) =>
    ipcRenderer.invoke("transcription:transcribe-file", filePath),
  cancel: () => ipcRenderer.invoke("transcription:cancel"),
  getStatus: () => ipcRenderer.invoke("transcription:get-status"),

  // VAD
  calibrateVAD: (samples: number[]) => ipcRenderer.invoke("transcription:calibrate-vad", samples),
  setVADThreshold: (threshold: number) =>
    ipcRenderer.invoke("transcription:set-vad-threshold", threshold),

  // Events
  onDownloadProgress: (callback: (progress: unknown) => void) => {
    ipcRenderer.on("transcription:download-progress", (_event, progress) => callback(progress));
    return () => ipcRenderer.removeAllListeners("transcription:download-progress");
  },
  onCoreMLProgress: (callback: (progress: unknown) => void) => {
    ipcRenderer.on("transcription:coreml-progress", (_event, progress) => callback(progress));
    return () => ipcRenderer.removeAllListeners("transcription:coreml-progress");
  },
  onProgress: (callback: (percent: number) => void) => {
    ipcRenderer.on("transcription:progress", (_event, percent) => callback(percent));
    return () => ipcRenderer.removeAllListeners("transcription:progress");
  },
  onPartial: (callback: (partial: unknown) => void) => {
    ipcRenderer.on("transcription:partial", (_event, partial) => callback(partial));
    return () => ipcRenderer.removeAllListeners("transcription:partial");
  },
  onSegment: (callback: (data: unknown) => void) => {
    ipcRenderer.on("transcription:segment", (_event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners("transcription:segment");
  },
  onComplete: (callback: (result: unknown) => void) => {
    ipcRenderer.on("transcription:complete", (_event, result) => callback(result));
    return () => ipcRenderer.removeAllListeners("transcription:complete");
  },
  onError: (callback: (error: string) => void) => {
    ipcRenderer.on("transcription:error", (_event, error) => callback(error));
    return () => ipcRenderer.removeAllListeners("transcription:error");
  },
  onVADSpeechStart: (callback: () => void) => {
    ipcRenderer.on("transcription:vad-speech-start", () => callback());
    return () => ipcRenderer.removeAllListeners("transcription:vad-speech-start");
  },
  onVADSpeechEnd: (callback: (duration: number) => void) => {
    ipcRenderer.on("transcription:vad-speech-end", (_event, duration) => callback(duration));
    return () => ipcRenderer.removeAllListeners("transcription:vad-speech-end");
  },
  onVADLevel: (callback: (rms: number) => void) => {
    ipcRenderer.on("transcription:vad-level", (_event, rms) => callback(rms));
    return () => ipcRenderer.removeAllListeners("transcription:vad-level");
  },
  onActivityState: (callback: (state: "idle" | "recording" | "transcribing") => void) => {
    ipcRenderer.on("transcription:activity-state", (_event, state) => callback(state));
    return () => ipcRenderer.removeAllListeners("transcription:activity-state");
  },
});

// Type declarations
interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string | null;
}

interface TranscriptionResult {
  text: string;
  language: string;
  segments: TranscriptionSegment[];
  duration: number;
}

interface PartialTranscription {
  text: string;
  isFinal: boolean;
  segmentIndex: number;
  timestamp: number;
}

interface SegmentData {
  result: TranscriptionResult;
  segmentIndex: number;
}

interface DownloadProgress {
  modelName: string;
  bytesDownloaded: number;
  totalBytes: number;
  percent: number;
}

interface CoreMLProgress {
  modelName: string;
  stage: "starting" | "installing-deps" | "generating" | "complete" | "error";
  message: string;
}

interface ModelInfo {
  name: string;
  size: string;
  downloaded: boolean;
  coremlAvailable: boolean;
  path: string;
}

interface StorageInfo {
  totalSize: number;
  modelSizes: Record<string, number>;
  modelsDir: string;
  availableModels: Record<string, { size: string; url: string; bytes: number }>;
}

// AuthUser type matches @marshall/shared but declared inline for preload context isolation
type AuthUser = {
  id: string;
  email: string;
  name: string;
  image?: string;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
};

// Call detection types
interface DetectedCall {
  id: string;
  appName: string;
  appIcon?: string;
  detectedAt: number;
  dismissed: boolean;
}

declare global {
  interface Window {
    authAPI: {
      requestAuth: (options?: { provider?: string }) => Promise<string>;
      getToken: () => Promise<string | null>;
      getUser: () => Promise<AuthUser | null>;
      signOut: () => Promise<boolean>;
    };
    callDetectionAPI: {
      startMonitoring: () => Promise<{ status: string }>;
      stopMonitoring: () => Promise<{ status: string }>;
      getDetectedCalls: () => Promise<DetectedCall[]>;
      dismissCall: (callId: string) => Promise<{ status: string }>;
      isMonitoring: () => Promise<boolean>;
      onCallDetected: (callback: (call: DetectedCall) => void) => () => void;
      onCallDismissed: (callback: (callId: string) => void) => () => void;
    };
    electron: {
      desktopCapturer: {
        getSources: (options: {
          types: Array<"screen" | "window">;
          thumbnailSize?: { width: number; height: number };
          fetchWindowIcons?: boolean;
        }) => Promise<
          Array<{
            id: string;
            name: string;
            thumbnail: unknown;
            display_id: string;
            appIcon: unknown;
          }>
        >;
      };
    };
    electronAPI: {
      platform: string;
      onNavigate: (callback: (path: DesktopNavigationRoute) => void) => () => void;
      navigate: (path: DesktopNavigationRoute) => void;
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      openPath: (path: string) => Promise<string>;
    };
    settingsAPI: {
      getAll: () => Promise<AppSettings>;
      get: <K extends keyof AppSettings>(key: K) => Promise<AppSettings[K]>;
      set: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<boolean>;
      update: (updates: Partial<AppSettings>) => Promise<AppSettings>;
      reset: () => Promise<AppSettings>;
      getPath: () => Promise<string>;
    };
    notesAPI: {
      list: () => Promise<NoteRecord[]>;
      create: (input?: CreateNoteInput) => Promise<NoteRecord>;
      update: (noteId: string, input: UpdateNoteInput) => Promise<NoteRecord>;
      saveTranscription: (
        noteId: string,
        input: SaveNoteTranscriptionInput
      ) => Promise<NoteTranscriptionSnapshot>;
    };
    codexMonitorAPI?: {
      updateSession: (input: CodexMonitorSessionInput) => Promise<{ status: string }>;
      clearSession: (noteId?: string) => Promise<{ status: string }>;
      getState: () => Promise<CodexMonitorState>;
      dismissWindow: () => Promise<{ status: string }>;
      sendChat: (message: string) => Promise<{ status: string; response?: string; error?: string }>;
      onState: (callback: (state: CodexMonitorState) => void) => () => void;
      onNotePatch: (callback: (patch: CodexMonitorNotePatch) => void) => () => void;
    };
    aiAPI: {
      completion: (input: { prompt: string; system?: string }) => Promise<{ text: string }>;
    };
    transcriptionAPI: {
      // Models
      getModels: () => Promise<ModelInfo[]>;
      getStorageInfo: () => Promise<StorageInfo>;
      downloadModel: (modelName: string) => Promise<string>;
      deleteModel: (modelName: string) => Promise<{ status: string }>;
      isModelDownloaded: (modelName: string) => Promise<boolean>;

      // CoreML (macOS only)
      generateCoreML: (modelName: string) => Promise<string>;
      isCoreMLAvailable: (modelName: string) => Promise<boolean>;

      // Permissions
      getPermissions: () => Promise<{ microphone: string; screen: string }>;
      requestMicPermission: () => Promise<boolean>;
      requestScreenPermission: () => Promise<boolean>;
      checkSystemAudio: () => Promise<{
        available: boolean;
        method: string;
        requiresSetup: boolean;
        setupInstructions?: string;
      }>;

      // Transcription
      init: (config: {
        modelName: string;
        language?: string;
        useGPU?: boolean;
        streamingEnabled?: boolean;
        vadEnabled?: boolean;
        vadThreshold?: number;
      }) => Promise<{ status: string; mode: "streaming" | "batch" }>;
      startRecording: (sampleRate?: number) => Promise<{
        status: string;
        mode: "streaming" | "batch";
      }>;
      addChunk: (chunkData: number[], isStereo?: boolean) => Promise<{ status: string }>;
      stopAndTranscribe: () => Promise<TranscriptionResult>;
      transcribeFile: (filePath: string) => Promise<TranscriptionResult>;
      cancel: () => Promise<{ status: string }>;
      getStatus: () => Promise<{
        initialized: boolean;
        recording: boolean;
        duration: number;
        mode: "streaming" | "batch" | null;
        partialText?: string;
        activity?: "idle" | "recording" | "transcribing";
      }>;

      // VAD
      calibrateVAD: (samples: number[]) => Promise<{ threshold: number }>;
      setVADThreshold: (threshold: number) => Promise<{ status: string }>;

      // Events
      onDownloadProgress: (callback: (progress: DownloadProgress) => void) => () => void;
      onCoreMLProgress: (callback: (progress: CoreMLProgress) => void) => () => void;
      onProgress: (callback: (percent: number) => void) => () => void;
      onPartial: (callback: (partial: PartialTranscription) => void) => () => void;
      onSegment: (callback: (data: SegmentData) => void) => () => void;
      onComplete: (callback: (result: TranscriptionResult) => void) => () => void;
      onError: (callback: (error: string) => void) => () => void;
      onVADSpeechStart: (callback: () => void) => () => void;
      onVADSpeechEnd: (callback: (duration: number) => void) => () => void;
      onVADLevel: (callback: (rms: number) => void) => () => void;
      onActivityState: (
        callback: (state: "idle" | "recording" | "transcribing") => void
      ) => () => void;
    };
  }
}
