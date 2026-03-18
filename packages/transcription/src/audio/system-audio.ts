import { release } from "os";
import type { SystemAudioCapability } from "./types";

/**
 * Get macOS major version number
 * Darwin 23.x = macOS 14 (Sonoma)
 * Darwin 22.x = macOS 13 (Ventura)
 * Darwin 21.x = macOS 12 (Monterey)
 */
function getMacOSVersion(): number {
  if (process.platform !== "darwin") return 0;

  const darwinVersion = parseInt(release().split(".")[0], 10);
  // Darwin version - 9 = macOS version (approximately)
  // Darwin 23 = macOS 14, Darwin 22 = macOS 13, etc.
  return darwinVersion - 9;
}

/**
 * Check system audio capture capability on macOS
 */
export function checkSystemAudioCapability(): SystemAudioCapability {
  if (process.platform !== "darwin") {
    return {
      available: false,
      method: "none",
      requiresSetup: false,
      setupInstructions: "System audio capture is only supported on macOS",
    };
  }

  const macOSVersion = getMacOSVersion();

  // macOS 14.2+ (Sonoma) supports audio loopback via desktopCapturer
  if (macOSVersion >= 14) {
    return {
      available: true,
      method: "desktop-capturer",
      requiresSetup: true,
      macOSVersion,
      setupInstructions:
        "Grant Screen Recording permission in System Settings > Privacy & Security > Screen Recording. " +
        "This permission allows capturing audio from other applications.",
    };
  }

  // macOS 12.3+ supports ScreenCaptureKit but requires native code
  if (macOSVersion >= 12) {
    return {
      available: true,
      method: "screen-capture-kit",
      requiresSetup: true,
      macOSVersion,
      setupInstructions:
        "Grant Screen Recording permission in System Settings > Privacy & Security > Screen Recording. " +
        "For best results, consider installing BlackHole audio driver: brew install blackhole-2ch",
    };
  }

  // Older macOS requires BlackHole or similar virtual audio device
  return {
    available: false,
    method: "blackhole",
    requiresSetup: true,
    macOSVersion,
    setupInstructions:
      "Install BlackHole virtual audio driver: brew install blackhole-2ch\n" +
      "Then create a Multi-Output Device in Audio MIDI Setup to capture system audio.",
  };
}

/**
 * Get Electron desktopCapturer constraints for system audio capture
 * This is used in the renderer process
 */
export function getSystemAudioConstraints(): MediaStreamConstraints {
  return {
    audio: {
      // @ts-expect-error - Electron-specific constraint
      mandatory: {
        chromeMediaSource: "desktop",
      },
    },
    video: {
      // @ts-expect-error - Electron-specific constraint
      mandatory: {
        chromeMediaSource: "desktop",
        minWidth: 1,
        maxWidth: 1,
        minHeight: 1,
        maxHeight: 1,
      },
    },
  };
}

/**
 * Instructions for setting up system audio capture
 */
export const SYSTEM_AUDIO_SETUP_GUIDE = `
# System Audio Capture Setup Guide

## macOS 14.2+ (Sonoma)
1. Open System Settings > Privacy & Security > Screen Recording
2. Enable Marshall in the list
3. Restart Marshall

## macOS 12-14.1
1. Install BlackHole: brew install blackhole-2ch
2. Open Audio MIDI Setup (Applications > Utilities)
3. Click + and create a Multi-Output Device
4. Check both your speakers and BlackHole 2ch
5. Set the Multi-Output Device as your system output
6. In Marshall, select BlackHole 2ch as the audio input

## Supported Meeting Apps
- Zoom: Works with screen recording permission
- Microsoft Teams: Works with screen recording permission
- Google Meet: Works with screen recording permission
- Slack Huddles: Works with screen recording permission
- Discord: Works with screen recording permission
`;
