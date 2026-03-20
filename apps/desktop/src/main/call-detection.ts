import { BrowserWindow, ipcMain } from "electron";
import { exec } from "child_process";
import { promisify } from "util";
import {
  detectCallFromProcess,
  filterTrackedCallsToActiveApps,
  hasTrackedCallForApp,
} from "../shared/call-detection";

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
      return stdout.split("\n").filter(Boolean);
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
      return stdout.trim();
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
        return { app: "Safari", url: safariUrlTrimmed };
      }
    }
    return null;
  } catch {
    // Silently fail - browser might not be running or accessible
    return null;
  }
}

function generateCallId(appName: string): string {
  return `${appName.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;
}

async function checkForCalls(mainWindow: BrowserWindow): Promise<void> {
  // Run all detection checks concurrently for better performance
  const [processes, activeWindow, browserMeet] = await Promise.all([
    getRunningProcesses(),
    getActiveWindowInfo(),
    checkBrowserForMeet(),
  ]);

  const detectedApps = new Set<string>();

  // Check running processes for native apps (Zoom, Teams, etc.)
  for (const proc of processes) {
    const detected = detectCallFromProcess(proc);
    if (detected) {
      detectedApps.add(detected.appName);
    }
  }

  // Check active window
  if (activeWindow) {
    const detected = detectCallFromProcess(activeWindow);
    if (detected) {
      detectedApps.add(detected.appName);
    }
  }

  // Check browser tabs for Google Meet
  if (browserMeet) {
    detectedApps.add("Google Meet");
  }

  // Check for new calls
  for (const appName of detectedApps) {
    const existingCall = hasTrackedCallForApp(state.detectedCalls, appName);

    if (!existingCall) {
      const newCall: DetectedCall = {
        id: generateCallId(appName),
        appName,
        detectedAt: Date.now(),
        dismissed: false,
      };

      state.detectedCalls.push(newCall);
      mainWindow.webContents.send("call-detection:call-detected", newCall);
    }
  }

  const inactiveCalls = state.detectedCalls.filter(
    (call) => !call.dismissed && !detectedApps.has(call.appName)
  );

  for (const inactiveCall of inactiveCalls) {
    mainWindow.webContents.send("call-detection:call-dismissed", inactiveCall.id);
  }

  // Keep tracked calls only while their app remains active, which prevents
  // dismissed notifications from respawning during the same call but allows
  // future calls from the same app to notify again.
  state.detectedCalls = filterTrackedCallsToActiveApps(state.detectedCalls, detectedApps);
}

export function setupCallDetectionIPC(mainWindow: BrowserWindow): void {
  ipcMain.handle("call-detection:start-monitoring", () => {
    if (state.isMonitoring) {
      return { status: "already-monitoring" };
    }

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
