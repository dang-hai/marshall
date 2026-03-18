import { useState, useCallback, useEffect, useRef } from "react";
import { useAudioCapture, type AudioSource } from "./useAudioCapture";

export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptionResult {
  text: string;
  language: string;
  segments: TranscriptionSegment[];
  duration: number;
}

export interface PartialTranscription {
  text: string;
  isFinal: boolean;
  segmentIndex: number;
  timestamp: number;
}

export interface ModelInfo {
  name: string;
  size: string;
  downloaded: boolean;
  path: string;
}

export interface StorageInfo {
  totalSize: number;
  modelSizes: Record<string, number>;
  modelsDir: string;
}

export interface TranscriptionState {
  isInitialized: boolean;
  isRecording: boolean;
  isTranscribing: boolean;
  currentModel: string | null;
  mode: "streaming" | "batch" | null;
  transcript: TranscriptionResult | null;
  partialText: string;
  error: string | null;
  progress: number;
  recordingDuration: number;
  // VAD state
  isSpeaking: boolean;
  vadLevel: number;
}

export interface UseTranscriptionOptions {
  streamingEnabled?: boolean;
  vadEnabled?: boolean;
  vadThreshold?: number;
}

export function useTranscription(options: UseTranscriptionOptions = {}) {
  const { streamingEnabled = true, vadEnabled = true, vadThreshold = 0.015 } = options;

  const [state, setState] = useState<TranscriptionState>({
    isInitialized: false,
    isRecording: false,
    isTranscribing: false,
    currentModel: null,
    mode: null,
    transcript: null,
    partialText: "",
    error: null,
    progress: 0,
    recordingDuration: 0,
    isSpeaking: false,
    vadLevel: 0,
  });

  const [models, setModels] = useState<ModelInfo[]>([]);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<{
    modelName: string;
    percent: number;
  } | null>(null);

  // Partial transcriptions for streaming mode
  const [partials, setPartials] = useState<PartialTranscription[]>([]);

  const chunksRef = useRef<number[][]>([]);

  // Audio capture hook with chunk callback
  const audioCapture = useAudioCapture({
    sampleRate: 48000,
    onChunk: useCallback((chunk: Float32Array, isStereo: boolean) => {
      // Convert Float32Array to regular array for IPC
      chunksRef.current.push(Array.from(chunk));

      // Send chunk to main process
      window.transcriptionAPI.addChunk(Array.from(chunk), isStereo).catch((err) => {
        console.error("Failed to add audio chunk:", err);
      });
    }, []),
  });

  // Set up event listeners
  useEffect(() => {
    const unsubProgress = window.transcriptionAPI.onProgress((percent) => {
      setState((prev) => ({ ...prev, progress: percent }));
    });

    const unsubPartial = window.transcriptionAPI.onPartial((partial) => {
      setPartials((prev) => [...prev, partial]);
      setState((prev) => ({
        ...prev,
        partialText: prev.partialText + " " + partial.text,
      }));
    });

    const unsubSegment = window.transcriptionAPI.onSegment((data) => {
      // Segment completed - could add to a segments array if needed
      console.log("Segment completed:", data);
    });

    const unsubComplete = window.transcriptionAPI.onComplete((result) => {
      setState((prev) => ({
        ...prev,
        isTranscribing: false,
        transcript: result as TranscriptionResult,
        progress: 100,
      }));
    });

    const unsubError = window.transcriptionAPI.onError((error) => {
      setState((prev) => ({
        ...prev,
        isTranscribing: false,
        error,
      }));
    });

    const unsubDownload = window.transcriptionAPI.onDownloadProgress((progress) => {
      setDownloadProgress({
        modelName: progress.modelName,
        percent: progress.percent,
      });
    });

    // VAD events
    const unsubVADStart = window.transcriptionAPI.onVADSpeechStart(() => {
      setState((prev) => ({ ...prev, isSpeaking: true }));
    });

    const unsubVADEnd = window.transcriptionAPI.onVADSpeechEnd(() => {
      setState((prev) => ({ ...prev, isSpeaking: false }));
    });

    const unsubVADLevel = window.transcriptionAPI.onVADLevel((rms) => {
      setState((prev) => ({ ...prev, vadLevel: rms }));
    });

    return () => {
      unsubProgress();
      unsubPartial();
      unsubSegment();
      unsubComplete();
      unsubError();
      unsubDownload();
      unsubVADStart();
      unsubVADEnd();
      unsubVADLevel();
    };
  }, []);

  // Load models on mount
  useEffect(() => {
    loadModels();
    loadStorageInfo();
  }, []);

  const loadModels = useCallback(async () => {
    try {
      const modelList = await window.transcriptionAPI.getModels();
      setModels(modelList);
    } catch (err) {
      console.error("Failed to load models:", err);
    }
  }, []);

  const loadStorageInfo = useCallback(async () => {
    try {
      const info = await window.transcriptionAPI.getStorageInfo();
      setStorageInfo(info);
    } catch (err) {
      console.error("Failed to load storage info:", err);
    }
  }, []);

  const downloadModel = useCallback(
    async (modelName: string) => {
      try {
        setState((prev) => ({ ...prev, error: null }));
        setDownloadProgress({ modelName, percent: 0 });

        await window.transcriptionAPI.downloadModel(modelName);

        setDownloadProgress(null);
        await loadModels();
        await loadStorageInfo();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to download model";
        setState((prev) => ({ ...prev, error: message }));
        setDownloadProgress(null);
        return false;
      }
    },
    [loadModels, loadStorageInfo]
  );

  const deleteModel = useCallback(
    async (modelName: string) => {
      try {
        setState((prev) => ({ ...prev, error: null }));
        await window.transcriptionAPI.deleteModel(modelName);
        await loadModels();
        await loadStorageInfo();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete model";
        setState((prev) => ({ ...prev, error: message }));
        return false;
      }
    },
    [loadModels, loadStorageInfo]
  );

  const initialize = useCallback(
    async (modelName: string, language = "en", useGPU = true) => {
      try {
        setState((prev) => ({ ...prev, error: null }));

        // Check if model is downloaded
        const isDownloaded = await window.transcriptionAPI.isModelDownloaded(modelName);
        if (!isDownloaded) {
          setState((prev) => ({
            ...prev,
            error: `Model ${modelName} is not downloaded. Please download it first.`,
          }));
          return false;
        }

        const result = await window.transcriptionAPI.init({
          modelName,
          language,
          useGPU,
          streamingEnabled,
          vadEnabled,
          vadThreshold,
        });

        setState((prev) => ({
          ...prev,
          isInitialized: true,
          currentModel: modelName,
          mode: result.mode,
        }));

        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to initialize transcription";
        setState((prev) => ({ ...prev, error: message }));
        return false;
      }
    },
    [streamingEnabled, vadEnabled, vadThreshold]
  );

  const startRecording = useCallback(
    async (source: AudioSource = "microphone") => {
      if (!state.isInitialized) {
        setState((prev) => ({
          ...prev,
          error: "Transcription not initialized. Call initialize() first.",
        }));
        return false;
      }

      try {
        setState((prev) => ({
          ...prev,
          error: null,
          transcript: null,
          partialText: "",
        }));
        setPartials([]);
        chunksRef.current = [];

        // Start audio capture
        const captureStarted = await audioCapture.startCapture(source);
        if (!captureStarted) {
          return false;
        }

        // Start recording in main process
        await window.transcriptionAPI.startRecording(48000);

        setState((prev) => ({ ...prev, isRecording: true }));
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to start recording";
        setState((prev) => ({ ...prev, error: message }));
        audioCapture.stopCapture();
        return false;
      }
    },
    [state.isInitialized, audioCapture]
  );

  const stopRecording = useCallback(async (): Promise<TranscriptionResult | null> => {
    // Stop audio capture
    audioCapture.stopCapture();

    setState((prev) => ({
      ...prev,
      isRecording: false,
      isTranscribing: true,
      progress: 0,
      recordingDuration: audioCapture.duration,
    }));

    try {
      // Stop and transcribe
      const result = await window.transcriptionAPI.stopAndTranscribe();

      setState((prev) => ({
        ...prev,
        isTranscribing: false,
        transcript: result as TranscriptionResult,
        progress: 100,
      }));

      return result as TranscriptionResult;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Transcription failed";
      setState((prev) => ({
        ...prev,
        isTranscribing: false,
        error: message,
      }));
      return null;
    }
  }, [audioCapture]);

  const cancel = useCallback(() => {
    audioCapture.stopCapture();
    window.transcriptionAPI.cancel();
    chunksRef.current = [];
    setPartials([]);

    setState((prev) => ({
      ...prev,
      isRecording: false,
      isTranscribing: false,
      progress: 0,
      partialText: "",
      isSpeaking: false,
      vadLevel: 0,
    }));
  }, [audioCapture]);

  const clearTranscript = useCallback(() => {
    setState((prev) => ({
      ...prev,
      transcript: null,
      error: null,
      partialText: "",
    }));
    setPartials([]);
  }, []);

  const setVADThreshold = useCallback(async (threshold: number) => {
    try {
      await window.transcriptionAPI.setVADThreshold(threshold);
    } catch (err) {
      console.error("Failed to set VAD threshold:", err);
    }
  }, []);

  return {
    // State
    ...state,
    models,
    storageInfo,
    downloadProgress,
    partials,
    audioCapture,

    // Actions
    loadModels,
    loadStorageInfo,
    downloadModel,
    deleteModel,
    initialize,
    startRecording,
    stopRecording,
    cancel,
    clearTranscript,
    setVADThreshold,
  };
}
