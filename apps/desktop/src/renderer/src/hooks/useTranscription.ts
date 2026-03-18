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

export interface ModelInfo {
  name: string;
  size: string;
  downloaded: boolean;
  path: string;
}

export interface TranscriptionState {
  isInitialized: boolean;
  isRecording: boolean;
  isTranscribing: boolean;
  currentModel: string | null;
  transcript: TranscriptionResult | null;
  error: string | null;
  progress: number;
  recordingDuration: number;
}

export function useTranscription() {
  const [state, setState] = useState<TranscriptionState>({
    isInitialized: false,
    isRecording: false,
    isTranscribing: false,
    currentModel: null,
    transcript: null,
    error: null,
    progress: 0,
    recordingDuration: 0,
  });

  const [models, setModels] = useState<ModelInfo[]>([]);
  const [downloadProgress, setDownloadProgress] = useState<{
    modelName: string;
    percent: number;
  } | null>(null);

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

    return () => {
      unsubProgress();
      unsubComplete();
      unsubError();
      unsubDownload();
    };
  }, []);

  // Load models on mount
  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = useCallback(async () => {
    try {
      const modelList = await window.transcriptionAPI.getModels();
      setModels(modelList);
    } catch (err) {
      console.error("Failed to load models:", err);
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
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to download model";
        setState((prev) => ({ ...prev, error: message }));
        setDownloadProgress(null);
        return false;
      }
    },
    [loadModels]
  );

  const initialize = useCallback(async (modelName: string, language = "en", useGPU = true) => {
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

      await window.transcriptionAPI.init({ modelName, language, useGPU });

      setState((prev) => ({
        ...prev,
        isInitialized: true,
        currentModel: modelName,
      }));

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to initialize transcription";
      setState((prev) => ({ ...prev, error: message }));
      return false;
    }
  }, []);

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
        setState((prev) => ({ ...prev, error: null, transcript: null }));
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

  const stopRecording = useCallback(async () => {
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
        transcript: result,
        progress: 100,
      }));

      return result;
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

    setState((prev) => ({
      ...prev,
      isRecording: false,
      isTranscribing: false,
      progress: 0,
    }));
  }, [audioCapture]);

  const clearTranscript = useCallback(() => {
    setState((prev) => ({ ...prev, transcript: null, error: null }));
  }, []);

  return {
    // State
    ...state,
    models,
    downloadProgress,
    audioCapture,

    // Actions
    loadModels,
    downloadModel,
    initialize,
    startRecording,
    stopRecording,
    cancel,
    clearTranscript,
  };
}
