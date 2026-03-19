import { EventEmitter } from "events";
import WebSocket from "ws";
import { resampleAudio, stereoToMono } from "./audio/index.js";

export interface DeepgramTranscriberConfig {
  backendUrl: string;
  language?: string;
}

export interface DeepgramPartialTranscription {
  text: string;
  isFinal: boolean;
  confidence?: number;
  words?: Array<{ word: string; start: number; end: number; confidence: number }>;
  timestamp: number;
}

export interface DeepgramTranscriberEvents {
  "recording:start": () => void;
  "recording:stop": () => void;
  "recording:chunk": (chunk: Float32Array) => void;
  "transcription:partial": (partial: DeepgramPartialTranscription) => void;
  "transcription:complete": (result: DeepgramTranscriptionResult) => void;
  "transcription:error": (error: Error) => void;
  "vad:speech-start": () => void;
  "vad:speech-end": () => void;
}

export interface DeepgramTranscriptionResult {
  text: string;
  language: string;
  segments: Array<{ start: number; end: number; text: string }>;
  duration: number;
}

interface TranscriptionMessage {
  type: "interim" | "final" | "error" | "speech_started" | "utterance_end";
  text?: string;
  confidence?: number;
  error?: string;
  words?: Array<{ word: string; start: number; end: number; confidence: number }>;
}

export class DeepgramStreamingTranscriber extends EventEmitter {
  private config: DeepgramTranscriberConfig;
  private ws: WebSocket | null = null;
  private isRecording = false;
  private sourceSampleRate = 48000;
  private allText: string[] = [];
  private allSegments: Array<{ start: number; end: number; text: string }> = [];
  private recordingStartTime = 0;

  constructor(config: DeepgramTranscriberConfig) {
    super();
    this.config = {
      language: "en",
      ...config,
    };
  }

  setSourceSampleRate(rate: number): void {
    this.sourceSampleRate = rate;
  }

  startRecording(): void {
    this.allText = [];
    this.allSegments = [];
    this.isRecording = true;
    this.recordingStartTime = Date.now();

    // Connect to backend WebSocket
    const wsUrl = this.config.backendUrl.replace(/^http/, "ws") + "/transcription/stream";

    this.ws = new WebSocket(wsUrl);

    this.ws.on("open", () => {
      this.emit("recording:start");
    });

    this.ws.on("message", (data: WebSocket.RawData) => {
      try {
        const message: TranscriptionMessage = JSON.parse(data.toString());
        this.handleMessage(message);
      } catch (error) {
        console.error("[DeepgramTranscriber] Failed to parse message:", error);
      }
    });

    this.ws.on("error", (error: Error) => {
      console.error("[DeepgramTranscriber] WebSocket error:", error);
      this.emit("transcription:error", new Error("WebSocket connection error"));
    });

    this.ws.on("close", () => {
      if (this.isRecording) {
        this.emit("transcription:error", new Error("WebSocket connection closed unexpectedly"));
      }
    });
  }

  private handleMessage(data: TranscriptionMessage): void {
    console.log("[DeepgramTranscriber] Received message:", data.type, data.text?.substring(0, 50));

    switch (data.type) {
      case "interim":
        console.log("[DeepgramTranscriber] Emitting interim partial:", data.text);
        this.emit("transcription:partial", {
          text: data.text || "",
          isFinal: false,
          confidence: data.confidence,
          words: data.words,
          timestamp: Date.now(),
        } satisfies DeepgramPartialTranscription);
        break;

      case "final":
        console.log("[DeepgramTranscriber] Emitting final partial:", data.text);
        if (data.text && data.text.trim()) {
          this.allText.push(data.text.trim());

          // Add segments from words if available
          if (data.words && data.words.length > 0) {
            const firstWord = data.words[0];
            const lastWord = data.words[data.words.length - 1];
            this.allSegments.push({
              start: firstWord.start,
              end: lastWord.end,
              text: data.text.trim(),
            });
          }
        }

        this.emit("transcription:partial", {
          text: data.text || "",
          isFinal: true,
          confidence: data.confidence,
          words: data.words,
          timestamp: Date.now(),
        } satisfies DeepgramPartialTranscription);
        break;

      case "speech_started":
        console.log("[DeepgramTranscriber] Speech started");
        this.emit("vad:speech-start");
        break;

      case "utterance_end":
        console.log("[DeepgramTranscriber] Utterance end");
        this.emit("vad:speech-end");
        break;

      case "error":
        console.error("[DeepgramTranscriber] Error:", data.error);
        this.emit("transcription:error", new Error(data.error || "Unknown error"));
        break;
    }
  }

  addAudioChunk(chunk: Float32Array, isStereo = false): void {
    if (!this.isRecording || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    let processed = chunk;

    // Convert stereo to mono if needed
    if (isStereo) {
      processed = stereoToMono(processed);
    }

    // Resample to 16kHz for Deepgram
    const resampled = resampleAudio(processed, this.sourceSampleRate, 16000);

    // Convert Float32 to Int16 PCM
    const pcm = this.float32ToInt16(resampled);

    // Send to backend as Buffer
    this.ws.send(Buffer.from(pcm.buffer));

    this.emit("recording:chunk", processed);
  }

  private float32ToInt16(float32: Float32Array): Int16Array {
    const int16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const sample = Math.max(-1, Math.min(1, float32[i]));
      int16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }
    return int16;
  }

  async stopAndTranscribe(): Promise<DeepgramTranscriptionResult> {
    this.isRecording = false;
    this.emit("recording:stop");

    // Send close message and close WebSocket
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "close" }));
      }
      this.ws.close();
      this.ws = null;
    }

    const duration = (Date.now() - this.recordingStartTime) / 1000;

    const result: DeepgramTranscriptionResult = {
      text: this.allText.join(" ").trim(),
      language: this.config.language || "en",
      segments: this.allSegments,
      duration,
    };

    this.emit("transcription:complete", result);
    return result;
  }

  getIsRecording(): boolean {
    return this.isRecording;
  }

  getRecordingDuration(): number {
    if (!this.isRecording) return 0;
    return (Date.now() - this.recordingStartTime) / 1000;
  }

  getPartialTranscription(): string {
    return this.allText.join(" ").trim();
  }

  cancel(): void {
    this.isRecording = false;

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.allText = [];
    this.allSegments = [];
  }

  // Compatibility methods (no-op for Deepgram as VAD is server-side)
  calibrateVAD(_samples: Float32Array): number {
    return 0.015; // Return default threshold
  }

  setVADThreshold(_threshold: number): void {
    // No-op - Deepgram handles VAD server-side
  }
}
