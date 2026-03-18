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
    if (historyRef.current.length > 50) {
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

    // Draw background
    ctx.fillStyle = isSpeaking ? "rgba(34, 197, 94, 0.1)" : "rgba(100, 100, 100, 0.1)";
    ctx.fillRect(0, 0, width, height);

    // Draw waveform
    const barWidth = width / history.length;
    const maxHeight = height * 0.8;

    history.forEach((val, i) => {
      const barHeight = Math.max(2, val * maxHeight * 20); // Scale up for visibility
      const x = i * barWidth;
      const y = (height - barHeight) / 2;

      ctx.fillStyle = isSpeaking ? "rgb(34, 197, 94)" : "rgb(100, 100, 100)";
      ctx.fillRect(x, y, barWidth - 1, barHeight);
    });
  }, [level, isSpeaking, isRecording]);

  if (!isRecording) {
    return null;
  }

  return (
    <div className={`relative ${className}`}>
      <canvas ref={canvasRef} width={200} height={40} className="w-full h-10 rounded-md border" />
      <div className="absolute top-0 right-0 p-1">
        <div
          className={`w-2 h-2 rounded-full ${
            isSpeaking ? "bg-green-500 animate-pulse" : "bg-gray-400"
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
    <div className={`relative h-2 bg-muted rounded-full overflow-hidden ${className}`}>
      {/* Level bar */}
      <div
        className={`absolute left-0 top-0 h-full transition-all duration-75 ${
          scaledLevel > scaledThreshold ? "bg-green-500" : "bg-blue-500"
        }`}
        style={{ width: `${scaledLevel * 100}%` }}
      />
      {/* Threshold marker */}
      <div
        className="absolute top-0 h-full w-0.5 bg-yellow-500"
        style={{ left: `${scaledThreshold * 100}%` }}
      />
    </div>
  );
}
