import { BrowserWindow, ipcMain } from "electron";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface DetectedCall {
  id: string;
  appName: string;
  appIcon?: string;
  detectedAt: number;
  dismissed: boolean;
}

interface CallDetectionState {
  isMonitoring: boolean;
  detectedCalls: DetectedCall[];
  intervalId: NodeJS.Timeout | null;
}

const CALL_APP_PATTERNS: Record<string, RegExp> = {
  Zoom: /zoom\.us/i,
  "Google Meet": /Google Chrome.*meet\.google\.com|Google Meet/i,
  "Microsoft Teams": /Microsoft Teams/i,
  Slack: /Slack.*Huddle|Slack Call/i,
  Discord: /Discord/i,
  FaceTime: /FaceTime/i,
  Webex: /Webex|Cisco Webex/i,
  Skype: /Skype/i,
};

const POLLING_INTERVAL_MS = 3000;

const state: CallDetectionState = {
  isMonitoring: false,
  detectedCalls: [],
  intervalId: null,
};

async function getRunningProcesses(): Promise<string[]> {
  try {
    if (process.platform === "darwin") {
      // Get all running processes with more detail
      const { stdout } = await execAsync(
        "ps -eo comm | grep -iE 'zoom|meet|teams|slack|discord|facetime|webex|skype|chrome|firefox|safari|edge' || true"
      );
      const processes = stdout.split("\n").filter(Boolean);
      console.log("[CallDetection] Running processes:", processes);
      return processes;
    }

    if (process.platform === "win32") {
      const { stdout } = await execAsync(
        'tasklist /FO CSV /NH | findstr /I "zoom meet teams slack discord skype webex"'
      );
      return stdout.split("\n").filter(Boolean);
    }

    // Linux
    const { stdout } = await execAsync(
      "ps -eo comm | grep -iE 'zoom|meet|teams|slack|discord|skype|webex' || true"
    );
    return stdout.split("\n").filter(Boolean);
  } catch (error) {
    console.error("[CallDetection] Error getting processes:", error);
    return [];
  }
}

async function getActiveWindowInfo(): Promise<string | null> {
  try {
    if (process.platform === "darwin") {
      const { stdout } = await execAsync(`
        osascript -e 'tell application "System Events"
          set frontApp to name of first application process whose frontmost is true
          return frontApp
        end tell'
      `);
      const activeApp = stdout.trim();
      console.log("[CallDetection] Active app:", activeApp);
      return activeApp;
    }
    return null;
  } catch (error) {
    console.error("[CallDetection] Error getting active window:", error);
    return null;
  }
}

// Google Meet meeting URLs have a code pattern like: xxx-xxxx-xxx
const GOOGLE_MEET_MEETING_PATTERN = /meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/i;

function isActualMeetingUrl(url: string): boolean {
  // Exclude landing pages, settings, etc.
  const excludePatterns = [
    /meet\.google\.com\/landing/i,
    /meet\.google\.com\/?$/,
    /meet\.google\.com\/\?/,
  ];

  if (excludePatterns.some((pattern) => pattern.test(url))) {
    return false;
  }

  // Check for actual meeting code pattern
  return GOOGLE_MEET_MEETING_PATTERN.test(url);
}

async function checkBrowserForMeet(): Promise<{ app: string; url: string } | null> {
  try {
    if (process.platform === "darwin") {
      // Check Chrome for Google Meet
      const { stdout: chromeUrl } = await execAsync(`
        osascript -e 'tell application "Google Chrome"
          if it is running then
            set tabList to {}
            repeat with w in windows
              repeat with t in tabs of w
                set tabUrl to URL of t
                if tabUrl contains "meet.google.com" then
                  return tabUrl
                end if
              end repeat
            end repeat
          end if
          return ""
        end tell' 2>/dev/null || echo ""
      `);

      const chromeUrlTrimmed = chromeUrl.trim();
      if (chromeUrlTrimmed && isActualMeetingUrl(chromeUrlTrimmed)) {
        console.log("[CallDetection] Found Google Meet call in Chrome:", chromeUrlTrimmed);
        return { app: "Google Chrome", url: chromeUrlTrimmed };
      }

      // Check Safari for Google Meet
      const { stdout: safariUrl } = await execAsync(`
        osascript -e 'tell application "Safari"
          if it is running then
            repeat with w in windows
              repeat with t in tabs of w
                set tabUrl to URL of t
                if tabUrl contains "meet.google.com" then
                  return tabUrl
                end if
              end repeat
            end repeat
          end if
          return ""
        end tell' 2>/dev/null || echo ""
      `);

      const safariUrlTrimmed = safariUrl.trim();
      if (safariUrlTrimmed && isActualMeetingUrl(safariUrlTrimmed)) {
        console.log("[CallDetection] Found Google Meet call in Safari:", safariUrlTrimmed);
        return { app: "Safari", url: safariUrlTrimmed };
      }
    }
    return null;
  } catch {
    // Silently fail - browser might not be running or accessible
    return null;
  }
}

function detectCallFromProcess(process: string): { appName: string } | null {
  for (const [appName, pattern] of Object.entries(CALL_APP_PATTERNS)) {
    if (pattern.test(process)) {
      return { appName };
    }
  }
  return null;
}

function generateCallId(appName: string): string {
  return `${appName.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;
}

async function checkForCalls(mainWindow: BrowserWindow): Promise<void> {
  console.log("[CallDetection] Checking for calls...");

  const processes = await getRunningProcesses();
  const activeWindow = await getActiveWindowInfo();
  const browserMeet = await checkBrowserForMeet();

  const detectedApps = new Set<string>();

  // Check running processes for native apps (Zoom, Teams, etc.)
  for (const proc of processes) {
    const detected = detectCallFromProcess(proc);
    if (detected) {
      console.log("[CallDetection] Detected from process:", detected.appName);
      detectedApps.add(detected.appName);
    }
  }

  // Check active window
  if (activeWindow) {
    const detected = detectCallFromProcess(activeWindow);
    if (detected) {
      console.log("[CallDetection] Detected from active window:", detected.appName);
      detectedApps.add(detected.appName);
    }
  }

  // Check browser tabs for Google Meet
  if (browserMeet) {
    console.log("[CallDetection] Detected Google Meet in browser");
    detectedApps.add("Google Meet");
  }

  console.log("[CallDetection] Total detected apps:", Array.from(detectedApps));

  // Check for new calls
  for (const appName of detectedApps) {
    const existingCall = state.detectedCalls.find(
      (call) => call.appName === appName && !call.dismissed
    );

    if (!existingCall) {
      const newCall: DetectedCall = {
        id: generateCallId(appName),
        appName,
        detectedAt: Date.now(),
        dismissed: false,
      };

      console.log("[CallDetection] New call detected!", newCall);
      state.detectedCalls.push(newCall);
      mainWindow.webContents.send("call-detection:call-detected", newCall);
    }
  }

  // Clean up old dismissed calls (older than 5 minutes)
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  state.detectedCalls = state.detectedCalls.filter(
    (call) => !call.dismissed || call.detectedAt > fiveMinutesAgo
  );
}

export function setupCallDetectionIPC(mainWindow: BrowserWindow): void {
  console.log("[CallDetection] Setting up IPC handlers");

  ipcMain.handle("call-detection:start-monitoring", () => {
    if (state.isMonitoring) {
      console.log("[CallDetection] Already monitoring");
      return { status: "already-monitoring" };
    }

    console.log("[CallDetection] Starting monitoring (polling every", POLLING_INTERVAL_MS, "ms)");
    state.isMonitoring = true;
    state.intervalId = setInterval(() => {
      checkForCalls(mainWindow);
    }, POLLING_INTERVAL_MS);

    // Run initial check
    checkForCalls(mainWindow);

    return { status: "started" };
  });

  ipcMain.handle("call-detection:stop-monitoring", () => {
    if (!state.isMonitoring) {
      return { status: "not-monitoring" };
    }

    state.isMonitoring = false;
    if (state.intervalId) {
      clearInterval(state.intervalId);
      state.intervalId = null;
    }

    return { status: "stopped" };
  });

  ipcMain.handle("call-detection:get-detected-calls", () => {
    return state.detectedCalls.filter((call) => !call.dismissed);
  });

  ipcMain.handle("call-detection:dismiss-call", (_event, callId: string) => {
    const call = state.detectedCalls.find((c) => c.id === callId);
    if (call) {
      call.dismissed = true;
      mainWindow.webContents.send("call-detection:call-dismissed", callId);
    }
    return { status: "dismissed" };
  });

  ipcMain.handle("call-detection:is-monitoring", () => {
    return state.isMonitoring;
  });
}

export function stopCallDetection(): void {
  if (state.intervalId) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }
  state.isMonitoring = false;
}
