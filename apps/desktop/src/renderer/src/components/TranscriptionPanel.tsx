import { useState, useRef, useEffect } from "react";
import { useTranscription } from "../hooks/useTranscription";
import { useSettings } from "../hooks/useSettings";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { VoiceActivityIndicator, AudioLevelMeter } from "./VoiceActivityIndicator";
import { ModelSetupDialog } from "./ModelSetupDialog";
import type { AudioSource } from "../hooks/useAudioCapture";

const DEFAULT_MODEL = "large-v3-turbo";
const DEFAULT_MODEL_SIZE = "~1.5 GB";

export function TranscriptionPanel() {
  const { settings, updateSection } = useSettings();

  const {
    isInitialized,
    isRecording,
    isTranscribing,
    currentModel,
    mode,
    transcript,
    partialText,
    error,
    progress,
    isSpeaking,
    vadLevel,
    models,
    downloadProgress,
    audioCapture,
    downloadModel,
    initialize,
    startRecording,
    stopRecording,
    cancel,
    clearTranscript,
  } = useTranscription({
    streamingEnabled: settings?.transcription.streamingEnabled ?? true,
    vadEnabled: settings?.audio.vadEnabled ?? true,
    vadThreshold: settings?.audio.vadThreshold ?? 0.015,
  });

  const [audioSource, setAudioSource] = useState<AudioSource>(
    settings?.audio.source || "microphone"
  );
  const [showModelDialog, setShowModelDialog] = useState(false);
  const [isDownloadingModel, setIsDownloadingModel] = useState(false);

  const transcriptRef = useRef<HTMLDivElement>(null);

  // Check if model is downloaded on mount
  useEffect(() => {
    const checkModel = async () => {
      const model = models.find((m) => m.name === DEFAULT_MODEL);
      if (model && !model.downloaded && !isInitialized) {
        setShowModelDialog(true);
      }
    };
    if (models.length > 0) {
      checkModel();
    }
  }, [models, isInitialized]);

  // Auto-initialize when model is downloaded
  useEffect(() => {
    const model = models.find((m) => m.name === DEFAULT_MODEL);
    if (model?.downloaded && !isInitialized && !isDownloadingModel) {
      initialize(DEFAULT_MODEL);
    }
  }, [models, isInitialized, isDownloadingModel, initialize]);

  // Auto-scroll transcript
  useEffect(() => {
    if (settings?.ui.autoScroll && transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcript, partialText, settings?.ui.autoScroll]);

  // Update settings when audio source changes
  useEffect(() => {
    if (settings && audioSource !== settings.audio.source) {
      void updateSection("audio", { source: audioSource });
    }
  }, [audioSource, settings, updateSection]);

  const handleDownloadModel = async () => {
    setIsDownloadingModel(true);
    const success = await downloadModel(DEFAULT_MODEL);
    setIsDownloadingModel(false);
    if (success) {
      setShowModelDialog(false);
    }
  };

  const handleStartRecording = async () => {
    await startRecording(audioSource);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const vadThreshold = settings?.audio.vadThreshold ?? 0.015;

  return (
    <div className="w-full max-w-3xl space-y-3">
      {/* Model download dialog */}
      {showModelDialog && (
        <ModelSetupDialog
          modelName={DEFAULT_MODEL}
          modelSize={DEFAULT_MODEL_SIZE}
          isDownloading={isDownloadingModel}
          downloadProgress={downloadProgress?.percent ?? 0}
          onConfirm={handleDownloadModel}
          onCancel={() => setShowModelDialog(false)}
        />
      )}

      {/* Error display */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-3">
            <p className="text-xs text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Main transcription card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              Transcription
              {mode && (
                <span className="text-2xs font-normal bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                  {mode === "streaming" ? "Streaming" : "Batch"}
                </span>
              )}
            </span>
            {isRecording && (
              <span className="flex items-center gap-1.5 text-xs font-normal text-destructive">
                <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
                {formatTime(audioCapture.duration)}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Audio source selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Audio Source</label>
            <div className="flex gap-1.5">
              <Button
                variant={audioSource === "microphone" ? "default" : "outline"}
                size="sm"
                onClick={() => setAudioSource("microphone")}
                disabled={isRecording}
              >
                Microphone
              </Button>
              <Button
                variant={audioSource === "system" ? "default" : "outline"}
                size="sm"
                onClick={() => setAudioSource("system")}
                disabled={isRecording}
              >
                System Audio
              </Button>
              <Button
                variant={audioSource === "both" ? "default" : "outline"}
                size="sm"
                onClick={() => setAudioSource("both")}
                disabled={isRecording}
              >
                Both
              </Button>
            </div>
            {(audioSource === "system" || audioSource === "both") &&
              audioCapture.screenPermission !== "granted" && (
                <p className="text-2xs text-amber-600">
                  Screen Recording permission required.{" "}
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0"
                    onClick={() => audioCapture.requestScreenPermission()}
                  >
                    Grant in Settings
                  </Button>
                </p>
              )}
          </div>

          {/* Voice activity indicator */}
          {isRecording && (
            <div className="space-y-1.5">
              <VoiceActivityIndicator
                level={vadLevel}
                isSpeaking={isSpeaking}
                isRecording={isRecording}
              />
              <div className="flex items-center gap-2">
                <span className="text-2xs text-muted-foreground">Audio Level</span>
                <AudioLevelMeter level={vadLevel} threshold={vadThreshold} className="flex-1" />
                {isSpeaking && <span className="text-2xs text-green-600">Speaking</span>}
              </div>
            </div>
          )}

          {/* Real-time partial text (streaming mode) */}
          {isRecording && mode === "streaming" && partialText && (
            <div className="p-2.5 bg-muted/50 rounded-md border border-dashed border-border/60">
              <p className="text-xs text-muted-foreground italic">{partialText.trim()}</p>
            </div>
          )}

          {/* Controls */}
          <div className="flex gap-1.5">
            {!isInitialized ? (
              <Button onClick={() => setShowModelDialog(true)} className="flex-1">
                Setup Transcription
              </Button>
            ) : isRecording ? (
              <>
                <Button onClick={stopRecording} variant="destructive" className="flex-1">
                  Stop & Transcribe
                </Button>
                <Button onClick={cancel} variant="outline">
                  Cancel
                </Button>
              </>
            ) : (
              <Button onClick={handleStartRecording} disabled={isTranscribing} className="flex-1">
                {isTranscribing ? `Transcribing... ${progress}%` : "Start Recording"}
              </Button>
            )}
          </div>

          {/* Status info */}
          {isInitialized && !isRecording && !isTranscribing && (
            <p className="text-2xs text-muted-foreground text-center">Ready with {currentModel}</p>
          )}

          {/* Progress bar */}
          {isTranscribing && (
            <div className="w-full bg-muted rounded-full h-1">
              <div
                className="bg-primary h-1 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {/* Transcript display */}
          {transcript && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">Transcript</label>
                <div className="flex items-center gap-2">
                  <span className="text-2xs text-muted-foreground font-mono">
                    {transcript.duration.toFixed(1)}s
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1.5"
                    onClick={clearTranscript}
                  >
                    Clear
                  </Button>
                </div>
              </div>
              <div
                ref={transcriptRef}
                className="p-2.5 bg-muted/40 rounded-md min-h-[80px] max-h-[200px] overflow-y-auto"
              >
                {transcript.segments.length > 0 && settings?.ui.showTimestamps ? (
                  <div className="space-y-0.5">
                    {transcript.segments.map((segment, i) => (
                      <p key={i} className="text-xs leading-relaxed">
                        <span className="text-2xs text-muted-foreground font-mono mr-1.5">
                          [{formatTime(segment.start)}]
                        </span>
                        {segment.text}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs leading-relaxed">{transcript.text}</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
