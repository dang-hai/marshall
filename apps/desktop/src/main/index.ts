import { app, BrowserWindow, Tray, session, ipcMain, desktopCapturer, shell } from "electron";
import { join } from "path";
import { createTray } from "./tray";
import { setupTranscriptionIPC } from "./transcription";
import { setupSettingsIPC } from "./settings";

// Suppress Chromium DevTools warnings that are not relevant to Electron
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true";

// Disable Chromium features that cause DevTools errors
app.commandLine.appendSwitch("disable-features", "AutofillServerCommunication");

// Enable audio loopback for system audio capture (macOS 14.2+)
app.commandLine.appendSwitch("enable-features", "AudioServiceOutOfProcess");

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // Required for ESM preload scripts
    },
  });

  // Log renderer console messages to terminal (for debugging)
  mainWindow.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    // Suppress Autofill.enable error which is a known Chromium/DevTools issue
    if (message.includes("Autofill.enable")) {
      return;
    }
    // Log errors and warnings to terminal
    if (level >= 2) {
      const logFn = level === 2 ? console.warn : console.error;
      logFn(`[Renderer] ${message}`);
      if (sourceId) logFn(`  at ${sourceId}:${line}`);
    }
  });

  // electron-vite injects these env vars
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    // Open DevTools in development
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.on("close", (event) => {
    if (process.platform === "darwin" && !isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
}

app.whenReady().then(() => {
  // Set up permission handlers for media access
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    // Allow media permissions (microphone, screen capture)
    const allowedPermissions = ["media", "microphone", "screen"];
    if (allowedPermissions.includes(permission)) {
      callback(true);
    } else {
      callback(false);
    }
  });

  // Handle display media request (for system audio capture)
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    // Allow the request and let the user select the source
    // For system audio, we typically want the entire screen
    callback({ video: request.frame, audio: "loopback" });
  });

  // Set up settings IPC handlers first (needed by transcription)
  setupSettingsIPC();

  // Desktop capturer IPC handler (required for Electron 30+)
  ipcMain.handle("desktop-capturer:get-sources", async (_event, options) => {
    return desktopCapturer.getSources(options);
  });

  // Shell IPC handlers
  ipcMain.handle("shell:open-path", async (_event, path: string) => {
    return shell.openPath(path);
  });

  createWindow();
  tray = createTray(mainWindow);

  // Set up transcription IPC handlers
  if (mainWindow) {
    setupTranscriptionIPC(mainWindow);
  }

  app.on("activate", () => {
    if (mainWindow === null) {
      createWindow();
    } else {
      mainWindow.show();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  isQuitting = true;
  if (tray) {
    tray.destroy();
  }
});
