import { EventEmitter } from "events";
import { tmpdir } from "os";
import { join } from "path";
import { unlinkSync, existsSync } from "fs";
import { WhisperProcess, type WhisperConfig, type TranscriptionResult } from "./whisper/index.js";
import { saveWav, concatenateAudio, resampleAudio, stereoToMono } from "./audio/index.js";
import { VoiceActivityDetector, type VADConfig } from "./audio/vad.js";

export interface StreamingTranscriberConfig extends Omit<WhisperConfig, "modelPath"> {
  modelPath: string;
  tempDir?: string;
  keepTempFiles?: boolean;
  /** VAD configuration */
  vad?: Partial<Omit<VADConfig, "sampleRate">>;
  /** Minimum audio duration to transcribe (seconds) */
  minSegmentDuration?: number;
  /** Maximum audio duration before forced transcription (seconds) */
  maxSegmentDuration?: number;
  /** Enable streaming mode */
  streamingEnabled?: boolean;
  /** Interval for interim transcription during active speech (seconds). Set to 0 to disable. */
  interimInterval?: number;
}

export interface PartialTranscription {
  text: string;
  isFinal: boolean;
  segmentIndex: number;
  timestamp: number;
}

export interface StreamingTranscriberEvents {
  "recording:start": () => void;
  "recording:stop": () => void;
  "recording:chunk": (chunk: Float32Array) => void;
  "vad:speech-start": () => void;
  "vad:speech-end": (duration: number) => void;
  "vad:level": (rms: number) => void;
  "transcription:partial": (partial: PartialTranscription) => void;
  "transcription:segment": (result: TranscriptionResult, segmentIndex: number) => void;
  "transcription:progress": (percent: number) => void;
  "transcription:complete": (result: TranscriptionResult) => void;
  "transcription:error": (error: Error) => void;
}

interface ResolvedConfig {
  modelPath: string;
  tempDir: string;
  keepTempFiles: boolean;
  minSegmentDuration: number;
  maxSegmentDuration: number;
  streamingEnabled: boolean;
  interimInterval: number;
  vad: Partial<Omit<VADConfig, "sampleRate">>;
  language: string;
  threads: number;
  useGPU: boolean;
  translate: boolean;
}

export class StreamingTranscriber extends EventEmitter {
  private config: ResolvedConfig;
  private whisper: WhisperProcess;
  private vad: VoiceActivityDetector;

  // Audio buffers
  private currentSegmentChunks: Float32Array[] = [];
  private allSessionChunks: Float32Array[] = [];

  // State
  private isRecording = false;
  private isTranscribing = false;
  private sourceSampleRate = 48000;
  private segmentIndex = 0;
  private transcriptionQueue: Promise<void> = Promise.resolve();

  // Accumulated results
  private segmentResults: TranscriptionResult[] = [];
  private wasSpeaking = false;
  private speechStartTime = 0;

  // Interim transcription state
  private interimTimer: ReturnType<typeof setInterval> | null = null;
  private lastInterimText = "";
  private isInterimTranscribing = false;

  constructor(config: StreamingTranscriberConfig) {
    super();
    this.config = {
      tempDir: tmpdir(),
      keepTempFiles: false,
      minSegmentDuration: 0.35,
      maxSegmentDuration: 12.0,
      streamingEnabled: true,
      interimInterval: 2.0, // Transcribe every 2 seconds during speech
      vad: {},
      language: "en",
      threads: 4,
      useGPU: true,
      translate: false,
      ...config,
    };

    this.whisper = new WhisperProcess(config);
    this.vad = new VoiceActivityDetector({
      sampleRate: 16000, // We'll resample before VAD
      threshold: 0.015,
      minSpeechDuration: 120,
      silenceTimeout: 250,
      ...this.config.vad,
    });

    // Forward whisper events
    this.whisper.on("progress", (progress) => {
      this.emit("transcription:progress", progress.percent);
    });
  }

  /**
   * Set the source sample rate
   */
  setSourceSampleRate(rate: number): void {
    this.sourceSampleRate = rate;
  }

  /**
   * Start a streaming recording session
   */
  startRecording(): void {
    this.currentSegmentChunks = [];
    this.allSessionChunks = [];
    this.segmentResults = [];
    this.segmentIndex = 0;
    this.isRecording = true;
    this.wasSpeaking = false;
    this.lastInterimText = "";
    this.isInterimTranscribing = false;
    this.clearInterimTimer();
    this.vad.reset();
    this.emit("recording:start");
  }

  /**
   * Add an audio chunk and process for VAD + streaming transcription
   */
  addAudioChunk(chunk: Float32Array, isStereo = false): void {
    if (!this.isRecording) {
      throw new Error("Not recording. Call startRecording() first.");
    }

    let processed = chunk;

    // Convert stereo to mono if needed
    if (isStereo) {
      processed = stereoToMono(processed);
    }

    // Store in session buffer
    this.allSessionChunks.push(processed);

    // Resample for VAD (to 16kHz)
    const resampled = resampleAudio(processed, this.sourceSampleRate, 16000);

    // Process VAD
    const vadResult = this.vad.process(resampled);
    this.emit("vad:level", vadResult.rms);

    // Handle speech state transitions
    if (vadResult.isSpeech && !this.wasSpeaking) {
      // Speech started
      this.wasSpeaking = true;
      this.speechStartTime = Date.now();
      this.emit("vad:speech-start");

      // Start interim transcription timer
      this.startInterimTimer();
    } else if (!vadResult.isSpeech && this.wasSpeaking) {
      // Speech ended
      this.wasSpeaking = false;
      const speechDuration = (Date.now() - this.speechStartTime) / 1000;
      this.emit("vad:speech-end", speechDuration);

      // Stop interim timer
      this.clearInterimTimer();

      // Trigger transcription of the segment if streaming enabled
      if (this.config.streamingEnabled && speechDuration >= this.config.minSegmentDuration) {
        this.transcribeCurrentSegment();
      }
    }

    // Add to current segment buffer
    this.currentSegmentChunks.push(processed);
    this.emit("recording:chunk", processed);

    // Check for max segment duration (force transcription)
    const currentDuration = this.getCurrentSegmentDuration();
    if (this.config.streamingEnabled && currentDuration >= this.config.maxSegmentDuration) {
      this.transcribeCurrentSegment();
    }
  }

  /**
   * Get current segment duration in seconds
   */
  private getCurrentSegmentDuration(): number {
    const totalSamples = this.currentSegmentChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    return totalSamples / this.sourceSampleRate;
  }

  /**
   * Start the interim transcription timer
   */
  private startInterimTimer(): void {
    if (!this.config.streamingEnabled || this.config.interimInterval <= 0) {
      return;
    }

    this.clearInterimTimer();

    this.interimTimer = setInterval(() => {
      this.transcribeInterim();
    }, this.config.interimInterval * 1000);
  }

  /**
   * Clear the interim transcription timer
   */
  private clearInterimTimer(): void {
    if (this.interimTimer) {
      clearInterval(this.interimTimer);
      this.interimTimer = null;
    }
  }

  /**
   * Transcribe current buffer as interim (non-final) result
   */
  private async transcribeInterim(): Promise<void> {
    if (
      this.isInterimTranscribing ||
      this.isTranscribing ||
      this.currentSegmentChunks.length === 0
    ) {
      return;
    }

    const duration = this.getCurrentSegmentDuration();
    if (duration < this.config.minSegmentDuration) {
      return;
    }

    try {
      this.isInterimTranscribing = true;

      // Copy current chunks (don't clear - this is interim)
      const chunks = [...this.currentSegmentChunks];
      const result = await this.transcribeChunks(chunks);

      if (result.text.trim() && result.text !== this.lastInterimText) {
        this.lastInterimText = result.text;

        // Emit as interim (non-final) result
        this.emit("transcription:partial", {
          text: result.text,
          isFinal: false,
          segmentIndex: this.segmentIndex,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      // Silently ignore interim transcription errors
      console.error("[StreamingTranscriber] Interim transcription error:", error);
    } finally {
      this.isInterimTranscribing = false;
    }
  }

  /**
   * Transcribe the current segment buffer
   */
  private transcribeCurrentSegment(): void {
    if (this.currentSegmentChunks.length === 0 || this.isTranscribing) {
      return;
    }

    // Capture chunks and clear buffer
    const chunks = [...this.currentSegmentChunks];
    this.currentSegmentChunks = [];
    const currentIndex = this.segmentIndex++;

    // Queue transcription to prevent overlapping
    this.transcriptionQueue = this.transcriptionQueue.then(async () => {
      try {
        this.isTranscribing = true;
        const result = await this.transcribeChunks(chunks);

        if (result.text.trim()) {
          this.segmentResults.push(result);
          this.emit("transcription:segment", result, currentIndex);

          // Emit partial for UI update
          this.emit("transcription:partial", {
            text: result.text,
            isFinal: true,
            segmentIndex: currentIndex,
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.emit("transcription:error", err);
      } finally {
        this.isTranscribing = false;
      }
    });
  }

  /**
   * Transcribe a set of audio chunks
   */
  private async transcribeChunks(chunks: Float32Array[]): Promise<TranscriptionResult> {
    let audio = concatenateAudio(chunks);

    // Resample to 16kHz for whisper
    if (this.sourceSampleRate !== 16000) {
      audio = resampleAudio(audio, this.sourceSampleRate, 16000);
    }

    // Save to temp file
    const tempPath = join(this.config.tempDir, `marshall-segment-${Date.now()}.wav`);

    try {
      saveWav(audio, tempPath, 16000);
      const result = await this.whisper.transcribe(tempPath);
      return result;
    } finally {
      if (!this.config.keepTempFiles && existsSync(tempPath)) {
        try {
          unlinkSync(tempPath);
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }

  /**
   * Stop recording and get final transcription
   */
  async stopAndTranscribe(): Promise<TranscriptionResult> {
    this.isRecording = false;
    this.emit("recording:stop");

    // Wait for any pending transcriptions
    await this.transcriptionQueue;

    // Transcribe any remaining audio in current segment
    if (this.currentSegmentChunks.length > 0) {
      const duration = this.getCurrentSegmentDuration();
      if (duration >= 0.5) {
        // Min 0.5s for final segment
        await this.transcriptionQueue;
        const chunks = [...this.currentSegmentChunks];
        this.currentSegmentChunks = [];

        try {
          const result = await this.transcribeChunks(chunks);
          if (result.text.trim()) {
            this.segmentResults.push(result);
          }
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          this.emit("transcription:error", err);
        }
      }
    }

    // Combine all segment results
    const combinedResult = this.combineResults();
    this.emit("transcription:complete", combinedResult);
    return combinedResult;
  }

  /**
   * Combine all segment results into one final result
   */
  private combineResults(): TranscriptionResult {
    if (this.segmentResults.length === 0) {
      return {
        text: "",
        language: this.config.language || "en",
        segments: [],
        utterances: [],
        duration: 0,
      };
    }

    // Calculate time offset for each segment
    let timeOffset = 0;
    const allSegments: TranscriptionResult["segments"] = [];
    const allUtterances: TranscriptionResult["utterances"] = [];
    const allText: string[] = [];

    for (const [resultIndex, result] of this.segmentResults.entries()) {
      allText.push(result.text);

      for (const seg of result.segments) {
        allSegments.push({
          start: seg.start + timeOffset,
          end: seg.end + timeOffset,
          text: seg.text,
        });
      }

      for (const utterance of result.utterances) {
        allUtterances.push({
          id: `${utterance.id}-${resultIndex}`,
          start: utterance.start + timeOffset,
          end: utterance.end + timeOffset,
          text: utterance.text,
          speaker: utterance.speaker ?? null,
        });
      }

      timeOffset += result.duration;
    }

    return {
      text: allText.join(" ").trim(),
      language: this.segmentResults[0]?.language || this.config.language || "en",
      segments: allSegments,
      utterances: allUtterances,
      duration: timeOffset,
    };
  }

  /**
   * Transcribe all accumulated audio at once (non-streaming mode)
   */
  async transcribeAll(): Promise<TranscriptionResult> {
    this.isRecording = false;
    this.emit("recording:stop");

    if (this.allSessionChunks.length === 0) {
      return {
        text: "",
        language: this.config.language || "en",
        segments: [],
        utterances: [],
        duration: 0,
      };
    }

    try {
      const result = await this.transcribeChunks(this.allSessionChunks);
      this.emit("transcription:complete", result);
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit("transcription:error", err);
      throw err;
    }
  }

  /**
   * Get recording status
   */
  getIsRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Get total recording duration
   */
  getRecordingDuration(): number {
    const totalSamples = this.allSessionChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    return totalSamples / this.sourceSampleRate;
  }

  /**
   * Get accumulated transcription so far
   */
  getPartialTranscription(): string {
    return this.segmentResults
      .map((r) => r.text)
      .join(" ")
      .trim();
  }

  /**
   * Cancel recording and transcription
   */
  cancel(): void {
    this.clearInterimTimer();
    this.whisper.kill();
    this.isRecording = false;
    this.isTranscribing = false;
    this.isInterimTranscribing = false;
    this.currentSegmentChunks = [];
    this.allSessionChunks = [];
    this.segmentResults = [];
    this.lastInterimText = "";
    this.vad.reset();
  }

  /**
   * Calibrate VAD threshold from ambient noise
   */
  calibrateVAD(samples: Float32Array): number {
    const resampled = resampleAudio(samples, this.sourceSampleRate, 16000);
    return this.vad.calibrate(resampled);
  }

  /**
   * Set VAD threshold manually
   */
  setVADThreshold(threshold: number): void {
    this.vad.setThreshold(threshold);
  }
}
