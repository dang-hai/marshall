import { systemPreferences, dialog } from "electron";

export type PermissionStatus = "granted" | "denied" | "not-determined" | "restricted" | "unknown";

export interface PermissionsState {
  microphone: PermissionStatus;
  screen: PermissionStatus;
}

/**
 * Get current permission status for microphone
 */
export function getMicrophonePermission(): PermissionStatus {
  if (process.platform !== "darwin") return "granted";
  return systemPreferences.getMediaAccessStatus("microphone") as PermissionStatus;
}

/**
 * Get current permission status for screen capture
 */
export function getScreenPermission(): PermissionStatus {
  if (process.platform !== "darwin") return "granted";
  return systemPreferences.getMediaAccessStatus("screen") as PermissionStatus;
}

/**
 * Get all permission statuses
 */
export function getPermissions(): PermissionsState {
  return {
    microphone: getMicrophonePermission(),
    screen: getScreenPermission(),
  };
}

/**
 * Request microphone permission
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  if (process.platform !== "darwin") return true;

  const status = getMicrophonePermission();

  if (status === "granted") return true;

  if (status === "denied") {
    await dialog.showMessageBox({
      type: "warning",
      title: "Microphone Access Required",
      message: "Microphone access is required for transcription",
      detail:
        "Please enable microphone access in System Settings > Privacy & Security > Microphone, then restart Marshall.",
      buttons: ["Open System Settings", "Cancel"],
    });
    return false;
  }

  // Request permission (will show system dialog)
  return systemPreferences.askForMediaAccess("microphone");
}

/**
 * Request screen capture permission (for system audio)
 * Note: macOS doesn't have a programmatic way to request this,
 * we can only guide the user
 */
export async function requestScreenPermission(): Promise<boolean> {
  if (process.platform !== "darwin") return true;

  const status = getScreenPermission();

  if (status === "granted") return true;

  const result = await dialog.showMessageBox({
    type: "info",
    title: "Screen Recording Permission Required",
    message: "Screen recording permission is required to capture meeting audio",
    detail:
      "To transcribe audio from Zoom, Teams, Meet, and other apps:\n\n" +
      "1. Open System Settings > Privacy & Security > Screen Recording\n" +
      "2. Enable Marshall in the list\n" +
      "3. Restart Marshall\n\n" +
      "This permission allows capturing audio from other applications.",
    buttons: ["Open System Settings", "Later"],
  });

  if (result.response === 0) {
    // Open System Settings to Screen Recording
    const { shell } = await import("electron");
    shell.openExternal(
      "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"
    );
  }

  return false;
}

/**
 * Check if all required permissions are granted
 */
export function hasRequiredPermissions(requireScreen = false): boolean {
  const perms = getPermissions();

  if (perms.microphone !== "granted") return false;
  if (requireScreen && perms.screen !== "granted") return false;

  return true;
}
