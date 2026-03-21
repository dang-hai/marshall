/**
 * Auto-Updater Service
 *
 * Manages automatic updates for the Electron app using electron-updater.
 * Broadcasts update status to renderer and handles user-initiated actions.
 */

import electronUpdater, { type UpdateInfo, type ProgressInfo } from "electron-updater";

const autoUpdater = electronUpdater.autoUpdater;
import { BrowserWindow, ipcMain, app } from "electron";
import { getSetting } from "./settings";
import type { UpdateStatus } from "../shared/auto-updater";

let updateStatus: UpdateStatus = { status: "idle" };

function getMainWindow(): BrowserWindow | null {
  const windows = BrowserWindow.getAllWindows();
  return windows.find((w) => !w.isDestroyed()) ?? null;
}

function broadcastUpdateStatus(status: UpdateStatus): void {
  updateStatus = status;
  const mainWindow = getMainWindow();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("auto-updater:status", status);
  }
}

export function setupAutoUpdater(): void {
  // Configure auto-updater
  autoUpdater.autoDownload = false; // Let user decide when to download
  autoUpdater.autoInstallOnAppQuit = true;

  // Event handlers
  autoUpdater.on("checking-for-update", () => {
    console.log("[AutoUpdater] Checking for updates...");
    broadcastUpdateStatus({ status: "checking" });
  });

  autoUpdater.on("update-available", (info: UpdateInfo) => {
    console.log("[AutoUpdater] Update available:", info.version);
    broadcastUpdateStatus({
      status: "available",
      version: info.version,
      releaseNotes: typeof info.releaseNotes === "string" ? info.releaseNotes : undefined,
    });
  });

  autoUpdater.on("update-not-available", () => {
    console.log("[AutoUpdater] No updates available");
    broadcastUpdateStatus({ status: "idle" });
  });

  autoUpdater.on("download-progress", (progress: ProgressInfo) => {
    console.log("[AutoUpdater] Download progress:", Math.round(progress.percent), "%");
    broadcastUpdateStatus({
      status: "downloading",
      progress: Math.round(progress.percent),
    });
  });

  autoUpdater.on("update-downloaded", (info: UpdateInfo) => {
    console.log("[AutoUpdater] Update downloaded:", info.version);
    broadcastUpdateStatus({
      status: "downloaded",
      version: info.version,
    });
  });

  autoUpdater.on("error", (error: Error) => {
    console.error("[AutoUpdater] Error:", error.message);
    broadcastUpdateStatus({
      status: "error",
      error: error.message,
    });
  });

  // IPC handlers
  ipcMain.handle("auto-updater:check", async () => {
    try {
      // Skip in development
      if (process.env.ELECTRON_RENDERER_URL) {
        console.log("[AutoUpdater] Skipping check in development mode");
        return { status: "idle", error: "Development mode" };
      }
      await autoUpdater.checkForUpdates();
      return { status: "checking" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Check failed";
      console.error("[AutoUpdater] Check failed:", message);
      return { status: "error", error: message };
    }
  });

  ipcMain.handle("auto-updater:download", async () => {
    try {
      await autoUpdater.downloadUpdate();
      return { status: "downloading" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Download failed";
      console.error("[AutoUpdater] Download failed:", message);
      return { status: "error", error: message };
    }
  });

  ipcMain.handle("auto-updater:install", () => {
    console.log("[AutoUpdater] Quitting and installing update...");
    autoUpdater.quitAndInstall(false, true);
  });

  ipcMain.handle("auto-updater:get-status", () => {
    return updateStatus;
  });

  ipcMain.handle("auto-updater:get-version", () => {
    return app.getVersion();
  });
}

export function checkForUpdatesOnLaunch(): void {
  // Only check if enabled in settings
  const appSettings = getSetting("app");
  if (!appSettings.checkUpdates) {
    console.log("[AutoUpdater] Auto-check disabled in settings");
    return;
  }

  // Skip in development
  if (process.env.ELECTRON_RENDERER_URL) {
    console.log("[AutoUpdater] Skipping update check in development mode");
    return;
  }

  // Delay check to let app fully load
  setTimeout(() => {
    console.log("[AutoUpdater] Checking for updates on launch...");
    autoUpdater.checkForUpdates().catch((error: unknown) => {
      console.error("[AutoUpdater] Launch check failed:", error);
    });
  }, 5000);
}
