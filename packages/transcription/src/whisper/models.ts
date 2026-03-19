import { createWriteStream, existsSync, mkdirSync, statSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { WHISPER_MODELS, type WhisperModelName } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface DownloadProgress {
  modelName: WhisperModelName;
  bytesDownloaded: number;
  totalBytes: number;
  percent: number;
}

export type DownloadProgressCallback = (progress: DownloadProgress) => void;

export function getModelsDirectory(): string {
  // Use app data directory for models
  const homeDir = process.env.HOME || process.env.USERPROFILE || "";
  const modelsDir = join(homeDir, ".marshall", "models");

  if (!existsSync(modelsDir)) {
    mkdirSync(modelsDir, { recursive: true });
  }

  return modelsDir;
}

export function getModelPath(modelName: WhisperModelName): string {
  return join(getModelsDirectory(), `ggml-${modelName}.bin`);
}

export function getCoreMLEncoderPath(modelName: WhisperModelName): string {
  return join(getModelsDirectory(), `ggml-${modelName}-encoder.mlmodelc`);
}

export function isCoreMLEncoderAvailable(modelName: WhisperModelName): boolean {
  const encoderPath = getCoreMLEncoderPath(modelName);
  return existsSync(encoderPath);
}

export function isModelDownloaded(modelName: WhisperModelName): boolean {
  const modelPath = getModelPath(modelName);
  if (!existsSync(modelPath)) return false;

  // Check if file size is roughly correct
  const stats = statSync(modelPath);
  const expectedSize = WHISPER_MODELS[modelName].bytes;
  // Allow 10% variance in size
  return stats.size > expectedSize * 0.9;
}

export function listAvailableModels(): Array<{
  name: WhisperModelName;
  size: string;
  downloaded: boolean;
  coremlAvailable: boolean;
  path: string;
}> {
  return (Object.keys(WHISPER_MODELS) as WhisperModelName[]).map((name) => ({
    name,
    size: WHISPER_MODELS[name].size,
    downloaded: isModelDownloaded(name),
    coremlAvailable: isCoreMLEncoderAvailable(name),
    path: getModelPath(name),
  }));
}

export async function downloadModel(
  modelName: WhisperModelName,
  onProgress?: DownloadProgressCallback
): Promise<string> {
  const model = WHISPER_MODELS[modelName];
  if (!model) {
    throw new Error(`Unknown model: ${modelName}`);
  }

  const modelPath = getModelPath(modelName);
  const tempPath = `${modelPath}.download`;

  // Create directory if it doesn't exist
  const dir = dirname(modelPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Check if already downloaded
  if (isModelDownloaded(modelName)) {
    return modelPath;
  }

  // Clean up any partial download
  if (existsSync(tempPath)) {
    unlinkSync(tempPath);
  }

  const response = await fetch(model.url);

  if (!response.ok) {
    throw new Error(`Failed to download model: ${response.status} ${response.statusText}`);
  }

  const totalBytes = parseInt(response.headers.get("content-length") || String(model.bytes), 10);
  let bytesDownloaded = 0;

  const fileStream = createWriteStream(tempPath);

  // Create a transform stream to track progress
  const body = response.body;
  if (!body) {
    throw new Error("No response body");
  }

  const reader = body.getReader();
  const stream = new Readable({
    async read() {
      const { done, value } = await reader.read();
      if (done) {
        this.push(null);
        return;
      }
      bytesDownloaded += value.length;
      if (onProgress) {
        onProgress({
          modelName,
          bytesDownloaded,
          totalBytes,
          percent: Math.round((bytesDownloaded / totalBytes) * 100),
        });
      }
      this.push(value);
    },
  });

  await pipeline(stream, fileStream);

  // Rename temp file to final path
  const { renameSync } = await import("fs");
  renameSync(tempPath, modelPath);

  return modelPath;
}

export async function deleteModel(modelName: WhisperModelName): Promise<void> {
  const modelPath = getModelPath(modelName);
  if (existsSync(modelPath)) {
    unlinkSync(modelPath);
  }
}

export interface CoreMLGenerationProgress {
  modelName: WhisperModelName;
  stage: "starting" | "installing-deps" | "generating" | "complete" | "error";
  message: string;
}

export type CoreMLProgressCallback = (progress: CoreMLGenerationProgress) => void;

export async function generateCoreMLEncoder(
  modelName: WhisperModelName,
  onProgress?: CoreMLProgressCallback
): Promise<string> {
  // Check if already available
  if (isCoreMLEncoderAvailable(modelName)) {
    const encoderPath = getCoreMLEncoderPath(modelName);
    onProgress?.({
      modelName,
      stage: "complete",
      message: "CoreML encoder already exists",
    });
    return encoderPath;
  }

  // Check if model is downloaded first
  if (!isModelDownloaded(modelName)) {
    throw new Error(`Model ${modelName} must be downloaded before generating CoreML encoder`);
  }

  // Find the generate-coreml.sh script
  // Go from dist/whisper/ to scripts/
  const scriptPath = join(__dirname, "..", "..", "scripts", "generate-coreml.sh");

  // For development, the script is relative to src
  const devScriptPath = join(__dirname, "..", "..", "..", "scripts", "generate-coreml.sh");

  const actualScriptPath = existsSync(scriptPath) ? scriptPath : devScriptPath;

  if (!existsSync(actualScriptPath)) {
    throw new Error(`CoreML generation script not found at ${scriptPath} or ${devScriptPath}`);
  }

  onProgress?.({
    modelName,
    stage: "starting",
    message: "Starting CoreML encoder generation...",
  });

  return new Promise((resolve, reject) => {
    const child = spawn("bash", [actualScriptPath, modelName], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data: Buffer) => {
      const output = data.toString();
      stdout += output;

      // Parse progress from output
      if (output.includes("Installing Python dependencies")) {
        onProgress?.({
          modelName,
          stage: "installing-deps",
          message: "Installing Python dependencies...",
        });
      } else if (output.includes("Generating CoreML encoder")) {
        onProgress?.({
          modelName,
          stage: "generating",
          message: "Generating CoreML encoder (this may take a few minutes)...",
        });
      } else if (output.includes("CoreML model generated successfully")) {
        onProgress?.({
          modelName,
          stage: "complete",
          message: "CoreML encoder generated successfully",
        });
      }
    });

    child.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code === 0) {
        const encoderPath = getCoreMLEncoderPath(modelName);
        if (existsSync(encoderPath)) {
          resolve(encoderPath);
        } else {
          reject(new Error("CoreML generation completed but encoder not found"));
        }
      } else {
        onProgress?.({
          modelName,
          stage: "error",
          message: `CoreML generation failed: ${stderr || stdout}`,
        });
        reject(new Error(`CoreML generation failed with code ${code}: ${stderr || stdout}`));
      }
    });

    child.on("error", (err) => {
      onProgress?.({
        modelName,
        stage: "error",
        message: `Failed to start CoreML generation: ${err.message}`,
      });
      reject(err);
    });
  });
}
