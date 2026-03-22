/**
 * Fixes the PATH environment variable for packaged Electron apps.
 *
 * When Electron is launched from Finder/Dock (not terminal), it doesn't
 * inherit the user's shell PATH, which means CLI tools like `codex` and
 * `claude` can't be found. This module fetches the user's shell PATH
 * and updates process.env.PATH.
 */
import { spawn } from "child_process";

let pathFixed = false;

/**
 * Gets the user's default shell from environment or falls back to common shells.
 */
function getDefaultShell(): string {
  return process.env.SHELL || "/bin/zsh";
}

/**
 * Fetches the PATH from the user's login shell.
 */
function getShellPath(): Promise<string | null> {
  return new Promise((resolve) => {
    const shell = getDefaultShell();
    // Use login shell (-l) to get full PATH including ~/.zshrc, ~/.bashrc, etc.
    const child = spawn(shell, ["-l", "-c", "echo $PATH"], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });

    child.on("close", (code) => {
      if (code === 0 && stdout.trim()) {
        resolve(stdout.trim());
      } else {
        resolve(null);
      }
    });

    child.on("error", () => {
      resolve(null);
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      child.kill();
      resolve(null);
    }, 5000);
  });
}

/**
 * Fixes process.env.PATH to include the user's shell PATH.
 * Should be called early in the main process, before spawning any child processes.
 *
 * This is a no-op in development (when running from terminal) since PATH is already correct.
 */
export async function fixPath(): Promise<void> {
  if (pathFixed) return;

  // Skip in development - PATH is already correct when running from terminal
  if (process.env.ELECTRON_RENDERER_URL) {
    pathFixed = true;
    return;
  }

  try {
    const userPath = await getShellPath();
    if (userPath) {
      process.env.PATH = userPath;
    }
    pathFixed = true;
  } catch (error) {
    console.error("Failed to fix PATH:", error);
    // Don't throw - continue with default PATH
    pathFixed = true;
  }
}
