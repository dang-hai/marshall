/**
 * Fixes the PATH environment variable for packaged Electron apps.
 *
 * When Electron is launched from Finder/Dock (not terminal), it doesn't
 * inherit the user's shell PATH, which means CLI tools like `codex` and
 * `claude` can't be found. This module fetches the user's shell PATH
 * and updates process.env.PATH.
 */
import shellPath from "shell-path";

let pathFixed = false;

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
    const userPath = await shellPath();
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
