import { contextBridge, ipcRenderer, desktopCapturer } from "electron";

// Electron API
contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  onNavigate: (callback: (path: string) => void) => {
    ipcRenderer.on("navigate", (_event, path) => callback(path));
  },
  minimize: () => ipcRenderer.send("window:minimize"),
  maximize: () => ipcRenderer.send("window:maximize"),
  close: () => ipcRenderer.send("window:close"),
});

// Desktop Capturer API for system audio capture
contextBridge.exposeInMainWorld("electron", {
  desktopCapturer: {
    getSources: (options: Electron.SourcesOptions) => desktopCapturer.getSources(options),
  },
});

// Transcription API
contextBridge.exposeInMainWorld("transcriptionAPI", {
  // Models
  getModels: () => ipcRenderer.invoke("transcription:get-models"),
  downloadModel: (modelName: string) =>
    ipcRenderer.invoke("transcription:download-model", modelName),
  isModelDownloaded: (modelName: string) =>
    ipcRenderer.invoke("transcription:is-model-downloaded", modelName),

  // Permissions
  getPermissions: () => ipcRenderer.invoke("transcription:get-permissions"),
  requestMicPermission: () => ipcRenderer.invoke("transcription:request-mic-permission"),
  requestScreenPermission: () => ipcRenderer.invoke("transcription:request-screen-permission"),
  checkSystemAudio: () => ipcRenderer.invoke("transcription:check-system-audio"),

  // Transcription
  init: (config: { modelName: string; language?: string; useGPU?: boolean }) =>
    ipcRenderer.invoke("transcription:init", config),
  startRecording: (sampleRate?: number) =>
    ipcRenderer.invoke("transcription:start-recording", sampleRate),
  addChunk: (chunkData: number[], isStereo?: boolean) =>
    ipcRenderer.invoke("transcription:add-chunk", chunkData, isStereo),
  stopAndTranscribe: () => ipcRenderer.invoke("transcription:stop-and-transcribe"),
  transcribeFile: (filePath: string) =>
    ipcRenderer.invoke("transcription:transcribe-file", filePath),
  cancel: () => ipcRenderer.invoke("transcription:cancel"),
  getStatus: () => ipcRenderer.invoke("transcription:get-status"),

  // Events
  onDownloadProgress: (callback: (progress: unknown) => void) => {
    ipcRenderer.on("transcription:download-progress", (_event, progress) => callback(progress));
    return () => ipcRenderer.removeAllListeners("transcription:download-progress");
  },
  onProgress: (callback: (percent: number) => void) => {
    ipcRenderer.on("transcription:progress", (_event, percent) => callback(percent));
    return () => ipcRenderer.removeAllListeners("transcription:progress");
  },
  onComplete: (callback: (result: unknown) => void) => {
    ipcRenderer.on("transcription:complete", (_event, result) => callback(result));
    return () => ipcRenderer.removeAllListeners("transcription:complete");
  },
  onError: (callback: (error: string) => void) => {
    ipcRenderer.on("transcription:error", (_event, error) => callback(error));
    return () => ipcRenderer.removeAllListeners("transcription:error");
  },
});

// Type declarations
declare global {
  interface Window {
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
      onNavigate: (callback: (path: string) => void) => void;
      minimize: () => void;
      maximize: () => void;
      close: () => void;
    };
    transcriptionAPI: {
      // Models
      getModels: () => Promise<
        Array<{ name: string; size: string; downloaded: boolean; path: string }>
      >;
      downloadModel: (modelName: string) => Promise<string>;
      isModelDownloaded: (modelName: string) => Promise<boolean>;

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
      }) => Promise<{ status: string }>;
      startRecording: (sampleRate?: number) => Promise<{ status: string }>;
      addChunk: (chunkData: number[], isStereo?: boolean) => Promise<{ status: string }>;
      stopAndTranscribe: () => Promise<{
        text: string;
        language: string;
        segments: Array<{ start: number; end: number; text: string }>;
        duration: number;
      }>;
      transcribeFile: (filePath: string) => Promise<{
        text: string;
        language: string;
        segments: Array<{ start: number; end: number; text: string }>;
        duration: number;
      }>;
      cancel: () => Promise<{ status: string }>;
      getStatus: () => Promise<{
        initialized: boolean;
        recording: boolean;
        duration: number;
      }>;

      // Events
      onDownloadProgress: (
        callback: (progress: {
          modelName: string;
          bytesDownloaded: number;
          totalBytes: number;
          percent: number;
        }) => void
      ) => () => void;
      onProgress: (callback: (percent: number) => void) => () => void;
      onComplete: (
        callback: (result: {
          text: string;
          language: string;
          segments: Array<{ start: number; end: number; text: string }>;
          duration: number;
        }) => void
      ) => () => void;
      onError: (callback: (error: string) => void) => () => void;
    };
  }
}
