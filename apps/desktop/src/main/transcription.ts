import { ipcMain, BrowserWindow } from "electron";
import {
  Transcriber,
  listAvailableModels,
  downloadModel,
  isModelDownloaded,
  getModelPath,
  checkSystemAudioCapability,
  type TranscriptionResult,
  type WhisperModelName,
} from "@marshall/transcription";
import {
  getPermissions,
  requestMicrophonePermission,
  requestScreenPermission,
} from "./permissions";

let transcriber: Transcriber | null = null;

export function setupTranscriptionIPC(mainWindow: BrowserWindow): void {
  // Get available models
  ipcMain.handle("transcription:get-models", () => {
    return listAvailableModels();
  });

  // Download a model
  ipcMain.handle("transcription:download-model", async (_event, modelName: WhisperModelName) => {
    return downloadModel(modelName, (progress) => {
      mainWindow.webContents.send("transcription:download-progress", progress);
    });
  });

  // Check if model is downloaded
  ipcMain.handle("transcription:is-model-downloaded", (_event, modelName: WhisperModelName) => {
    return isModelDownloaded(modelName);
  });

  // Get permissions status
  ipcMain.handle("transcription:get-permissions", () => {
    return getPermissions();
  });

  // Request microphone permission
  ipcMain.handle("transcription:request-mic-permission", async () => {
    return requestMicrophonePermission();
  });

  // Request screen permission
  ipcMain.handle("transcription:request-screen-permission", async () => {
    return requestScreenPermission();
  });

  // Check system audio capability
  ipcMain.handle("transcription:check-system-audio", () => {
    return checkSystemAudioCapability();
  });

  // Initialize transcriber with a model
  ipcMain.handle(
    "transcription:init",
    async (
      _event,
      config: {
        modelName: WhisperModelName;
        language?: string;
        useGPU?: boolean;
      }
    ) => {
      const modelPath = getModelPath(config.modelName);

      if (!isModelDownloaded(config.modelName)) {
        throw new Error(`Model ${config.modelName} is not downloaded`);
      }

      transcriber = new Transcriber({
        modelPath,
        language: config.language || "en",
        useGPU: config.useGPU !== false,
      });

      // Forward events to renderer
      transcriber.on("transcription:progress", (percent) => {
        mainWindow.webContents.send("transcription:progress", percent);
      });

      transcriber.on("transcription:complete", (result: TranscriptionResult) => {
        mainWindow.webContents.send("transcription:complete", result);
      });

      transcriber.on("transcription:error", (error: Error) => {
        mainWindow.webContents.send("transcription:error", error.message);
      });

      return { status: "initialized" };
    }
  );

  // Start recording
  ipcMain.handle("transcription:start-recording", (_event, sampleRate?: number) => {
    if (!transcriber) {
      throw new Error("Transcriber not initialized. Call transcription:init first.");
    }

    if (sampleRate) {
      transcriber.setSourceSampleRate(sampleRate);
    }

    transcriber.startRecording();
    return { status: "recording" };
  });

  // Add audio chunk (called from renderer with Float32Array)
  ipcMain.handle(
    "transcription:add-chunk",
    (_event, chunkData: number[], isStereo: boolean = false) => {
      if (!transcriber) {
        throw new Error("Transcriber not initialized");
      }

      const chunk = new Float32Array(chunkData);
      transcriber.addAudioChunk(chunk, isStereo);
      return { status: "chunk-added" };
    }
  );

  // Stop recording and transcribe
  ipcMain.handle("transcription:stop-and-transcribe", async () => {
    if (!transcriber) {
      throw new Error("Transcriber not initialized");
    }

    const result = await transcriber.stopAndTranscribe();
    return result;
  });

  // Transcribe a file
  ipcMain.handle("transcription:transcribe-file", async (_event, filePath: string) => {
    if (!transcriber) {
      throw new Error("Transcriber not initialized");
    }

    return transcriber.transcribeFile(filePath);
  });

  // Cancel transcription
  ipcMain.handle("transcription:cancel", () => {
    if (transcriber) {
      transcriber.cancel();
    }
    return { status: "cancelled" };
  });

  // Get recording status
  ipcMain.handle("transcription:get-status", () => {
    if (!transcriber) {
      return { initialized: false, recording: false, duration: 0 };
    }

    return {
      initialized: true,
      recording: transcriber.getIsRecording(),
      duration: transcriber.getRecordingDuration(),
    };
  });
}
