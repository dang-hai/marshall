import { ipcMain, BrowserWindow } from "electron";
import {
  Transcriber,
  StreamingTranscriber,
  listAvailableModels,
  downloadModel,
  deleteModel,
  isModelDownloaded,
  getModelPath,
  getModelsDirectory,
  checkSystemAudioCapability,
  WHISPER_MODELS,
  type TranscriptionResult,
  type WhisperModelName,
  type PartialTranscription,
} from "@marshall/transcription";
import {
  getPermissions,
  requestMicrophonePermission,
  requestScreenPermission,
} from "./permissions";
import { getSetting } from "./settings";
import { statSync, readdirSync } from "fs";
import { join } from "path";

let transcriber: Transcriber | null = null;
let streamingTranscriber: StreamingTranscriber | null = null;

const LIVE_TRANSCRIPTION_MIN_SPEECH_MS = 120;
const LIVE_TRANSCRIPTION_SILENCE_TIMEOUT_MS = 250;
const LIVE_TRANSCRIPTION_MIN_SEGMENT_SECONDS = 0.35;
const LIVE_TRANSCRIPTION_MAX_SEGMENT_SECONDS = 12;

export function setupTranscriptionIPC(mainWindow: BrowserWindow): void {
  // Get available models with detailed info
  ipcMain.handle("transcription:get-models", () => {
    return listAvailableModels();
  });

  // Get model storage info
  ipcMain.handle("transcription:get-storage-info", () => {
    const modelsDir = getModelsDirectory();
    let totalSize = 0;
    const modelSizes: Record<string, number> = {};

    try {
      const files = readdirSync(modelsDir);
      for (const file of files) {
        if (file.endsWith(".bin")) {
          const filePath = join(modelsDir, file);
          const stats = statSync(filePath);
          totalSize += stats.size;
          const modelName = file.replace("ggml-", "").replace(".bin", "");
          modelSizes[modelName] = stats.size;
        }
      }
    } catch {
      // Directory might not exist yet
    }

    return {
      totalSize,
      modelSizes,
      modelsDir,
      availableModels: WHISPER_MODELS,
    };
  });

  // Download a model
  ipcMain.handle("transcription:download-model", async (_event, modelName: WhisperModelName) => {
    return downloadModel(modelName, (progress) => {
      mainWindow.webContents.send("transcription:download-progress", progress);
    });
  });

  // Delete a model
  ipcMain.handle("transcription:delete-model", async (_event, modelName: WhisperModelName) => {
    await deleteModel(modelName);
    return { status: "deleted" };
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
        streamingEnabled?: boolean;
        vadEnabled?: boolean;
        vadThreshold?: number;
      }
    ) => {
      const modelPath = getModelPath(config.modelName);

      if (!isModelDownloaded(config.modelName)) {
        throw new Error(`Model ${config.modelName} is not downloaded`);
      }

      // Get settings defaults
      const audioSettings = getSetting("audio");
      const transcriptionSettings = getSetting("transcription");

      const useStreaming = config.streamingEnabled ?? transcriptionSettings.streamingEnabled;
      const vadEnabled = config.vadEnabled ?? audioSettings.vadEnabled;
      const vadThreshold = config.vadThreshold ?? audioSettings.vadThreshold;

      if (useStreaming) {
        // Use streaming transcriber for real-time mode
        streamingTranscriber = new StreamingTranscriber({
          modelPath,
          language: config.language || "en",
          useGPU: config.useGPU !== false,
          streamingEnabled: true,
          vad: vadEnabled
            ? {
                threshold: vadThreshold,
                minSpeechDuration: LIVE_TRANSCRIPTION_MIN_SPEECH_MS,
                silenceTimeout: LIVE_TRANSCRIPTION_SILENCE_TIMEOUT_MS,
              }
            : undefined,
          minSegmentDuration: LIVE_TRANSCRIPTION_MIN_SEGMENT_SECONDS,
          maxSegmentDuration: LIVE_TRANSCRIPTION_MAX_SEGMENT_SECONDS,
        });

        // Forward streaming events to renderer
        streamingTranscriber.on("transcription:progress", (percent: number) => {
          mainWindow.webContents.send("transcription:progress", percent);
        });

        streamingTranscriber.on("transcription:partial", (partial: PartialTranscription) => {
          mainWindow.webContents.send("transcription:partial", partial);
        });

        streamingTranscriber.on(
          "transcription:segment",
          (result: TranscriptionResult, segmentIndex: number) => {
            mainWindow.webContents.send("transcription:segment", {
              result,
              segmentIndex,
            });
          }
        );

        streamingTranscriber.on("transcription:complete", (result: TranscriptionResult) => {
          mainWindow.webContents.send("transcription:complete", result);
        });

        streamingTranscriber.on("transcription:error", (error: Error) => {
          mainWindow.webContents.send("transcription:error", error.message);
        });

        // VAD events
        streamingTranscriber.on("vad:speech-start", () => {
          mainWindow.webContents.send("transcription:vad-speech-start");
        });

        streamingTranscriber.on("vad:speech-end", (duration: number) => {
          mainWindow.webContents.send("transcription:vad-speech-end", duration);
        });

        streamingTranscriber.on("vad:level", (rms: number) => {
          mainWindow.webContents.send("transcription:vad-level", rms);
        });

        transcriber = null;
      } else {
        // Use regular transcriber for batch mode
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

        streamingTranscriber = null;
      }

      return { status: "initialized", mode: useStreaming ? "streaming" : "batch" };
    }
  );

  // Start recording
  ipcMain.handle("transcription:start-recording", (_event, sampleRate?: number) => {
    const activeTranscriber = streamingTranscriber || transcriber;
    if (!activeTranscriber) {
      throw new Error("Transcriber not initialized. Call transcription:init first.");
    }

    if (sampleRate) {
      activeTranscriber.setSourceSampleRate(sampleRate);
    }

    activeTranscriber.startRecording();
    return { status: "recording", mode: streamingTranscriber ? "streaming" : "batch" };
  });

  // Add audio chunk (called from renderer with Float32Array)
  ipcMain.handle(
    "transcription:add-chunk",
    (_event, chunkData: number[], isStereo: boolean = false) => {
      const activeTranscriber = streamingTranscriber || transcriber;
      if (!activeTranscriber) {
        throw new Error("Transcriber not initialized");
      }

      const chunk = new Float32Array(chunkData);
      activeTranscriber.addAudioChunk(chunk, isStereo);
      return { status: "chunk-added" };
    }
  );

  // Stop recording and transcribe
  ipcMain.handle("transcription:stop-and-transcribe", async () => {
    const activeTranscriber = streamingTranscriber || transcriber;
    if (!activeTranscriber) {
      throw new Error("Transcriber not initialized");
    }

    const result = await activeTranscriber.stopAndTranscribe();
    return result;
  });

  // Transcribe a file
  ipcMain.handle("transcription:transcribe-file", async (_event, filePath: string) => {
    if (!transcriber) {
      throw new Error("Transcriber not initialized (file transcription requires batch mode)");
    }

    return transcriber.transcribeFile(filePath);
  });

  // Cancel transcription
  ipcMain.handle("transcription:cancel", () => {
    if (streamingTranscriber) {
      streamingTranscriber.cancel();
    }
    if (transcriber) {
      transcriber.cancel();
    }
    return { status: "cancelled" };
  });

  // Get recording status
  ipcMain.handle("transcription:get-status", () => {
    const activeTranscriber = streamingTranscriber || transcriber;
    if (!activeTranscriber) {
      return { initialized: false, recording: false, duration: 0, mode: null };
    }

    return {
      initialized: true,
      recording: activeTranscriber.getIsRecording(),
      duration: activeTranscriber.getRecordingDuration(),
      mode: streamingTranscriber ? "streaming" : "batch",
      partialText: streamingTranscriber?.getPartialTranscription() || "",
    };
  });

  // Calibrate VAD threshold
  ipcMain.handle("transcription:calibrate-vad", (_event, samples: number[]) => {
    if (!streamingTranscriber) {
      throw new Error("Streaming transcriber not initialized");
    }

    const chunk = new Float32Array(samples);
    const threshold = streamingTranscriber.calibrateVAD(chunk);
    return { threshold };
  });

  // Set VAD threshold manually
  ipcMain.handle("transcription:set-vad-threshold", (_event, threshold: number) => {
    if (streamingTranscriber) {
      streamingTranscriber.setVADThreshold(threshold);
    }
    return { status: "updated" };
  });
}
