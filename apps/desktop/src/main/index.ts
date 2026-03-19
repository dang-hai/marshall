import { app, BrowserWindow, Tray, session, ipcMain, desktopCapturer, shell } from "electron";
import { join } from "path";
import { randomBytes } from "crypto";
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

const PROTOCOL = process.env.BETTER_AUTH_ELECTRON_PROTOCOL || "marshall";
const BETTER_AUTH_URL = process.env.BETTER_AUTH_URL || "http://localhost:3000";

/** Maximum time to wait for desktop auth completion */
const AUTH_REQUEST_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Pending auth requests (state -> callback)
const pendingAuthRequests = new Map<
  string,
  {
    resolve: (token: string) => void;
    reject: (error: Error) => void;
  }
>();

// Store auth token in memory (for this session)
let authToken: string | null = null;

// Register as default protocol handler for development
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [process.argv[1]]);
  }
} else {
  app.setAsDefaultProtocolClient(PROTOCOL);
}

// Handle deep link callback
function handleAuthCallback(url: string) {
  console.log("[Auth] Processing callback:", url);

  try {
    const parsed = new URL(url);
    // URL marshall://auth/callback parses as host=auth, pathname=/callback
    const isAuthCallback =
      (parsed.host === "auth" && parsed.pathname === "/callback") ||
      parsed.pathname === "/auth/callback" ||
      parsed.pathname === "//auth/callback";

    console.log("[Auth] Parsed URL - host:", parsed.host, "pathname:", parsed.pathname);

    if (!isAuthCallback) {
      console.log("[Auth] Not an auth callback");
      return;
    }

    const token = parsed.searchParams.get("token");
    const state = parsed.searchParams.get("state");

    if (!token || !state) {
      console.log("[Auth] Missing token or state");
      return;
    }

    const pending = pendingAuthRequests.get(state);
    if (pending) {
      console.log("[Auth] Found pending request for state:", state);
      // Store the token
      authToken = token;
      pending.resolve(token);
      pendingAuthRequests.delete(state);

      // Focus the main window
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    } else {
      console.log("[Auth] No pending request for state:", state);
    }
  } catch (error) {
    console.error("[Auth] Error processing callback:", error);
  }
}

// Handle deep link on macOS (app already running)
app.on("open-url", (event, url) => {
  event.preventDefault();
  console.log("[Auth] Deep link received:", url);
  handleAuthCallback(url);
});

// Handle deep link on Windows/Linux (app launched with URL)
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    const url = argv.find((arg) => arg.startsWith(`${PROTOCOL}://`));
    if (url) {
      console.log("[Auth] Deep link from second instance:", url);
      handleAuthCallback(url);
    }
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

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

  // Desktop auth: request auth flow
  ipcMain.handle("auth:request", async (_event, options?: { provider?: string }) => {
    const state = randomBytes(16).toString("hex");

    return new Promise<string>((resolve, reject) => {
      // Store the pending request
      pendingAuthRequests.set(state, { resolve, reject });

      // Set a timeout to clean up
      setTimeout(() => {
        if (pendingAuthRequests.has(state)) {
          pendingAuthRequests.delete(state);
          reject(new Error("Auth request timed out"));
        }
      }, AUTH_REQUEST_TTL_MS);

      // Build the auth URL
      let authUrl = `${BETTER_AUTH_URL}/auth/desktop/connect?state=${state}&scheme=${PROTOCOL}`;
      if (options?.provider) {
        // If provider specified, add it to auto-start OAuth
        authUrl = `${BETTER_AUTH_URL}/sign-in?desktop_state=${state}&desktop_scheme=${PROTOCOL}&provider=${options.provider}`;
      }

      console.log("[Auth] Opening auth URL:", authUrl);
      shell.openExternal(authUrl);
    });
  });

  // Get current auth token (from storage)
  ipcMain.handle("auth:get-token", () => {
    return authToken;
  });

  // Get current user from server
  ipcMain.handle("auth:get-user", async () => {
    if (!authToken) {
      return null;
    }

    try {
      const response = await fetch(`${BETTER_AUTH_URL}/api/user/me`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        console.log("[Auth] Failed to get user:", response.status);
        return null;
      }

      const data = await response.json();
      return data.user;
    } catch (error) {
      console.error("[Auth] Error getting user:", error);
      return null;
    }
  });

  // Clear auth token
  ipcMain.handle("auth:sign-out", () => {
    authToken = null;
    return true;
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
