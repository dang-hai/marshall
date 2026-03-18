import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";
import { join, dirname } from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import type { WhisperConfig, TranscriptionResult, WhisperProgress } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface WhisperProcessEvents {
  progress: (progress: WhisperProgress) => void;
  error: (error: Error) => void;
  complete: (result: TranscriptionResult) => void;
}

export class WhisperProcess extends EventEmitter {
  private process: ChildProcess | null = null;
  private binaryPath: string;
  private startTime: number = 0;

  constructor(private config: WhisperConfig) {
    super();
    // Binary path - look in multiple locations
    this.binaryPath = this.findBinary();
  }

  private findBinary(): string {
    // Electron adds resourcesPath to process in packaged apps
    const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;

    const possiblePaths = [
      // Development: in package bin folder
      join(__dirname, "../../bin/whisper-cli"),
      // Production: in app resources
      ...(resourcesPath ? [join(resourcesPath, "bin/whisper-cli")] : []),
      // System-wide installation
      "/usr/local/bin/whisper-cli",
      // Homebrew
      "/opt/homebrew/bin/whisper-cli",
    ];

    for (const p of possiblePaths) {
      if (existsSync(p)) {
        return p;
      }
    }

    // Default to package bin path (will error on use if not found)
    return possiblePaths[0];
  }

  async transcribe(audioPath: string): Promise<TranscriptionResult> {
    if (!existsSync(this.binaryPath)) {
      throw new Error(
        `Whisper binary not found at ${this.binaryPath}. Run 'bun run build:whisper' in packages/transcription.`
      );
    }

    if (!existsSync(this.config.modelPath)) {
      throw new Error(`Whisper model not found at ${this.config.modelPath}`);
    }

    return new Promise((resolve, reject) => {
      this.startTime = Date.now();

      const args = [
        "-m",
        this.config.modelPath,
        "-f",
        audioPath,
        "-l",
        this.config.language || "en",
        "-t",
        String(this.config.threads || 4),
        "-oj", // Output JSON
        "--print-progress",
      ];

      if (this.config.translate) {
        args.push("--translate");
      }

      // Don't add -ng flag by default - Metal will be used automatically on Apple Silicon
      if (this.config.useGPU === false) {
        args.push("-ng"); // No GPU
      }

      this.process = spawn(this.binaryPath, args);

      let stdout = "";
      let stderr = "";

      this.process.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      this.process.stderr?.on("data", (data) => {
        const text = data.toString();
        stderr += text;

        // Parse progress from stderr (whisper.cpp outputs progress there)
        const progressMatch = text.match(/progress\s*=\s*(\d+)%/i);
        if (progressMatch) {
          const percent = parseInt(progressMatch[1], 10);
          const elapsed = Date.now() - this.startTime;
          this.emit("progress", {
            percent,
            timeElapsed: elapsed,
            timeRemaining: percent > 0 ? (elapsed / percent) * (100 - percent) : undefined,
          } as WhisperProgress);
        }
      });

      this.process.on("error", (err) => {
        reject(new Error(`Failed to start whisper process: ${err.message}`));
      });

      this.process.on("close", (code) => {
        if (code === 0) {
          try {
            const result = this.parseOutput(stdout);
            this.emit("complete", result);
            resolve(result);
          } catch {
            // Fallback to plain text if JSON parsing fails
            resolve({
              text: stdout.trim(),
              language: this.config.language || "en",
              segments: [],
              duration: (Date.now() - this.startTime) / 1000,
            });
          }
        } else {
          const error = new Error(`Whisper exited with code ${code}: ${stderr}`);
          this.emit("error", error);
          reject(error);
        }
      });
    });
  }

  private parseOutput(output: string): TranscriptionResult {
    // Try to parse as JSON first
    try {
      const json = JSON.parse(output);
      return {
        text: json.text || json.transcription?.map((s: { text: string }) => s.text).join(" ") || "",
        language: json.language || this.config.language || "en",
        segments:
          json.transcription?.map((s: { offsets: { from: number; to: number }; text: string }) => ({
            start: s.offsets?.from || 0,
            end: s.offsets?.to || 0,
            text: s.text || "",
          })) || [],
        duration: (Date.now() - this.startTime) / 1000,
      };
    } catch {
      // Parse plain text output
      const lines = output.trim().split("\n");
      const segments: TranscriptionResult["segments"] = [];
      let fullText = "";

      for (const line of lines) {
        // Parse timestamp format: [00:00:00.000 --> 00:00:02.000] text
        const match = line.match(/\[(\d+:\d+:\d+\.\d+)\s*-->\s*(\d+:\d+:\d+\.\d+)\]\s*(.+)/);
        if (match) {
          const start = this.parseTimestamp(match[1]);
          const end = this.parseTimestamp(match[2]);
          const text = match[3].trim();
          segments.push({ start, end, text });
          fullText += text + " ";
        }
      }

      return {
        text: fullText.trim() || output.trim(),
        language: this.config.language || "en",
        segments,
        duration: (Date.now() - this.startTime) / 1000,
      };
    }
  }

  private parseTimestamp(ts: string): number {
    const parts = ts.split(":");
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parseFloat(parts[2]);
    return hours * 3600 + minutes * 60 + seconds;
  }

  kill(): void {
    if (this.process) {
      this.process.kill("SIGTERM");
      this.process = null;
    }
  }

  isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }
}
