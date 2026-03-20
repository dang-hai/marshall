import {
  app,
  BrowserWindow,
  Tray,
  session,
  ipcMain,
  desktopCapturer,
  shell,
  screen,
} from "electron";
import { join } from "path";
import { randomBytes } from "crypto";
import type {
  CodexMonitorSessionInput,
  CreateNoteInput,
  SaveNoteTranscriptionInput,
  UpdateNoteInput,
} from "@marshall/shared";
import { createTray } from "./tray";
import { setupTranscriptionIPC } from "./transcription";
import { setupSettingsIPC } from "./settings";
import { setupCallDetectionIPC, stopCallDetection } from "./call-detection";
import { CodexMonitorMCPService } from "./codex-monitor-mcp";
import { setupIntegrationsIPC, setNotionToken } from "./integrations";
import { setupNotionIntegrationIPC } from "./notion-integration";
import { NotchCompanionManager } from "./notch-companion";
import type { NoteRecord, StoredNotionToken } from "@marshall/shared";

// Suppress Chromium DevTools warnings that are not relevant to Electron
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true";

// Disable Chromium features that cause DevTools errors
app.commandLine.appendSwitch("disable-features", "AutofillServerCommunication");

// Enable audio loopback for system audio capture (macOS 14.2+)
app.commandLine.appendSwitch("enable-features", "AudioServiceOutOfProcess");

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let codexNotificationWindow: BrowserWindow | null = null;
let codexMonitorInstance: CodexMonitorMCPService | null = null;
let notchCompanionInstance: NotchCompanionManager | null = null;

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

const pendingCalendarConnectionRequests = new Map<
  string,
  {
    resolve: () => void;
    reject: (error: Error) => void;
  }
>();

const pendingNotionConnectionRequests = new Map<
  string,
  {
    resolve: (token: StoredNotionToken) => void;
    reject: (error: Error) => void;
  }
>();

// Store auth token in memory (for this session)
let authToken: string | null = null;

async function authenticatedJsonRequest(path: string, init?: RequestInit) {
  if (!authToken) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(`${BETTER_AUTH_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
      ...init?.headers,
    },
  });

  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) {
    throw new Error(payload?.error || `Request failed with status ${response.status}`);
  }

  return payload;
}

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

function handleCalendarCallback(url: string) {
  try {
    const parsed = new URL(url);
    const isCalendarSuccess =
      (parsed.host === "calendar" && parsed.pathname === "/callback") ||
      parsed.pathname === "/calendar/callback" ||
      parsed.pathname === "//calendar/callback";
    const isCalendarError =
      (parsed.host === "calendar" && parsed.pathname === "/error") ||
      parsed.pathname === "/calendar/error" ||
      parsed.pathname === "//calendar/error";

    if (!isCalendarSuccess && !isCalendarError) {
      return;
    }

    const state = parsed.searchParams.get("state");
    if (!state) {
      return;
    }

    const pending = pendingCalendarConnectionRequests.get(state);
    if (!pending) {
      return;
    }

    pendingCalendarConnectionRequests.delete(state);

    if (isCalendarError) {
      const error = parsed.searchParams.get("error") || "Google Calendar connection failed";
      pending.reject(new Error(error));
    } else {
      pending.resolve();
    }

    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  } catch (error) {
    console.error("[Calendar] Error processing callback:", error);
  }
}

function handleNotionCallback(url: string) {
  try {
    const parsed = new URL(url);
    const isNotionSuccess =
      (parsed.host === "notion" && parsed.pathname === "/callback") ||
      parsed.pathname === "/notion/callback" ||
      parsed.pathname === "//notion/callback";
    const isNotionError =
      (parsed.host === "notion" && parsed.pathname === "/error") ||
      parsed.pathname === "/notion/error" ||
      parsed.pathname === "//notion/error";

    if (!isNotionSuccess && !isNotionError) {
      return;
    }

    const state = parsed.searchParams.get("state");
    if (!state) {
      return;
    }

    const pending = pendingNotionConnectionRequests.get(state);
    if (!pending) {
      console.log("[Notion] No pending request for state:", state);
      return;
    }

    pendingNotionConnectionRequests.delete(state);

    if (isNotionError) {
      const error = parsed.searchParams.get("error") || "Notion connection failed";
      pending.reject(new Error(error));
    } else {
      // Parse the token from the callback URL
      const tokenParam = parsed.searchParams.get("token");
      if (!tokenParam) {
        pending.reject(new Error("No token received from Notion OAuth"));
        return;
      }

      try {
        const token = JSON.parse(decodeURIComponent(tokenParam)) as StoredNotionToken;
        // Store the token
        setNotionToken(token);
        console.log("[Notion] Token stored for workspace:", token.workspaceName);
        pending.resolve(token);
      } catch {
        pending.reject(new Error("Failed to parse Notion token"));
        return;
      }
    }

    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  } catch (error) {
    console.error("[Notion] Error processing callback:", error);
  }
}

function handleProtocolCallback(url: string) {
  handleAuthCallback(url);
  handleCalendarCallback(url);
  handleNotionCallback(url);
}

// Handle deep link on macOS (app already running)
app.on("open-url", (event, url) => {
  event.preventDefault();
  console.log("[Auth] Deep link received:", url);
  handleProtocolCallback(url);
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
      handleProtocolCallback(url);
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

  loadRendererWindow(mainWindow);

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
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

function loadRendererWindow(window: BrowserWindow, query?: Record<string, string>) {
  if (process.env.ELECTRON_RENDERER_URL) {
    const url = new URL(process.env.ELECTRON_RENDERER_URL);
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }
    window.loadURL(url.toString());
    return;
  }

  window.loadFile(join(__dirname, "../renderer/index.html"), {
    query,
  });
}

function getOpenWindows() {
  return [mainWindow].filter((window): window is BrowserWindow => window !== null);
}

function createCodexNotificationWindow() {
  if (codexNotificationWindow && !codexNotificationWindow.isDestroyed()) {
    return codexNotificationWindow;
  }

  const { workArea } = screen.getPrimaryDisplay();
  codexNotificationWindow = new BrowserWindow({
    width: 380,
    height: 560,
    minWidth: 320,
    minHeight: 300,
    maxWidth: 500,
    maxHeight: 800,
    x: workArea.x + workArea.width - 400,
    y: workArea.y + 56,
    show: false,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: true,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  codexNotificationWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  loadRendererWindow(codexNotificationWindow, { window: "codex-monitor" });

  codexNotificationWindow.on("closed", () => {
    codexNotificationWindow = null;
  });

  return codexNotificationWindow;
}

function setupCodexMonitorWindowHandlers(window: BrowserWindow) {
  if (!codexMonitorInstance) return;

  // Hide codex notification window when main window is hidden (macOS close behavior)
  window.on("hide", () => {
    codexMonitorInstance?.hideWindow();
  });

  // Show codex notification window when main window is shown again
  window.on("show", () => {
    codexMonitorInstance?.showWindowIfNeeded();
  });

  // Clean up codex resources when main window is actually destroyed
  window.on("closed", () => {
    void codexMonitorInstance?.dispose();
  });
}

app.whenReady().then(() => {
  const codexMonitor = new CodexMonitorMCPService({
    createNotificationWindow: createCodexNotificationWindow,
    fetchNotes: async (params) => {
      try {
        const query = new URLSearchParams();
        if (params.limit) query.set("limit", String(params.limit));
        if (params.search) query.set("search", params.search);
        const queryStr = query.toString();
        const path = queryStr ? `/api/notes?${queryStr}` : "/api/notes";
        const payload = await authenticatedJsonRequest(path);
        return (payload as { notes: NoteRecord[] }).notes;
      } catch {
        return [];
      }
    },
    fetchNote: async (noteId) => {
      try {
        const payload = await authenticatedJsonRequest(`/api/notes/${noteId}`);
        return (payload as { note: NoteRecord }).note;
      } catch {
        return null;
      }
    },
  });

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

  // Set up integrations IPC handlers (Notion, etc.)
  setupIntegrationsIPC();

  // Set up Notion integration IPC handlers (search, save, context)
  setupNotionIntegrationIPC();

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

  ipcMain.handle("calendar:get-status", async () => {
    return authenticatedJsonRequest("/api/calendar/google/status");
  });

  ipcMain.handle("calendar:get-upcoming-events", async (_event, limit = 5) => {
    const payload = await authenticatedJsonRequest(`/api/calendar/google/upcoming?limit=${limit}`);
    return (payload as { events: unknown[] }).events;
  });

  ipcMain.handle("calendar:connect-google", async () => {
    const state = randomBytes(16).toString("hex");
    const url = `${BETTER_AUTH_URL}/calendar/connect?desktop_state=${encodeURIComponent(state)}&desktop_scheme=${encodeURIComponent(PROTOCOL)}`;

    return new Promise<boolean>((resolve, reject) => {
      pendingCalendarConnectionRequests.set(state, {
        resolve: () => resolve(true),
        reject,
      });

      setTimeout(() => {
        if (pendingCalendarConnectionRequests.has(state)) {
          pendingCalendarConnectionRequests.delete(state);
          reject(new Error("Google Calendar connection timed out"));
        }
      }, AUTH_REQUEST_TTL_MS);

      void shell.openExternal(url).catch((error) => {
        pendingCalendarConnectionRequests.delete(state);
        reject(error instanceof Error ? error : new Error("Failed to open Google Calendar auth"));
      });
    });
  });

  ipcMain.handle("notion:connect", async () => {
    const state = randomBytes(16).toString("hex");
    const url = `${BETTER_AUTH_URL}/notion/connect?state=${encodeURIComponent(state)}&scheme=${encodeURIComponent(PROTOCOL)}`;

    return new Promise<StoredNotionToken>((resolve, reject) => {
      pendingNotionConnectionRequests.set(state, {
        resolve,
        reject,
      });

      setTimeout(() => {
        if (pendingNotionConnectionRequests.has(state)) {
          pendingNotionConnectionRequests.delete(state);
          reject(new Error("Notion connection timed out"));
        }
      }, AUTH_REQUEST_TTL_MS);

      void shell.openExternal(url).catch((error) => {
        pendingNotionConnectionRequests.delete(state);
        reject(error instanceof Error ? error : new Error("Failed to open Notion auth"));
      });
    });
  });

  ipcMain.handle("notes:list", async () => {
    const payload = await authenticatedJsonRequest("/api/notes");
    return (payload as { notes: unknown[] }).notes;
  });

  ipcMain.handle("notes:create", async (_event, input?: CreateNoteInput) => {
    const payload = await authenticatedJsonRequest("/api/notes", {
      method: "POST",
      body: JSON.stringify(input ?? {}),
    });
    return (payload as { note: unknown }).note;
  });

  ipcMain.handle("notes:update", async (_event, noteId: string, input: UpdateNoteInput) => {
    const payload = await authenticatedJsonRequest(`/api/notes/${noteId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    return (payload as { note: unknown }).note;
  });

  ipcMain.handle(
    "notes:save-transcription",
    async (_event, noteId: string, input: SaveNoteTranscriptionInput) => {
      const payload = await authenticatedJsonRequest(`/api/notes/${noteId}/transcription`, {
        method: "PUT",
        body: JSON.stringify(input),
      });
      return (payload as { transcription: unknown }).transcription;
    }
  );

  ipcMain.handle("codex-monitor:update-session", async (_event, input: CodexMonitorSessionInput) =>
    codexMonitor.updateSession(input)
  );
  ipcMain.handle("codex-monitor:clear-session", async (_event, noteId?: string) =>
    codexMonitor.clearSession(noteId)
  );
  ipcMain.handle("codex-monitor:get-state", () => codexMonitor.getState());
  ipcMain.handle("codex-monitor:dismiss-window", () => codexMonitor.dismissWindow());
  ipcMain.handle("codex-monitor:show-window", () => {
    codexMonitor.showWindow();
    return { status: "shown" };
  });
  ipcMain.handle("codex-monitor:send-chat", async (_event, message: string) =>
    codexMonitor.sendChat(message)
  );
  ipcMain.handle(
    "codex-monitor:accept-meeting-proposal",
    async (_event, proposalId: string, participants?: string[]) => {
      const result = await codexMonitor.acceptMeetingProposal(proposalId, participants);
      if (result.status !== "accepted") {
        return result;
      }

      // Get the proposal and create the calendar event
      const proposal = codexMonitor.getMeetingProposal(proposalId);
      if (!proposal) {
        return { status: "error", error: "Proposal not found after accept" };
      }

      // Use the proposal's participants (already updated by acceptMeetingProposal)
      const attendees = proposal.participants;

      try {
        const payload = await authenticatedJsonRequest("/api/calendar/google/events", {
          method: "POST",
          body: JSON.stringify({
            title: proposal.title,
            startAt: proposal.startAt,
            endAt: proposal.endAt,
            description: proposal.description ?? undefined,
            location: proposal.location ?? undefined,
            attendees: attendees.length > 0 ? attendees : undefined,
          }),
        });

        const response = payload as { event?: unknown; error?: string };
        if (response.error) {
          return { status: "error", error: response.error };
        }

        return { status: "accepted", event: response.event };
      } catch (error) {
        return {
          status: "error",
          error: error instanceof Error ? error.message : "Failed to create calendar event",
        };
      }
    }
  );
  ipcMain.handle(
    "codex-monitor:remind-meeting-proposal",
    async (_event, proposalId: string, participants?: string[]) =>
      codexMonitor.remindMeetingProposal(proposalId, participants)
  );
  ipcMain.handle("codex-monitor:discard-meeting-proposal", async (_event, proposalId: string) =>
    codexMonitor.discardMeetingProposal(proposalId)
  );
  // AI completion handler
  ipcMain.handle("ai:completion", async (_event, input: { prompt: string; system?: string }) => {
    const payload = await authenticatedJsonRequest("/api/ai/completion", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return payload as { text: string };
  });

  // Shell IPC handlers
  ipcMain.handle("shell:open-path", async (_event, path: string) => {
    return shell.openPath(path);
  });

  codexMonitorInstance = codexMonitor;

  // Initialize NotchCompanion (native macOS notch overlay)
  if (process.platform === "darwin") {
    notchCompanionInstance = new NotchCompanionManager();
    notchCompanionInstance.start().catch((error) => {
      console.error("[NotchCompanion] Failed to start:", error);
    });

    // Wire up state broadcasting
    codexMonitor.setNotchCompanion(notchCompanionInstance);
  }

  createWindow();
  tray = createTray(mainWindow);

  // Set up transcription IPC handlers and codex monitor window lifecycle
  if (mainWindow) {
    setupTranscriptionIPC(getOpenWindows);
    setupCallDetectionIPC(mainWindow);
    setupCodexMonitorWindowHandlers(mainWindow);
  }

  app.on("activate", () => {
    if (mainWindow === null) {
      createWindow();
      if (mainWindow) {
        setupTranscriptionIPC(getOpenWindows);
        setupCallDetectionIPC(mainWindow);
        setupCodexMonitorWindowHandlers(mainWindow);
      }
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
  stopCallDetection();
  notchCompanionInstance?.stop();
  if (tray) {
    tray.destroy();
  }
});

// Handle SIGTERM/SIGINT for clean shutdown (e.g., when mprocs exits)
const cleanup = () => {
  notchCompanionInstance?.stop();
  app.quit();
};
process.on("SIGTERM", cleanup);
process.on("SIGINT", cleanup);
