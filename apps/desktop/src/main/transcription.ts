import { ipcMain, BrowserWindow } from "electron";
import {
  Transcriber,
  StreamingTranscriber,
  DeepgramStreamingTranscriber,
  listAvailableModels,
  downloadModel,
  deleteModel,
  isModelDownloaded,
  isCoreMLEncoderAvailable,
  generateCoreMLEncoder,
  getModelPath,
  getModelsDirectory,
  checkSystemAudioCapability,
  WHISPER_MODELS,
  type TranscriptionResult,
  type WhisperModelName,
  type PartialTranscription,
  type DeepgramPartialTranscription,
  type DeepgramTranscriptionResult,
  type CoreMLGenerationProgress,
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
let deepgramTranscriber: DeepgramStreamingTranscriber | null = null;

const LIVE_TRANSCRIPTION_MIN_SPEECH_MS = 120;
const LIVE_TRANSCRIPTION_SILENCE_TIMEOUT_MS = 250;
const LIVE_TRANSCRIPTION_MIN_SEGMENT_SECONDS = 0.35;
const LIVE_TRANSCRIPTION_MAX_SEGMENT_SECONDS = 12;
type TranscriptionActivityState = "idle" | "recording" | "transcribing";

export function setupTranscriptionIPC(getWindows: () => BrowserWindow[]): void {
  let activityState: TranscriptionActivityState = "idle";

  const broadcast = (channel: string, ...args: unknown[]) => {
    for (const window of getWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send(channel, ...args);
      }
    }
  };

  const setActivityState = (nextState: TranscriptionActivityState) => {
    activityState = nextState;
    broadcast("transcription:activity-state", nextState);
  };

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

  // Download a model (and auto-generate CoreML encoder on macOS)
  ipcMain.handle("transcription:download-model", async (_event, modelName: WhisperModelName) => {
    const modelPath = await downloadModel(modelName, (progress) => {
      broadcast("transcription:download-progress", progress);
    });

    // Auto-generate CoreML encoder on macOS if not already available
    if (process.platform === "darwin" && !isCoreMLEncoderAvailable(modelName)) {
      // Run CoreML generation in background (don't await - let it complete async)
      generateCoreMLEncoder(modelName, (progress: CoreMLGenerationProgress) => {
        broadcast("transcription:coreml-progress", progress);
      }).catch((err) => {
        console.error(`[CoreML] Failed to generate encoder for ${modelName}:`, err);
        broadcast("transcription:coreml-progress", {
          modelName,
          stage: "error",
          message: `Failed to generate CoreML encoder: ${err.message}`,
        });
      });
    }

    return modelPath;
  });

  // Manually trigger CoreML encoder generation
  ipcMain.handle("transcription:generate-coreml", async (_event, modelName: WhisperModelName) => {
    if (process.platform !== "darwin") {
      throw new Error("CoreML is only available on macOS");
    }

    return generateCoreMLEncoder(modelName, (progress: CoreMLGenerationProgress) => {
      broadcast("transcription:coreml-progress", progress);
    });
  });

  // Check CoreML encoder availability
  ipcMain.handle("transcription:is-coreml-available", (_event, modelName: WhisperModelName) => {
    return isCoreMLEncoderAvailable(modelName);
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
        modelName?: WhisperModelName;
        language?: string;
        useGPU?: boolean;
        streamingEnabled?: boolean;
        vadEnabled?: boolean;
        vadThreshold?: number;
        provider?: "local" | "deepgram";
        backendUrl?: string;
      }
    ) => {
      // Get settings defaults
      const audioSettings = getSetting("audio");
      const transcriptionSettings = getSetting("transcription");

      const provider = config.provider ?? transcriptionSettings.provider;
      const useStreaming = config.streamingEnabled ?? transcriptionSettings.streamingEnabled;
      const vadEnabled = config.vadEnabled ?? audioSettings.vadEnabled;
      const vadThreshold = config.vadThreshold ?? audioSettings.vadThreshold;

      // Clear previous transriber instances
      transcriber = null;
      streamingTranscriber = null;
      deepgramTranscriber = null;

      if (provider === "deepgram") {
        // Use Deepgram cloud transcription
        const backendUrl = config.backendUrl || process.env.BACKEND_URL || "http://localhost:3000";
        console.log("[Transcription] Initializing Deepgram with backend URL:", backendUrl);

        deepgramTranscriber = new DeepgramStreamingTranscriber({
          backendUrl,
          language: config.language || "en",
        });

        // Forward Deepgram events to renderer
        deepgramTranscriber.on("transcription:partial", (partial: DeepgramPartialTranscription) => {
          broadcast("transcription:partial", {
            text: partial.text,
            isFinal: partial.isFinal,
            segmentIndex: 0,
            timestamp: partial.timestamp,
          });
        });

        deepgramTranscriber.on("transcription:complete", (result: DeepgramTranscriptionResult) => {
          setActivityState("idle");
          broadcast("transcription:complete", result);
        });

        deepgramTranscriber.on("transcription:error", (error: Error) => {
          setActivityState("idle");
          broadcast("transcription:error", error.message);
        });

        // VAD events from Deepgram
        deepgramTranscriber.on("vad:speech-start", () => {
          broadcast("transcription:vad-speech-start");
        });

        deepgramTranscriber.on("vad:speech-end", () => {
          broadcast("transcription:vad-speech-end", 0);
        });

        return { status: "initialized", mode: "streaming", provider: "deepgram" };
      }

      // Local Whisper transcription
      const modelName = config.modelName ?? transcriptionSettings.selectedModel;
      const modelPath = getModelPath(modelName);

      if (!isModelDownloaded(modelName)) {
        throw new Error(`Model ${modelName} is not downloaded`);
      }

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
          broadcast("transcription:progress", percent);
        });

        streamingTranscriber.on("transcription:partial", (partial: PartialTranscription) => {
          broadcast("transcription:partial", partial);
        });

        streamingTranscriber.on(
          "transcription:segment",
          (result: TranscriptionResult, segmentIndex: number) => {
            broadcast("transcription:segment", {
              result,
              segmentIndex,
            });
          }
        );

        streamingTranscriber.on("transcription:complete", (result: TranscriptionResult) => {
          setActivityState("idle");
          broadcast("transcription:complete", result);
        });

        streamingTranscriber.on("transcription:error", (error: Error) => {
          setActivityState("idle");
          broadcast("transcription:error", error.message);
        });

        // VAD events
        streamingTranscriber.on("vad:speech-start", () => {
          broadcast("transcription:vad-speech-start");
        });

        streamingTranscriber.on("vad:speech-end", (duration: number) => {
          broadcast("transcription:vad-speech-end", duration);
        });

        streamingTranscriber.on("vad:level", (rms: number) => {
          broadcast("transcription:vad-level", rms);
        });
      } else {
        // Use regular transcriber for batch mode
        transcriber = new Transcriber({
          modelPath,
          language: config.language || "en",
          useGPU: config.useGPU !== false,
        });

        // Forward events to renderer
        transcriber.on("transcription:progress", (percent) => {
          broadcast("transcription:progress", percent);
        });

        transcriber.on("transcription:complete", (result: TranscriptionResult) => {
          setActivityState("idle");
          broadcast("transcription:complete", result);
        });

        transcriber.on("transcription:error", (error: Error) => {
          setActivityState("idle");
          broadcast("transcription:error", error.message);
        });
      }

      return {
        status: "initialized",
        mode: useStreaming ? "streaming" : "batch",
        provider: "local",
      };
    }
  );

  // Start recording
  ipcMain.handle("transcription:start-recording", (_event, sampleRate?: number) => {
    const activeTranscriber = deepgramTranscriber || streamingTranscriber || transcriber;
    if (!activeTranscriber) {
      throw new Error("Transcriber not initialized. Call transcription:init first.");
    }

    if (sampleRate) {
      activeTranscriber.setSourceSampleRate(sampleRate);
    }

    activeTranscriber.startRecording();
    setActivityState("recording");

    const mode = deepgramTranscriber ? "deepgram" : streamingTranscriber ? "streaming" : "batch";
    return { status: "recording", mode };
  });

  // Add audio chunk (called from renderer with Float32Array)
  ipcMain.handle(
    "transcription:add-chunk",
    (_event, chunkData: number[], isStereo: boolean = false) => {
      const activeTranscriber = deepgramTranscriber || streamingTranscriber || transcriber;
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
    const activeTranscriber = deepgramTranscriber || streamingTranscriber || transcriber;
    if (!activeTranscriber) {
      throw new Error("Transcriber not initialized");
    }

    setActivityState("transcribing");
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
    if (deepgramTranscriber) {
      deepgramTranscriber.cancel();
    }
    if (streamingTranscriber) {
      streamingTranscriber.cancel();
    }
    if (transcriber) {
      transcriber.cancel();
    }
    setActivityState("idle");
    return { status: "cancelled" };
  });

  // Get recording status
  ipcMain.handle("transcription:get-status", () => {
    const activeTranscriber = deepgramTranscriber || streamingTranscriber || transcriber;
    if (!activeTranscriber) {
      return { initialized: false, recording: false, duration: 0, mode: null, provider: null };
    }

    let mode: string;
    let provider: string;
    if (deepgramTranscriber) {
      mode = "streaming";
      provider = "deepgram";
    } else if (streamingTranscriber) {
      mode = "streaming";
      provider = "local";
    } else {
      mode = "batch";
      provider = "local";
    }

    return {
      initialized: true,
      recording: activeTranscriber.getIsRecording(),
      duration: activeTranscriber.getRecordingDuration(),
      mode,
      provider,
      partialText:
        deepgramTranscriber?.getPartialTranscription() ||
        streamingTranscriber?.getPartialTranscription() ||
        "",
      activity: activityState,
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
