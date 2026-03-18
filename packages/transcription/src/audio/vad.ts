/**
 * Voice Activity Detection (VAD) utilities
 * Detects when speech is present in audio samples
 */

export interface VADConfig {
  /** RMS threshold for speech detection (0-1, default: 0.01) */
  threshold?: number;
  /** Minimum duration of speech to trigger (ms, default: 100) */
  minSpeechDuration?: number;
  /** Duration of silence to end speech segment (ms, default: 500) */
  silenceTimeout?: number;
  /** Sample rate of input audio */
  sampleRate: number;
}

export interface VADState {
  isSpeaking: boolean;
  speechStartTime: number | null;
  lastSpeechTime: number | null;
  currentRMS: number;
}

export interface VADResult {
  isSpeech: boolean;
  rms: number;
  speechDuration: number;
  silenceDuration: number;
}

export class VoiceActivityDetector {
  private config: Required<VADConfig>;
  private state: VADState = {
    isSpeaking: false,
    speechStartTime: null,
    lastSpeechTime: null,
    currentRMS: 0,
  };

  constructor(config: VADConfig) {
    this.config = {
      threshold: 0.01,
      minSpeechDuration: 100,
      silenceTimeout: 500,
      ...config,
    };
  }

  /**
   * Calculate Root Mean Square (RMS) of audio samples
   */
  private calculateRMS(samples: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i];
    }
    return Math.sqrt(sum / samples.length);
  }

  /**
   * Process audio chunk and detect voice activity
   */
  process(samples: Float32Array): VADResult {
    const now = Date.now();
    const rms = this.calculateRMS(samples);
    this.state.currentRMS = rms;

    const isAboveThreshold = rms > this.config.threshold;

    if (isAboveThreshold) {
      this.state.lastSpeechTime = now;

      if (!this.state.isSpeaking) {
        // Start of speech
        this.state.speechStartTime = now;
        this.state.isSpeaking = true;
      }
    }

    // Check if speech has ended (silence timeout)
    if (
      this.state.isSpeaking &&
      this.state.lastSpeechTime &&
      now - this.state.lastSpeechTime > this.config.silenceTimeout
    ) {
      this.state.isSpeaking = false;
    }

    // Calculate durations
    const speechDuration = this.state.speechStartTime ? now - this.state.speechStartTime : 0;

    const silenceDuration = this.state.lastSpeechTime ? now - this.state.lastSpeechTime : Infinity;

    // Only consider it speech if above minimum duration
    const isSpeech = this.state.isSpeaking && speechDuration >= this.config.minSpeechDuration;

    return {
      isSpeech,
      rms,
      speechDuration,
      silenceDuration,
    };
  }

  /**
   * Reset the VAD state
   */
  reset(): void {
    this.state = {
      isSpeaking: false,
      speechStartTime: null,
      lastSpeechTime: null,
      currentRMS: 0,
    };
  }

  /**
   * Get current state
   */
  getState(): VADState {
    return { ...this.state };
  }

  /**
   * Update threshold dynamically
   */
  setThreshold(threshold: number): void {
    this.config.threshold = Math.max(0, Math.min(1, threshold));
  }

  /**
   * Auto-calibrate threshold based on ambient noise
   * Call this during initial silence to set a good threshold
   */
  calibrate(samples: Float32Array, multiplier: number = 2.5): number {
    const rms = this.calculateRMS(samples);
    const newThreshold = rms * multiplier;
    this.config.threshold = Math.max(0.005, Math.min(0.1, newThreshold));
    return this.config.threshold;
  }
}

/**
 * Simple energy-based VAD function for quick checks
 */
export function detectVoiceActivity(samples: Float32Array, threshold: number = 0.01): boolean {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }
  const rms = Math.sqrt(sum / samples.length);
  return rms > threshold;
}

/**
 * Calculate the signal-to-noise ratio estimate
 */
export function estimateSNR(samples: Float32Array, noiseFloor: number = 0.001): number {
  let sum = 0;
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    sum += abs;
    if (abs > peak) peak = abs;
  }
  const mean = sum / samples.length;
  const signal = peak;
  const noise = Math.max(noiseFloor, mean);
  return 20 * Math.log10(signal / noise);
}
