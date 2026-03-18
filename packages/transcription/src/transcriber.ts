import { EventEmitter } from "events";
import { tmpdir } from "os";
import { join } from "path";
import { unlinkSync, existsSync } from "fs";
import { WhisperProcess, type WhisperConfig, type TranscriptionResult } from "./whisper/index.js";
import { saveWav, concatenateAudio, resampleAudio, stereoToMono } from "./audio/index.js";

export interface TranscriberConfig extends Omit<WhisperConfig, "modelPath"> {
  modelPath: string;
  tempDir?: string;
  keepTempFiles?: boolean;
}

export interface TranscriberEvents {
  "recording:start": () => void;
  "recording:stop": () => void;
  "recording:chunk": (chunk: Float32Array) => void;
  "transcription:start": () => void;
  "transcription:progress": (percent: number) => void;
  "transcription:complete": (result: TranscriptionResult) => void;
  "transcription:error": (error: Error) => void;
}

export class Transcriber extends EventEmitter {
  private config: TranscriberConfig;
  private whisper: WhisperProcess;
  private audioChunks: Float32Array[] = [];
  private isRecording = false;
  private sourceSampleRate = 48000; // Default browser sample rate

  constructor(config: TranscriberConfig) {
    super();
    this.config = {
      tempDir: tmpdir(),
      keepTempFiles: false,
      ...config,
    };
    this.whisper = new WhisperProcess(config);

    // Forward whisper events
    this.whisper.on("progress", (progress) => {
      this.emit("transcription:progress", progress.percent);
    });
  }

  /**
   * Set the source sample rate (call this before adding chunks if not 48000)
   */
  setSourceSampleRate(rate: number): void {
    this.sourceSampleRate = rate;
  }

  /**
   * Start a new recording session
   */
  startRecording(): void {
    this.audioChunks = [];
    this.isRecording = true;
    this.emit("recording:start");
  }

  /**
   * Add an audio chunk to the recording
   * @param chunk Float32Array of audio samples
   * @param isStereo Whether the input is stereo (will be converted to mono)
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

    this.audioChunks.push(processed);
    this.emit("recording:chunk", processed);
  }

  /**
   * Stop recording and return the combined audio
   */
  stopRecording(): Float32Array {
    this.isRecording = false;
    this.emit("recording:stop");

    // Combine all chunks
    let audio = concatenateAudio(this.audioChunks);

    // Resample to 16kHz if needed (whisper requirement)
    if (this.sourceSampleRate !== 16000) {
      audio = resampleAudio(audio, this.sourceSampleRate, 16000);
    }

    return audio;
  }

  /**
   * Stop recording and immediately transcribe
   */
  async stopAndTranscribe(): Promise<TranscriptionResult> {
    const audio = this.stopRecording();
    return this.transcribeAudio(audio);
  }

  /**
   * Transcribe a Float32Array of audio samples
   */
  async transcribeAudio(samples: Float32Array): Promise<TranscriptionResult> {
    this.emit("transcription:start");

    // Save to temp WAV file
    const tempPath = join(this.config.tempDir || tmpdir(), `marshall-audio-${Date.now()}.wav`);

    try {
      saveWav(samples, tempPath, 16000);

      const result = await this.whisper.transcribe(tempPath);
      this.emit("transcription:complete", result);
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit("transcription:error", err);
      throw err;
    } finally {
      // Clean up temp file
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
   * Transcribe an existing audio file
   */
  async transcribeFile(filePath: string): Promise<TranscriptionResult> {
    this.emit("transcription:start");

    try {
      const result = await this.whisper.transcribe(filePath);
      this.emit("transcription:complete", result);
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit("transcription:error", err);
      throw err;
    }
  }

  /**
   * Check if currently recording
   */
  getIsRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Get current recording duration in seconds
   */
  getRecordingDuration(): number {
    const totalSamples = this.audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    return totalSamples / this.sourceSampleRate;
  }

  /**
   * Cancel any ongoing transcription
   */
  cancel(): void {
    this.whisper.kill();
    this.isRecording = false;
    this.audioChunks = [];
  }
}
