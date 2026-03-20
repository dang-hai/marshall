import { useState, useCallback, useEffect, useRef } from "react";
import type { NoteTranscriptionSnapshot } from "@marshall/shared";
import { useAudioCapture, type AudioSource } from "./useAudioCapture";

export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string | null;
}

export interface TranscriptionUtterance {
  id: string;
  start: number;
  end: number;
  text: string;
  speaker?: string | null;
}

export interface TranscriptionResult {
  text: string;
  language: string;
  segments: TranscriptionSegment[];
  utterances: TranscriptionUtterance[];
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
  lastSegmentIndex: number | null;
  /** Accumulated final transcription text */
  finalText: string;
  /** Current interim (in-progress) text that may change */
  interimText: string;
  /** Combined display text: finalText + interimText */
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

function offsetSegments(segments: TranscriptionSegment[], offsetSeconds: number) {
  return segments.map((segment) => ({
    ...segment,
    start: segment.start + offsetSeconds,
    end: segment.end + offsetSeconds,
  }));
}

function offsetUtterances(utterances: TranscriptionUtterance[], offsetSeconds: number) {
  return utterances.map((utterance) => ({
    ...utterance,
    start: utterance.start + offsetSeconds,
    end: utterance.end + offsetSeconds,
  }));
}

function createUtterancesFromSegments(
  segments: TranscriptionSegment[] = []
): TranscriptionUtterance[] {
  return segments
    .filter((segment) => segment.text.trim())
    .map((segment, index) => ({
      id: `utt-${index}-${segment.start.toFixed(3)}-${segment.end.toFixed(3)}`,
      start: segment.start,
      end: segment.end,
      text: segment.text.trim(),
      speaker: segment.speaker ?? null,
    }));
}

function normalizeUtterances(
  utterances: TranscriptionUtterance[] | undefined,
  segments: TranscriptionSegment[]
): TranscriptionUtterance[] {
  if (utterances?.length) {
    return utterances.filter((utterance) => utterance.text.trim());
  }

  return createUtterancesFromSegments(segments);
}

function formatTranscriptUtterances(
  utterances: TranscriptionUtterance[],
  fallbackText = ""
): string {
  const normalizedUtterances = utterances.filter((utterance) => utterance.text.trim());
  if (normalizedUtterances.length === 0) {
    return fallbackText.trim();
  }

  if (!normalizedUtterances.some((utterance) => utterance.speaker)) {
    return (
      fallbackText.trim() ||
      normalizedUtterances
        .map((utterance) => utterance.text.trim())
        .join(" ")
        .trim()
    );
  }

  return normalizedUtterances
    .map((utterance) =>
      utterance.speaker ? `${utterance.speaker}: ${utterance.text.trim()}` : utterance.text.trim()
    )
    .join("\n")
    .trim();
}

function mergeTranscriptText(baseText: string, incomingText: string): string {
  const trimmedBase = baseText.trim();
  const trimmedIncoming = incomingText.trim();

  if (!trimmedBase) {
    return trimmedIncoming;
  }

  if (!trimmedIncoming) {
    return trimmedBase;
  }

  const separator = trimmedBase.includes("\n") || trimmedIncoming.includes("\n") ? "\n" : " ";
  return `${trimmedBase}${separator}${trimmedIncoming}`.trim();
}

export function snapshotToTranscript(
  snapshot: NoteTranscriptionSnapshot | null
): TranscriptionResult | null {
  if (!snapshot) {
    return null;
  }

  const fallbackText = snapshot.transcriptText.trim()
    ? snapshot.transcriptText.trim()
    : mergeTranscriptText(snapshot.finalText, snapshot.interimText);
  const utterances = normalizeUtterances(snapshot.utterances, snapshot.segments);
  const text = formatTranscriptUtterances(utterances, fallbackText);

  if (
    !text &&
    snapshot.segments.length === 0 &&
    utterances.length === 0 &&
    snapshot.durationSeconds <= 0
  ) {
    return null;
  }

  return {
    text,
    language: snapshot.language,
    segments: snapshot.segments,
    utterances,
    duration: snapshot.durationSeconds,
  };
}

export function mergeTranscriptionResults(
  base: TranscriptionResult | null,
  incoming: TranscriptionResult
): TranscriptionResult {
  const incomingUtterances = normalizeUtterances(incoming.utterances, incoming.segments);
  const normalizedIncoming = {
    ...incoming,
    utterances: incomingUtterances,
    text: formatTranscriptUtterances(incomingUtterances, incoming.text),
  };

  if (!base) {
    return normalizedIncoming;
  }

  const baseText = base.text.trim();
  const incomingText = normalizedIncoming.text.trim();
  const mergedSegments = [
    ...base.segments,
    ...offsetSegments(normalizedIncoming.segments, base.duration),
  ];
  const mergedUtterances = [
    ...base.utterances,
    ...offsetUtterances(incomingUtterances, base.duration),
  ];

  return {
    text: formatTranscriptUtterances(mergedUtterances, mergeTranscriptText(baseText, incomingText)),
    language: incoming.language || base.language,
    segments: mergedSegments,
    utterances: mergedUtterances,
    duration: base.duration + incoming.duration,
  };
}

export function useTranscription(options: UseTranscriptionOptions = {}) {
  const { streamingEnabled = true, vadEnabled = true, vadThreshold = 0.015 } = options;
  const initializedRef = useRef(false);
  const stateRef = useRef<TranscriptionState | null>(null);
  const resumeBaseRef = useRef<TranscriptionResult | null>(null);

  const [state, setState] = useState<TranscriptionState>({
    isInitialized: false,
    isRecording: false,
    isTranscribing: false,
    currentModel: null,
    mode: null,
    transcript: null,
    lastSegmentIndex: null,
    finalText: "",
    interimText: "",
    partialText: "",
    error: null,
    progress: 0,
    recordingDuration: 0,
    isSpeaking: false,
    vadLevel: 0,
  });

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const mergeWithResumeBase = useCallback((result: TranscriptionResult) => {
    return mergeTranscriptionResults(resumeBaseRef.current, result);
  }, []);

  const [models, setModels] = useState<ModelInfo[]>([]);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<{
    modelName: string;
    percent: number;
  } | null>(null);

  // Audio capture hook with chunk callback
  const audioCapture = useAudioCapture({
    sampleRate: 48000,
    onChunk: useCallback((chunk: Float32Array, isStereo: boolean) => {
      // Convert Float32Array to regular array for IPC
      const chunkArray = Array.from(chunk);
      window.transcriptionAPI.addChunk(chunkArray, isStereo).catch((err) => {
        console.error("Failed to add audio chunk:", err);
      });
    }, []),
  });
  const { startCapture, stopCapture, duration: captureDuration } = audioCapture;

  // Set up event listeners
  useEffect(() => {
    const unsubProgress = window.transcriptionAPI.onProgress((percent) => {
      setState((prev) => ({ ...prev, progress: percent }));
    });

    const unsubPartial = window.transcriptionAPI.onPartial((partial) => {
      setState((prev) => {
        if (partial.isFinal) {
          // Final result: append to finalText, clear interimText
          const newFinalText = mergeTranscriptText(prev.finalText, partial.text);
          return {
            ...prev,
            lastSegmentIndex: partial.segmentIndex,
            finalText: newFinalText,
            interimText: "",
            partialText: newFinalText,
          };
        } else {
          // Interim result: replace interimText (don't accumulate)
          const newPartialText = mergeTranscriptText(prev.finalText, partial.text);
          return {
            ...prev,
            lastSegmentIndex: partial.segmentIndex,
            interimText: partial.text,
            partialText: newPartialText,
          };
        }
      });
    });

    const unsubSegment = window.transcriptionAPI.onSegment((data) => {
      setState((prev) => {
        const nextTranscript = prev.transcript
          ? mergeTranscriptionResults(prev.transcript, data.result)
          : data.result;

        return {
          ...prev,
          transcript: nextTranscript,
        };
      });
    });

    const unsubComplete = window.transcriptionAPI.onComplete((result) => {
      const mergedResult = mergeWithResumeBase(result as TranscriptionResult);
      setState((prev) => ({
        ...prev,
        isTranscribing: false,
        transcript: mergedResult,
        finalText: mergedResult.text,
        interimText: "",
        partialText: mergedResult.text,
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

        initializedRef.current = true;
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
    async (source: AudioSource = "microphone", options?: { preserveExisting?: boolean }) => {
      if (!initializedRef.current) {
        setState((prev) => ({
          ...prev,
          error: "Transcription not initialized. Call initialize() first.",
        }));
        return false;
      }

      try {
        const preserveExisting = options?.preserveExisting ?? false;
        const currentState = stateRef.current;
        resumeBaseRef.current = preserveExisting ? (currentState?.transcript ?? null) : null;

        setState((prev) => ({
          ...prev,
          error: null,
          transcript: preserveExisting ? prev.transcript : null,
          lastSegmentIndex: preserveExisting ? prev.lastSegmentIndex : null,
          finalText: preserveExisting ? prev.finalText : "",
          interimText: preserveExisting ? prev.interimText : "",
          partialText: preserveExisting ? prev.partialText : "",
        }));

        // Start audio capture
        const captureStarted = await startCapture(source);
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
        stopCapture();
        return false;
      }
    },
    [startCapture, stopCapture]
  );

  const stopRecording = useCallback(async (): Promise<TranscriptionResult | null> => {
    // Stop audio capture
    stopCapture();

    setState((prev) => ({
      ...prev,
      isRecording: false,
      isTranscribing: true,
      progress: 0,
      recordingDuration: captureDuration,
    }));

    try {
      // Stop and transcribe
      const result = (await window.transcriptionAPI.stopAndTranscribe()) as TranscriptionResult;
      const mergedResult = mergeWithResumeBase(result);

      setState((prev) => ({
        ...prev,
        isTranscribing: false,
        transcript: mergedResult,
        finalText: mergedResult.text,
        interimText: "",
        partialText: mergedResult.text,
        progress: 100,
      }));

      return mergedResult;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Transcription failed";
      setState((prev) => ({
        ...prev,
        isTranscribing: false,
        error: message,
      }));
      return null;
    }
  }, [captureDuration, mergeWithResumeBase, stopCapture]);

  const cancel = useCallback(
    (options?: { clearTranscript?: boolean }) => {
      stopCapture();
      window.transcriptionAPI.cancel();

      setState((prev) => ({
        ...prev,
        isRecording: false,
        isTranscribing: false,
        progress: 0,
        finalText: options?.clearTranscript === false ? prev.finalText : "",
        interimText: options?.clearTranscript === false ? prev.interimText : "",
        partialText: options?.clearTranscript === false ? prev.partialText : "",
        transcript: options?.clearTranscript === false ? prev.transcript : null,
        lastSegmentIndex: options?.clearTranscript === false ? prev.lastSegmentIndex : null,
        isSpeaking: false,
        vadLevel: 0,
      }));
    },
    [stopCapture]
  );

  const clearTranscript = useCallback(() => {
    resumeBaseRef.current = null;
    setState((prev) => ({
      ...prev,
      transcript: null,
      lastSegmentIndex: null,
      error: null,
      finalText: "",
      interimText: "",
      partialText: "",
    }));
  }, []);

  const hydrateSnapshot = useCallback((snapshot: NoteTranscriptionSnapshot | null) => {
    resumeBaseRef.current = null;
    const transcript = snapshotToTranscript(snapshot);

    setState((prev) => ({
      ...prev,
      transcript,
      lastSegmentIndex: snapshot?.lastSegmentIndex ?? null,
      finalText: snapshot?.finalText ?? "",
      interimText: snapshot?.interimText ?? "",
      partialText:
        snapshot?.transcriptText ||
        [snapshot?.finalText?.trim() ?? "", snapshot?.interimText?.trim() ?? ""]
          .filter(Boolean)
          .join(" "),
      recordingDuration: snapshot?.recordingDurationSeconds ?? 0,
      error: snapshot?.error ?? null,
      isRecording: false,
      isTranscribing: false,
      progress: 0,
      isSpeaking: false,
      vadLevel: 0,
    }));
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
    hydrateSnapshot,
    setVADThreshold,
  };
}
