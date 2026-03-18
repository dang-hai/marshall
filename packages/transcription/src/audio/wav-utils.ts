import { writeFileSync } from "fs";

/**
 * Convert Float32Array audio samples to WAV format buffer
 * Whisper requires 16kHz mono 16-bit PCM WAV files
 */
export function float32ToWav(samples: Float32Array, sampleRate: number = 16000): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const buffer = Buffer.alloc(totalSize);
  let offset = 0;

  // RIFF header
  buffer.write("RIFF", offset);
  offset += 4;
  buffer.writeUInt32LE(totalSize - 8, offset);
  offset += 4;
  buffer.write("WAVE", offset);
  offset += 4;

  // fmt chunk
  buffer.write("fmt ", offset);
  offset += 4;
  buffer.writeUInt32LE(16, offset); // chunk size
  offset += 4;
  buffer.writeUInt16LE(1, offset); // PCM format
  offset += 2;
  buffer.writeUInt16LE(numChannels, offset);
  offset += 2;
  buffer.writeUInt32LE(sampleRate, offset);
  offset += 4;
  buffer.writeUInt32LE(byteRate, offset);
  offset += 4;
  buffer.writeUInt16LE(blockAlign, offset);
  offset += 2;
  buffer.writeUInt16LE(bitsPerSample, offset);
  offset += 2;

  // data chunk
  buffer.write("data", offset);
  offset += 4;
  buffer.writeUInt32LE(dataSize, offset);
  offset += 4;

  // Write audio samples as 16-bit PCM
  for (let i = 0; i < samples.length; i++) {
    // Clamp to [-1, 1] and convert to 16-bit
    const sample = Math.max(-1, Math.min(1, samples[i]));
    const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    buffer.writeInt16LE(Math.round(int16), offset);
    offset += 2;
  }

  return buffer;
}

/**
 * Save Float32Array samples as a WAV file
 */
export function saveWav(samples: Float32Array, filePath: string, sampleRate: number = 16000): void {
  const buffer = float32ToWav(samples, sampleRate);
  writeFileSync(filePath, buffer);
}

/**
 * Resample audio from one sample rate to another (simple linear interpolation)
 */
export function resampleAudio(
  samples: Float32Array,
  fromRate: number,
  toRate: number
): Float32Array {
  if (fromRate === toRate) {
    return samples;
  }

  const ratio = fromRate / toRate;
  const newLength = Math.round(samples.length / ratio);
  const result = new Float32Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * ratio;
    const srcIndexFloor = Math.floor(srcIndex);
    const srcIndexCeil = Math.min(srcIndexFloor + 1, samples.length - 1);
    const t = srcIndex - srcIndexFloor;

    // Linear interpolation
    result[i] = samples[srcIndexFloor] * (1 - t) + samples[srcIndexCeil] * t;
  }

  return result;
}

/**
 * Convert stereo audio to mono by averaging channels
 */
export function stereoToMono(samples: Float32Array): Float32Array {
  const mono = new Float32Array(samples.length / 2);
  for (let i = 0; i < mono.length; i++) {
    mono[i] = (samples[i * 2] + samples[i * 2 + 1]) / 2;
  }
  return mono;
}

/**
 * Concatenate multiple Float32Arrays
 */
export function concatenateAudio(chunks: Float32Array[]): Float32Array {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Float32Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
