// Main transcriber
export { Transcriber } from "./transcriber.js";
export type { TranscriberConfig, TranscriberEvents } from "./transcriber.js";

// Whisper
export {
  WhisperProcess,
  getModelsDirectory,
  getModelPath,
  isModelDownloaded,
  listAvailableModels,
  downloadModel,
  deleteModel,
  WHISPER_MODELS,
} from "./whisper/index.js";
export type {
  WhisperConfig,
  TranscriptionResult,
  TranscriptionSegment,
  WhisperProgress,
  WhisperModelName,
  DownloadProgress,
  DownloadProgressCallback,
} from "./whisper/index.js";

// Audio utilities
export {
  float32ToWav,
  saveWav,
  resampleAudio,
  stereoToMono,
  concatenateAudio,
  checkSystemAudioCapability,
  getSystemAudioConstraints,
  SYSTEM_AUDIO_SETUP_GUIDE,
  DEFAULT_AUDIO_CONFIG,
} from "./audio/index.js";
export type {
  AudioDevice,
  AudioCaptureConfig,
  SystemAudioCapability,
  AudioChunk,
} from "./audio/index.js";
