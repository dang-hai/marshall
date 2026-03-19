export const CALL_APP_PATTERNS: Record<string, RegExp> = {
  Zoom: /^zoom\.us$/i,
  "Google Meet": /^Google Meet$/i,
  "Microsoft Teams": /Microsoft Teams/i,
  Slack: /Slack.*Huddle|Slack Call/i,
  Discord: /^Discord$/i,
  FaceTime: /^FaceTime$/i,
  Webex: /Webex|Cisco Webex/i,
  Skype: /^Skype$/i,
};

const IGNORED_PROCESS_NAMES = new Set(["com.apple.FaceTime.FTConversationService"]);

export function getProcessName(processEntry: string): string {
  const trimmed = processEntry.trim();

  if (!trimmed) {
    return "";
  }

  const parts = trimmed.split("/");
  return parts.at(-1) ?? trimmed;
}

export function detectCallFromProcess(processEntry: string): { appName: string } | null {
  const processName = getProcessName(processEntry);

  if (!processName || IGNORED_PROCESS_NAMES.has(processName)) {
    return null;
  }

  for (const [appName, pattern] of Object.entries(CALL_APP_PATTERNS)) {
    if (pattern.test(processName)) {
      return { appName };
    }
  }

  return null;
}
