import { useState } from "react";
import { useTranscription } from "../hooks/useTranscription";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import type { AudioSource } from "../hooks/useAudioCapture";

export function TranscriptionPanel() {
  const {
    isInitialized,
    isRecording,
    isTranscribing,
    currentModel,
    transcript,
    error,
    progress,
    models,
    downloadProgress,
    audioCapture,
    downloadModel,
    initialize,
    startRecording,
    stopRecording,
    cancel,
    clearTranscript,
  } = useTranscription();

  const [selectedModel, setSelectedModel] = useState("tiny.en");
  const [audioSource, setAudioSource] = useState<AudioSource>("microphone");

  const handleDownload = async () => {
    await downloadModel(selectedModel);
  };

  const handleInitialize = async () => {
    await initialize(selectedModel);
  };

  const handleStartRecording = async () => {
    await startRecording(audioSource);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Transcription</span>
          {isRecording && (
            <span className="flex items-center gap-2 text-sm font-normal text-red-500">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              Recording {formatDuration(audioCapture.duration)}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Error display */}
        {error && (
          <div className="p-3 text-sm bg-destructive/10 text-destructive rounded-md">{error}</div>
        )}

        {/* Model selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Model</label>
          <div className="flex gap-2">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={isRecording || isTranscribing}
              className="flex-1 h-10 px-3 rounded-md border bg-background"
            >
              {models.map((model) => (
                <option key={model.name} value={model.name}>
                  {model.name} ({model.size}) {model.downloaded ? "✓" : ""}
                </option>
              ))}
            </select>
            {!models.find((m) => m.name === selectedModel)?.downloaded && (
              <Button
                onClick={handleDownload}
                disabled={!!downloadProgress}
                variant="outline"
                size="default"
              >
                {downloadProgress?.modelName === selectedModel
                  ? `${downloadProgress.percent}%`
                  : "Download"}
              </Button>
            )}
          </div>
        </div>

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

        {/* Initialize / Record controls */}
        <div className="flex gap-2">
          {!isInitialized ? (
            <Button
              onClick={handleInitialize}
              disabled={!models.find((m) => m.name === selectedModel)?.downloaded}
              className="flex-1"
            >
              Initialize
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
                <Button variant="ghost" size="sm" className="h-auto p-0" onClick={clearTranscript}>
                  Clear
                </Button>
              </div>
            </div>
            <div className="p-3 bg-muted rounded-md min-h-[100px] max-h-[300px] overflow-y-auto">
              {transcript.segments.length > 0 ? (
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
  );
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
