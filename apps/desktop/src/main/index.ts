import { app, BrowserWindow, Tray, session } from "electron";
import { join } from "path";
import { createTray } from "./tray";
import { setupTranscriptionIPC } from "./transcription";

// Suppress Chromium DevTools warnings that are not relevant to Electron
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true";

// Disable Chromium features that cause DevTools errors
app.commandLine.appendSwitch("disable-features", "AutofillServerCommunication");

// Enable audio loopback for system audio capture (macOS 14.2+)
app.commandLine.appendSwitch("enable-features", "AudioServiceOutOfProcess");

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Filter out known Chromium DevTools errors
  mainWindow.webContents.on("console-message", (_event, _level, message) => {
    // Suppress Autofill.enable error which is a known Chromium/DevTools issue
    if (message.includes("Autofill.enable")) {
      return;
    }
  });

  // electron-vite injects these env vars
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    // DevTools can be opened manually with Cmd+Option+I
    // Not opening automatically to avoid Chromium DevTools errors in console
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.on("close", (event) => {
    if (process.platform === "darwin") {
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
  if (tray) {
    tray.destroy();
  }
});
