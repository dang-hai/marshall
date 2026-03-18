import { useEffect, useRef } from "react";

interface VoiceActivityIndicatorProps {
  level: number; // 0-1 (RMS level)
  isSpeaking: boolean;
  isRecording: boolean;
  className?: string;
}

export function VoiceActivityIndicator({
  level,
  isSpeaking,
  isRecording,
  className = "",
}: VoiceActivityIndicatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const historyRef = useRef<number[]>([]);

  useEffect(() => {
    if (!isRecording) {
      historyRef.current = [];
      return;
    }

    // Add level to history
    historyRef.current.push(level);
    if (historyRef.current.length > 60) {
      historyRef.current.shift();
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const history = historyRef.current;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Subtle background
    ctx.fillStyle = isSpeaking ? "rgba(22, 163, 74, 0.06)" : "rgba(120, 113, 108, 0.04)";
    ctx.fillRect(0, 0, width, height);

    // Draw waveform bars
    const barWidth = width / history.length;
    const maxHeight = height * 0.7;

    history.forEach((val, i) => {
      const barHeight = Math.max(1, val * maxHeight * 20);
      const x = i * barWidth;
      const y = (height - barHeight) / 2;

      ctx.fillStyle = isSpeaking ? "rgb(22, 163, 74)" : "rgb(120, 113, 108)";
      ctx.fillRect(x, y, Math.max(1, barWidth - 1), barHeight);
    });
  }, [level, isSpeaking, isRecording]);

  if (!isRecording) {
    return null;
  }

  return (
    <div className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        width={240}
        height={32}
        className="w-full h-7 rounded border border-border/50"
      />
      <div className="absolute top-1 right-1">
        <div
          className={`w-1.5 h-1.5 rounded-full transition-colors ${
            isSpeaking ? "bg-green-600 animate-pulse" : "bg-muted-foreground/40"
          }`}
        />
      </div>
    </div>
  );
}

interface AudioLevelMeterProps {
  level: number;
  threshold: number;
  className?: string;
}

export function AudioLevelMeter({ level, threshold, className = "" }: AudioLevelMeterProps) {
  // Scale level for better visibility (RMS values are typically small)
  const scaledLevel = Math.min(1, level * 30);
  const scaledThreshold = Math.min(1, threshold * 30);

  return (
    <div className={`relative h-1 bg-muted rounded-full overflow-hidden ${className}`}>
      {/* Level bar */}
      <div
        className={`absolute left-0 top-0 h-full transition-all duration-75 ${
          scaledLevel > scaledThreshold ? "bg-green-600" : "bg-primary/60"
        }`}
        style={{ width: `${scaledLevel * 100}%` }}
      />
      {/* Threshold marker */}
      <div
        className="absolute top-0 h-full w-px bg-amber-500"
        style={{ left: `${scaledThreshold * 100}%` }}
      />
    </div>
  );
}
