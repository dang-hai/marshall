// Main transcriber
export { Transcriber } from "./transcriber.js";
export type { TranscriberConfig, TranscriberEvents } from "./transcriber.js";

// Streaming transcriber
export { StreamingTranscriber } from "./streaming-transcriber.js";
export type {
  StreamingTranscriberConfig,
  StreamingTranscriberEvents,
  PartialTranscription,
} from "./streaming-transcriber.js";

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
  VoiceActivityDetector,
  detectVoiceActivity,
  estimateSNR,
} from "./audio/index.js";
export type {
  AudioDevice,
  AudioCaptureConfig,
  SystemAudioCapability,
  AudioChunk,
  VADConfig,
  VADState,
  VADResult,
} from "./audio/index.js";
