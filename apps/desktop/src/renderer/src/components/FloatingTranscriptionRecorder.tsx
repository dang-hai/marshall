import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mic, Square, X, Settings2 } from "lucide-react";
import type { NoteTranscriptionSnapshot, SaveNoteTranscriptionInput } from "@marshall/shared";
import type { WhisperModelName } from "@marshall/transcription";
import { defaultAppSettings } from "../../../shared/settings";
import { DESKTOP_NAVIGATION_ROUTES } from "../../../shared/navigation";
import { useSettings } from "../hooks/useSettings";
import {
  useTranscription,
  type ModelInfo,
  type TranscriptionResult,
  type TranscriptionUtterance,
} from "../hooks/useTranscription";
import { cn } from "../lib/utils";
import { extractPlainTextFromHtml } from "../lib/note-body";
import { ModelSetupDialog } from "./ModelSetupDialog";

const FALLBACK_MODEL = defaultAppSettings.transcription.selectedModel;

/**
 * Creates a fingerprint of snapshot content fields (shared between SaveNoteTranscriptionInput
 * and NoteTranscriptionSnapshot). This allows comparing if the actual transcription content
 * matches what we just saved, ignoring metadata fields like id/noteId/createdAt/updatedAt.
 */
function getSnapshotContentFingerprint(
  snapshot: SaveNoteTranscriptionInput | NoteTranscriptionSnapshot | null
): string | null {
  if (!snapshot) {
    return null;
  }

  // Use consistent field order for reliable comparison
  const contentFields = [
    snapshot.status,
    snapshot.provider,
    snapshot.mode,
    snapshot.language,
    snapshot.model,
    snapshot.transcriptText,
    snapshot.finalText,
    snapshot.interimText,
    JSON.stringify(snapshot.segments),
    JSON.stringify(snapshot.utterances),
    snapshot.lastSegmentIndex,
    snapshot.durationSeconds,
    snapshot.recordingDurationSeconds,
    snapshot.error,
    snapshot.startedAt,
    snapshot.completedAt,
    snapshot.lastPartialAt,
  ];

  return JSON.stringify(contentFields);
}

const SOUNDWAVE_CSS = `
@keyframes soundwave {
  0%, 100% { height: 4px; }
  50% { height: 16px; }
}
.animate-soundwave {
  animation: soundwave 0.8s ease-in-out infinite;
}
`;

const STATIC_WAVE_HEIGHTS = [4, 8, 12, 8, 4] as const;

/**
 * Formats seconds to m:ss format (e.g., 0:12, 1:34, 10:05)
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Returns a consistent side (left/right) for each unique speaker.
 * First speaker seen gets left, second gets right, then alternates.
 */
function getSpeakerSide(
  speaker: string | null | undefined,
  speakerMap: Map<string, "left" | "right">
): "left" | "right" {
  if (!speaker) return "left";

  if (!speakerMap.has(speaker)) {
    const side = speakerMap.size % 2 === 0 ? "left" : "right";
    speakerMap.set(speaker, side);
  }

  return speakerMap.get(speaker)!;
}

function isTranscriptionInProgress(
  status: SaveNoteTranscriptionInput["status"] | null | undefined
) {
  return status === "recording" || status === "transcribing";
}

export function getSnapshotSaveDelayMs(status: SaveNoteTranscriptionInput["status"]) {
  return isTranscriptionInProgress(status) ? 0 : 300;
}

export interface RecorderResolvedModel {
  model: ModelInfo | null;
  selectedModelName: string;
  usingFallback: boolean;
}

export interface FloatingTranscriptionRecorderViewProps {
  downloadProgressPercent: number;
  error: string | null;
  isBootstrapping: boolean;
  isDownloadingModel: boolean;
  isExpanded: boolean;
  isModelDialogOpen: boolean;
  isRecording: boolean;
  isTranscribing: boolean;
  onClose: () => void;
  onDismissModelDialog: () => void;
  onDownloadModel: () => void;
  onOpen: () => void;
  onOpenSettings: () => void;
  onRecordAgain: () => void;
  onStopRecording: () => void;
  interimText: string;
  partialText: string;
  progress: number;
  resolvedModel: RecorderResolvedModel;
  selectedModelSize: string;
  transcript: TranscriptionResult | null;
}

export function resolveRecorderModel(
  models: ModelInfo[],
  selectedModelName: string
): RecorderResolvedModel {
  const selectedModel = models.find((model) => model.name === selectedModelName);
  if (selectedModel?.downloaded) {
    return {
      model: selectedModel,
      selectedModelName,
      usingFallback: false,
    };
  }

  const firstDownloadedModel = models.find((model) => model.downloaded) ?? null;

  return {
    model: firstDownloadedModel,
    selectedModelName,
    usingFallback: firstDownloadedModel !== null,
  };
}

export function resolveRecorderLaunchModelName({
  models,
  selectedModelDownloaded,
  selectedModelName,
}: {
  models: ModelInfo[];
  selectedModelDownloaded: boolean;
  selectedModelName: string;
}): string | null {
  if (selectedModelDownloaded) {
    return selectedModelName;
  }

  return models.find((model) => model.downloaded)?.name ?? null;
}

function AnimatedSoundWave({
  isAnimating,
  className,
}: {
  isAnimating: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-center gap-[3px]", className)}>
      {STATIC_WAVE_HEIGHTS.map((staticHeight, i) => (
        <span
          key={i}
          className={cn(
            "w-[3px] rounded-full bg-current transition-all duration-150",
            isAnimating ? "animate-soundwave" : "h-1"
          )}
          style={{
            animationDelay: isAnimating ? `${i * 0.12}s` : undefined,
            height: isAnimating ? undefined : staticHeight,
          }}
        />
      ))}
      <style>{SOUNDWAVE_CSS}</style>
    </div>
  );
}

export function FloatingTranscriptionRecorderView({
  downloadProgressPercent,
  error,
  isBootstrapping,
  isDownloadingModel,
  isExpanded,
  isModelDialogOpen,
  isRecording,
  isTranscribing,
  onClose,
  onDismissModelDialog,
  onDownloadModel,
  onOpen,
  onOpenSettings,
  onRecordAgain,
  onStopRecording,
  interimText,
  partialText,
  progress,
  resolvedModel,
  selectedModelSize,
  transcript,
}: FloatingTranscriptionRecorderViewProps) {
  const transcriptRef = useRef<HTMLDivElement>(null);
  const baseUtterances = transcript?.utterances ?? [];
  const fallbackText =
    baseUtterances.length === 0
      ? (isRecording ? partialText : transcript?.text || partialText).trim()
      : "";
  const displayedUtterances = useMemo<TranscriptionUtterance[]>(() => {
    if (baseUtterances.length > 0) {
      return baseUtterances;
    }
    if (fallbackText) {
      return [
        {
          id: "fallback",
          start: 0,
          end: transcript?.duration ?? 0,
          text: fallbackText,
          speaker: null,
        },
      ];
    }
    return [];
  }, [baseUtterances, fallbackText, transcript?.duration]);
  const volatileText = baseUtterances.length > 0 ? interimText.trim() : "";
  const showPreparingState = isBootstrapping && !isRecording && !isTranscribing;
  const hasContent = displayedUtterances.length > 0 || Boolean(volatileText);

  useEffect(() => {
    if (transcriptRef.current && isRecording) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [displayedUtterances.length, volatileText, isRecording]);

  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-40">
        <button
          aria-hidden={!isExpanded}
          className={cn(
            "pointer-events-none absolute inset-0 transition-opacity duration-300",
            isExpanded
              ? "pointer-events-auto bg-stone-950/20 backdrop-blur-[2px] opacity-100"
              : "opacity-0"
          )}
          onClick={onClose}
          tabIndex={isExpanded ? 0 : -1}
          type="button"
        />

        <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 flex items-end justify-center">
          <div
            className={cn(
              "pointer-events-auto app-no-drag origin-bottom overflow-hidden transition-all duration-300 ease-out",
              isExpanded
                ? "w-[22rem] max-w-[calc(100vw-3rem)] rounded-2xl border border-stone-200/80 bg-stone-50 shadow-[0_25px_50px_-12px_rgba(28,25,23,0.25)]"
                : "h-12 w-12 rounded-full border border-stone-200 bg-white shadow-lg hover:shadow-xl hover:scale-105"
            )}
            data-state={isExpanded ? "open" : "closed"}
            role={isExpanded ? "dialog" : undefined}
            aria-label={isExpanded ? "Voice recorder" : undefined}
            aria-modal={isExpanded ? true : undefined}
          >
            {!isExpanded ? (
              <button
                aria-label="Open recorder"
                className="flex h-full w-full items-center justify-center text-stone-600 transition-colors hover:text-stone-900"
                onClick={onOpen}
                type="button"
              >
                <AnimatedSoundWave isAnimating={false} className="h-5" />
              </button>
            ) : (
              <div className="flex max-h-[70vh] flex-col">
                <div className="flex items-center justify-between px-3 pt-2">
                  <button
                    aria-label="Audio settings"
                    className="rounded-full p-1 text-stone-300 transition-colors hover:text-stone-500"
                    onClick={onOpenSettings}
                    type="button"
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                  </button>

                  <button
                    aria-label="Close recorder"
                    className="rounded-full p-1 text-stone-300 transition-colors hover:text-stone-500"
                    onClick={onClose}
                    type="button"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                {isTranscribing && (
                  <div className="mx-4 mt-1 h-px bg-stone-200">
                    <div
                      className="h-full bg-stone-400 transition-all duration-300 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}

                <div className="flex-1 overflow-hidden">
                  <div
                    ref={transcriptRef}
                    className={cn(
                      "h-full min-h-[10rem] max-h-[40vh] overflow-y-auto px-5 py-4",
                      !hasContent && "flex items-center justify-center"
                    )}
                  >
                    {hasContent ? (
                      (() => {
                        const speakerMap = new Map<string, "left" | "right">();
                        return (
                          <div className="space-y-4">
                            {displayedUtterances.map((utterance) => {
                              const side = getSpeakerSide(utterance.speaker, speakerMap);
                              const isRight = side === "right";

                              return (
                                <div
                                  key={utterance.id}
                                  className={cn(
                                    "flex flex-col max-w-[85%]",
                                    isRight ? "ml-auto items-end" : "mr-auto items-start"
                                  )}
                                >
                                  <div
                                    className={cn(
                                      "rounded-2xl px-3 py-2 shadow-sm",
                                      isRight
                                        ? "bg-stone-700 text-white rounded-br-md"
                                        : "bg-white border border-stone-200/80 text-stone-700 rounded-bl-md"
                                    )}
                                  >
                                    <p className="font-serif text-[15px] leading-relaxed whitespace-pre-wrap">
                                      {utterance.text}
                                    </p>
                                  </div>
                                  <p
                                    className={cn(
                                      "mt-1 text-[10px] text-stone-400",
                                      isRight ? "text-right" : "text-left"
                                    )}
                                  >
                                    {utterance.speaker && <span>{utterance.speaker}</span>}
                                    {utterance.speaker && <span className="mx-1">·</span>}
                                    <span>{formatTime(utterance.start)}</span>
                                  </p>
                                </div>
                              );
                            })}

                            {volatileText && (
                              <div className="flex flex-col max-w-[85%] mr-auto items-start">
                                <div className="rounded-2xl rounded-bl-md border border-dashed border-stone-300 bg-stone-50/80 px-3 py-2">
                                  <p className="font-serif text-[15px] leading-relaxed text-stone-600 whitespace-pre-wrap">
                                    {volatileText}
                                    {isRecording && (
                                      <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-stone-400" />
                                    )}
                                  </p>
                                </div>
                                <p className="mt-1 text-[10px] text-stone-400">
                                  <span>Listening</span>
                                  <span className="mx-1">·</span>
                                  <span>now</span>
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })()
                    ) : (
                      <p className="text-center text-sm text-stone-400">
                        {showPreparingState ? "Starting..." : "Your words will appear here."}
                      </p>
                    )}
                  </div>
                </div>

                {error && (
                  <div className="mx-4 mb-2 rounded-lg bg-rose-50 px-3 py-2">
                    <p className="text-xs text-rose-500">{error}</p>
                  </div>
                )}

                <div className="flex items-center justify-center gap-4 px-4 pb-4 pt-2">
                  {isRecording ? (
                    <>
                      <AnimatedSoundWave isAnimating={true} className="h-4 text-stone-400" />
                      <button
                        aria-label="Stop recording"
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-200 text-stone-500 transition-all hover:bg-stone-300 hover:text-stone-600"
                        onClick={onStopRecording}
                        type="button"
                      >
                        <Square className="h-2.5 w-2.5 fill-current" />
                      </button>
                    </>
                  ) : isTranscribing || isBootstrapping ? (
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border border-stone-300 border-t-stone-500" />
                  ) : (
                    <>
                      <AnimatedSoundWave isAnimating={false} className="h-4 text-stone-300" />
                      <button
                        aria-label={transcript ? "Record again" : "Start recording"}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-200 text-stone-500 transition-all hover:bg-stone-300 hover:text-stone-600"
                        onClick={onRecordAgain}
                        type="button"
                      >
                        <Mic className="h-3 w-3" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {isModelDialogOpen && (
        <ModelSetupDialog
          downloadProgress={downloadProgressPercent}
          isDownloading={isDownloadingModel}
          modelName={resolvedModel.selectedModelName}
          modelSize={selectedModelSize}
          onCancel={onDismissModelDialog}
          onConfirm={onDownloadModel}
        />
      )}
    </>
  );
}

interface FloatingTranscriptionRecorderProps {
  autoStartToken?: number | null;
  noteId: string;
  noteBodyHtml: string;
  noteTitle: string;
  persistedSnapshot: NoteTranscriptionSnapshot | null;
  onAutoStartHandled?: (token: number) => void;
  onSnapshotChange: (snapshot: SaveNoteTranscriptionInput) => Promise<void> | void;
}

export function FloatingTranscriptionRecorder({
  autoStartToken = null,
  noteId,
  noteBodyHtml,
  noteTitle,
  persistedSnapshot,
  onAutoStartHandled,
  onSnapshotChange,
}: FloatingTranscriptionRecorderProps) {
  const { settings } = useSettings();
  const {
    currentModel,
    error,
    isInitialized,
    isRecording,
    isTranscribing,
    models,
    downloadProgress,
    partialText,
    progress,
    transcript,
    mode,
    finalText,
    interimText,
    lastSegmentIndex,
    downloadModel,
    initialize,
    startRecording,
    stopRecording,
    clearTranscript,
    hydrateSnapshot,
    audioCapture,
  } = useTranscription({
    streamingEnabled: settings?.transcription.streamingEnabled ?? true,
    vadEnabled: settings?.audio.vadEnabled ?? true,
    vadThreshold: settings?.audio.vadThreshold ?? 0.015,
  });
  const [isExpanded, setIsExpanded] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [isDownloadingModel, setIsDownloadingModel] = useState(false);
  const [isModelDialogOpen, setIsModelDialogOpen] = useState(false);
  const launchSessionRef = useRef(0);
  const lastHandledAutoStartTokenRef = useRef<number | null>(null);

  const selectedModelName = (settings?.transcription.selectedModel ??
    FALLBACK_MODEL) as WhisperModelName;
  const resolvedModel = useMemo(
    () => resolveRecorderModel(models, selectedModelName),
    [models, selectedModelName]
  );
  const language = settings?.transcription.language ?? "en";
  const useGPU = settings?.transcription.useGPU ?? true;
  const audioSource = settings?.audio.source ?? "microphone";
  const provider = settings?.transcription.provider ?? "local";
  const startedAtRef = useRef<string | null>(null);
  const completedAtRef = useRef<string | null>(null);
  const lastPartialAtRef = useRef<string | null>(null);
  const latestSnapshotRef = useRef<SaveNoteTranscriptionInput | null>(null);
  const lastPersistedFingerprintRef = useRef<string | null>(null);
  const onSnapshotChangeRef = useRef(onSnapshotChange);

  useEffect(() => {
    onSnapshotChangeRef.current = onSnapshotChange;
  }, [onSnapshotChange]);

  // Track noteId to detect note changes vs snapshot updates
  const prevNoteIdRef = useRef<string | null>(null);

  useEffect(() => {
    const isNoteChange = prevNoteIdRef.current !== noteId;
    prevNoteIdRef.current = noteId;

    // Use content-only fingerprint to avoid false mismatches from metadata fields
    const incomingFingerprint = getSnapshotContentFingerprint(persistedSnapshot);

    // For note changes: always hydrate and reset UI
    if (isNoteChange) {
      launchSessionRef.current += 1;
      hydrateSnapshot(persistedSnapshot);
      startedAtRef.current = persistedSnapshot?.startedAt ?? null;
      completedAtRef.current = persistedSnapshot?.completedAt ?? null;
      lastPartialAtRef.current = persistedSnapshot?.lastPartialAt ?? null;
      setIsExpanded(false);
      setIsBootstrapping(false);
      setIsDownloadingModel(false);
      setIsModelDialogOpen(false);
      lastPersistedFingerprintRef.current = incomingFingerprint;
      return;
    }

    // For snapshot updates on same note: hydrate if not recording and snapshot is new
    if (isRecording || isTranscribing) {
      return;
    }

    // Skip if we're the ones who saved this snapshot (content matches what we just saved)
    if (incomingFingerprint === lastPersistedFingerprintRef.current) {
      return;
    }

    // Skip if local state has more content than persisted snapshot
    // (we just completed a transcription and haven't saved yet)
    const localText = transcript?.text?.trim() || partialText.trim();
    const persistedText = persistedSnapshot?.transcriptText?.trim() || "";
    if (localText && localText.length > persistedText.length) {
      return;
    }

    // New snapshot arrived (e.g., async fetch completed) - hydrate it
    hydrateSnapshot(persistedSnapshot);
    startedAtRef.current = persistedSnapshot?.startedAt ?? null;
    completedAtRef.current = persistedSnapshot?.completedAt ?? null;
    lastPartialAtRef.current = persistedSnapshot?.lastPartialAt ?? null;
    lastPersistedFingerprintRef.current = incomingFingerprint;
  }, [
    hydrateSnapshot,
    noteId,
    persistedSnapshot,
    isRecording,
    isTranscribing,
    transcript,
    partialText,
  ]);

  useEffect(() => {
    if (partialText.trim()) {
      lastPartialAtRef.current = new Date().toISOString();
    }
  }, [partialText]);

  useEffect(() => {
    if (isRecording || isTranscribing) {
      completedAtRef.current = null;
      return;
    }

    if (transcript?.text?.trim()) {
      completedAtRef.current = completedAtRef.current ?? new Date().toISOString();
    }
  }, [isRecording, isTranscribing, transcript]);

  const buildSnapshot = useCallback(() => {
    const segments = transcript?.segments.length ? transcript.segments : [];
    const utterances = transcript?.utterances.length ? transcript.utterances : [];
    const transcriptText = transcript?.text?.trim() || partialText.trim();
    const hasAnyText = Boolean(transcriptText || finalText.trim() || interimText.trim());

    let status: SaveNoteTranscriptionInput["status"] = "draft";
    if (isRecording) {
      status = "recording";
    } else if (isTranscribing) {
      status = "transcribing";
    } else if (error) {
      status = "failed";
    } else if (transcript?.segments.length || transcript?.duration) {
      status = "completed";
    } else if (hasAnyText) {
      status = "cancelled";
    }

    return {
      status,
      provider,
      mode,
      language: transcript?.language || language,
      model: currentModel,
      transcriptText,
      finalText,
      interimText,
      segments,
      utterances,
      lastSegmentIndex,
      durationSeconds: transcript?.duration ?? 0,
      recordingDurationSeconds: Math.max(audioCapture.duration, transcript?.duration ?? 0),
      error,
      startedAt: startedAtRef.current,
      completedAt: completedAtRef.current,
      lastPartialAt: lastPartialAtRef.current,
    } satisfies SaveNoteTranscriptionInput;
  }, [
    audioCapture.duration,
    currentModel,
    error,
    finalText,
    interimText,
    isRecording,
    isTranscribing,
    language,
    lastSegmentIndex,
    mode,
    partialText,
    provider,
    transcript,
  ]);

  useEffect(() => {
    const snapshot = buildSnapshot();
    latestSnapshotRef.current = snapshot;

    void window.aiAgentMonitorAPI?.updateSession({
      noteId,
      noteTitle,
      noteBodyHtml,
      noteBodyText: extractPlainTextFromHtml(noteBodyHtml).replace(/\s+/g, " ").trim(),
      transcription: snapshot,
    });

    if (
      snapshot.status === "draft" &&
      !snapshot.startedAt &&
      !snapshot.transcriptText &&
      !persistedSnapshot
    ) {
      return;
    }

    const fingerprint = getSnapshotContentFingerprint(snapshot);
    if (fingerprint === lastPersistedFingerprintRef.current) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      lastPersistedFingerprintRef.current = fingerprint;
      void onSnapshotChangeRef.current(snapshot);
    }, getSnapshotSaveDelayMs(snapshot.status));

    return () => window.clearTimeout(timeoutId);
  }, [buildSnapshot, noteBodyHtml, noteId, noteTitle, persistedSnapshot]);

  const ensureInitialized = useCallback(async () => {
    let launchModelName = resolvedModel.model?.name ?? null;

    if (!launchModelName) {
      const [selectedModelDownloaded, availableModels] = await Promise.all([
        window.transcriptionAPI.isModelDownloaded(selectedModelName),
        window.transcriptionAPI.getModels(),
      ]);

      launchModelName = resolveRecorderLaunchModelName({
        models: availableModels,
        selectedModelDownloaded,
        selectedModelName,
      });
    }

    if (!launchModelName) {
      setIsModelDialogOpen(true);
      return false;
    }

    if (isInitialized && currentModel === launchModelName) {
      return true;
    }

    return initialize(launchModelName, language, useGPU);
  }, [
    resolvedModel.model,
    selectedModelName,
    isInitialized,
    currentModel,
    initialize,
    language,
    useGPU,
  ]);

  const startLiveRecording = useCallback(async () => {
    const launchSession = ++launchSessionRef.current;
    const shouldPreserveExisting = Boolean(transcript?.text?.trim() || partialText.trim());

    setIsExpanded(true);
    setIsBootstrapping(true);
    startedAtRef.current = startedAtRef.current ?? new Date().toISOString();

    if (!shouldPreserveExisting) {
      clearTranscript();
      startedAtRef.current = new Date().toISOString();
    }
    completedAtRef.current = null;

    try {
      const ready = await ensureInitialized();
      if (!ready || launchSession !== launchSessionRef.current) {
        return;
      }

      await startRecording(audioSource, { preserveExisting: shouldPreserveExisting });
    } finally {
      if (launchSession === launchSessionRef.current) {
        setIsBootstrapping(false);
      }
    }
  }, [clearTranscript, ensureInitialized, startRecording, audioSource, transcript, partialText]);

  const handleOpen = async () => {
    if (isRecording || isTranscribing) {
      setIsExpanded(true);
      return;
    }

    if (transcript?.text?.trim() || partialText.trim()) {
      setIsExpanded(true);
      return;
    }

    await startLiveRecording();
  };

  const handleClose = () => {
    setIsBootstrapping(false);
    setIsDownloadingModel(false);
    setIsExpanded(false);
    setIsModelDialogOpen(false);
  };

  const handleOpenSettings = () => {
    handleClose();
    window.electronAPI.navigate(DESKTOP_NAVIGATION_ROUTES.settingsAudio);
  };

  const handleDownloadModel = async () => {
    const launchSession = ++launchSessionRef.current;

    setIsDownloadingModel(true);
    setIsBootstrapping(true);

    try {
      const success = await downloadModel(selectedModelName);
      if (!success) {
        return;
      }

      setIsModelDialogOpen(false);
      const initialized = await initialize(selectedModelName, language, useGPU);
      if (!initialized || launchSession !== launchSessionRef.current) {
        return;
      }

      clearTranscript();
      startedAtRef.current = new Date().toISOString();
      await startRecording(audioSource);
    } finally {
      if (launchSession === launchSessionRef.current) {
        setIsDownloadingModel(false);
        setIsBootstrapping(false);
      }
    }
  };

  const handleStopRecording = async () => {
    await stopRecording();
  };

  useEffect(() => {
    if (autoStartToken === null) {
      return;
    }

    if (lastHandledAutoStartTokenRef.current === autoStartToken) {
      return;
    }

    lastHandledAutoStartTokenRef.current = autoStartToken;
    onAutoStartHandled?.(autoStartToken);
    void startLiveRecording();
  }, [autoStartToken, onAutoStartHandled, startLiveRecording]);

  useEffect(() => {
    return () => {
      // Always clear the AI agent monitor session when navigating away from this note.
      // This ensures the notification window closes and resources are freed.
      void window.aiAgentMonitorAPI?.clearSession(noteId);

      // Persist the latest transcription snapshot before unmounting
      const latestSnapshot = latestSnapshotRef.current;
      if (latestSnapshot) {
        void onSnapshotChangeRef.current(latestSnapshot);
      }
    };
  }, [noteId]);

  return (
    <FloatingTranscriptionRecorderView
      downloadProgressPercent={downloadProgress?.percent ?? 0}
      error={error}
      isBootstrapping={isBootstrapping}
      isDownloadingModel={isDownloadingModel}
      isExpanded={isExpanded}
      isModelDialogOpen={isModelDialogOpen}
      isRecording={isRecording}
      isTranscribing={isTranscribing}
      onClose={handleClose}
      onDismissModelDialog={() => setIsModelDialogOpen(false)}
      onDownloadModel={handleDownloadModel}
      onOpen={handleOpen}
      onOpenSettings={handleOpenSettings}
      onRecordAgain={startLiveRecording}
      onStopRecording={handleStopRecording}
      interimText={interimText}
      partialText={partialText}
      progress={progress}
      resolvedModel={resolvedModel}
      selectedModelSize={resolvedModel.model?.size ?? "Whisper model"}
      transcript={transcript}
    />
  );
}
