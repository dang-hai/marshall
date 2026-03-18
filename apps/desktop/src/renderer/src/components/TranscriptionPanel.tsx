import { useState, useRef, useEffect } from "react";
import { useTranscription } from "../hooks/useTranscription";
import { useSettings } from "../hooks/useSettings";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { ModelManager } from "./ModelManager";
import { VoiceActivityIndicator, AudioLevelMeter } from "./VoiceActivityIndicator";
import type { AudioSource } from "../hooks/useAudioCapture";

export function TranscriptionPanel() {
  const { settings, updateTranscription, updateAudio } = useSettings();

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
    storageInfo,
    downloadProgress,
    audioCapture,
    downloadModel,
    deleteModel,
    initialize,
    startRecording,
    stopRecording,
    cancel,
    clearTranscript,
    setVADThreshold,
  } = useTranscription({
    streamingEnabled: settings?.transcription.streamingEnabled ?? true,
    vadEnabled: settings?.audio.vadEnabled ?? true,
    vadThreshold: settings?.audio.vadThreshold ?? 0.015,
  });

  const [selectedModel, setSelectedModel] = useState(
    settings?.transcription.selectedModel || "tiny.en"
  );
  const [audioSource, setAudioSource] = useState<AudioSource>(
    settings?.audio.source || "microphone"
  );
  const [showSettings, setShowSettings] = useState(false);
  const [localVadThreshold, setLocalVadThreshold] = useState(settings?.audio.vadThreshold ?? 0.015);

  const transcriptRef = useRef<HTMLDivElement>(null);

  // Auto-scroll transcript
  useEffect(() => {
    if (settings?.ui.autoScroll && transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcript, partialText, settings?.ui.autoScroll]);

  // Update settings when local state changes
  useEffect(() => {
    if (settings && selectedModel !== settings.transcription.selectedModel) {
      updateTranscription({ selectedModel });
    }
  }, [selectedModel, settings, updateTranscription]);

  useEffect(() => {
    if (settings && audioSource !== settings.audio.source) {
      updateAudio({ source: audioSource });
    }
  }, [audioSource, settings, updateAudio]);

  const handleModelSelect = (modelName: string) => {
    setSelectedModel(modelName);
  };

  const handleInitialize = async () => {
    await initialize(selectedModel);
  };

  const handleStartRecording = async () => {
    await startRecording(audioSource);
  };

  const handleVadThresholdChange = async (value: number) => {
    setLocalVadThreshold(value);
    await setVADThreshold(value);
    await updateAudio({ vadThreshold: value });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatTimestamp = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="w-full max-w-4xl space-y-4">
      {/* Error display */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="p-3">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Main transcription card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              Transcription
              {mode && (
                <span className="text-xs font-normal bg-muted px-2 py-0.5 rounded">
                  {mode === "streaming" ? "Streaming" : "Batch"}
                </span>
              )}
            </span>
            <div className="flex items-center gap-2">
              {isRecording && (
                <span className="flex items-center gap-2 text-sm font-normal text-red-500">
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  {formatDuration(audioCapture.duration)}
                </span>
              )}
              <Button variant="ghost" size="sm" onClick={() => setShowSettings(!showSettings)}>
                Settings
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Audio source selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Audio Source</label>
            <div className="flex gap-2">
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
            {(audioSource === "system" || audioSource === "both") && (
              <p className="text-xs text-muted-foreground">
                System audio capture requires Screen Recording permission.
                {audioCapture.screenPermission !== "granted" && (
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 ml-1"
                    onClick={() => audioCapture.requestScreenPermission()}
                  >
                    Grant permission
                  </Button>
                )}
              </p>
            )}
          </div>

          {/* Voice activity indicator */}
          {isRecording && (
            <div className="space-y-2">
              <VoiceActivityIndicator
                level={vadLevel}
                isSpeaking={isSpeaking}
                isRecording={isRecording}
              />
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Audio Level</span>
                <AudioLevelMeter
                  level={vadLevel}
                  threshold={localVadThreshold}
                  className="flex-1"
                />
                {isSpeaking && <span className="text-xs text-green-500">Speaking</span>}
              </div>
            </div>
          )}

          {/* Real-time partial text (streaming mode) */}
          {isRecording && mode === "streaming" && partialText && (
            <div className="p-3 bg-muted/50 rounded-md border border-dashed">
              <p className="text-sm text-muted-foreground italic">{partialText.trim()}</p>
            </div>
          )}

          {/* Controls */}
          <div className="flex gap-2">
            {!isInitialized ? (
              <Button
                onClick={handleInitialize}
                disabled={!models.find((m) => m.name === selectedModel)?.downloaded}
                className="flex-1"
              >
                Initialize {selectedModel}
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
            <p className="text-xs text-muted-foreground text-center">
              Ready with model: {currentModel}
            </p>
          )}

          {/* Progress bar */}
          {isTranscribing && (
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {/* Transcript display */}
          {transcript && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Transcript</label>
                <div className="flex gap-2">
                  <span className="text-xs text-muted-foreground">
                    {transcript.duration.toFixed(1)}s
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0"
                    onClick={clearTranscript}
                  >
                    Clear
                  </Button>
                </div>
              </div>
              <div
                ref={transcriptRef}
                className="p-3 bg-muted rounded-md min-h-[100px] max-h-[300px] overflow-y-auto"
              >
                {transcript.segments.length > 0 && settings?.ui.showTimestamps ? (
                  <div className="space-y-1">
                    {transcript.segments.map((segment, i) => (
                      <p key={i} className="text-sm">
                        <span className="text-xs text-muted-foreground mr-2">
                          [{formatTimestamp(segment.start)}]
                        </span>
                        {segment.text}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm">{transcript.text}</p>
                )}
              </div>
            </div>
          )}

          {/* Permissions status */}
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>
              Mic:{" "}
              <span
                className={
                  audioCapture.micPermission === "granted" ? "text-green-500" : "text-yellow-500"
                }
              >
                {audioCapture.micPermission}
              </span>
            </span>
            <span>
              Screen:{" "}
              <span
                className={
                  audioCapture.screenPermission === "granted" ? "text-green-500" : "text-yellow-500"
                }
              >
                {audioCapture.screenPermission}
              </span>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Settings panel */}
      {showSettings && (
        <div className="space-y-4">
          {/* Model Manager */}
          <ModelManager
            models={models}
            storageInfo={storageInfo}
            downloadProgress={downloadProgress}
            onDownload={downloadModel}
            onDelete={deleteModel}
            onSelect={handleModelSelect}
            selectedModel={selectedModel}
            disabled={isRecording || isTranscribing}
          />

          {/* VAD Settings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Voice Activity Detection</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm">VAD Threshold</label>
                  <span className="text-xs text-muted-foreground">
                    {(localVadThreshold * 100).toFixed(1)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.005"
                  max="0.1"
                  step="0.001"
                  value={localVadThreshold}
                  onChange={(e) => handleVadThresholdChange(parseFloat(e.target.value))}
                  className="w-full"
                  disabled={isRecording}
                />
                <p className="text-xs text-muted-foreground">
                  Lower values detect quieter speech but may pick up background noise. Higher values
                  filter noise but may miss soft speech.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="streaming-enabled"
                  checked={settings?.transcription.streamingEnabled ?? true}
                  onChange={(e) => updateTranscription({ streamingEnabled: e.target.checked })}
                  disabled={isRecording || isInitialized}
                />
                <label htmlFor="streaming-enabled" className="text-sm">
                  Enable streaming transcription
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="show-timestamps"
                  checked={settings?.ui.showTimestamps ?? true}
                  onChange={async (e) => {
                    if (settings) {
                      await window.settingsAPI.update({
                        ui: { ...settings.ui, showTimestamps: e.target.checked },
                      });
                    }
                  }}
                />
                <label htmlFor="show-timestamps" className="text-sm">
                  Show timestamps in transcript
                </label>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
