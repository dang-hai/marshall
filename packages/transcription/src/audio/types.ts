export interface AudioDevice {
  id: string;
  name: string;
  kind: "audioinput" | "audiooutput";
  isDefault: boolean;
}

export interface AudioCaptureConfig {
  sampleRate: number; // 16000 for whisper
  channels: number; // 1 (mono)
  deviceId?: string;
}

export interface SystemAudioCapability {
  available: boolean;
  method: "desktop-capturer" | "screen-capture-kit" | "blackhole" | "none";
  requiresSetup: boolean;
  setupInstructions?: string;
  macOSVersion?: number;
}

export interface AudioChunk {
  data: Float32Array;
  timestamp: number;
  sampleRate: number;
}

export const DEFAULT_AUDIO_CONFIG: AudioCaptureConfig = {
  sampleRate: 16000,
  channels: 1,
};
