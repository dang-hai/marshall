export interface WhisperConfig {
  modelPath: string;
  language?: string;
  threads?: number;
  useGPU?: boolean;
  translate?: boolean;
}

export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string | null;
}

export interface TranscriptionUtterance {
  id: string;
  start: number;
  end: number;
  text: string;
  speaker?: string | null;
}

export interface TranscriptionResult {
  text: string;
  language: string;
  segments: TranscriptionSegment[];
  utterances: TranscriptionUtterance[];
  duration: number;
}

export interface WhisperProgress {
  percent: number;
  timeElapsed: number;
  timeRemaining?: number;
}

export const WHISPER_MODELS = {
  "tiny.en": {
    size: "75 MB",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin",
    bytes: 78000000,
  },
  "base.en": {
    size: "142 MB",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin",
    bytes: 148000000,
  },
  "small.en": {
    size: "466 MB",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin",
    bytes: 488000000,
  },
  "medium.en": {
    size: "1.5 GB",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.en.bin",
    bytes: 1570000000,
  },
  "large-v3": {
    size: "3.1 GB",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin",
    bytes: 3270000000,
  },
  "large-v3-turbo": {
    size: "1.6 GB",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin",
    bytes: 1700000000,
  },
} as const;

export type WhisperModelName = keyof typeof WHISPER_MODELS;
