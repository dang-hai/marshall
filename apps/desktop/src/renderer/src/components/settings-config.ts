import { Bot, CalendarDays, Mic, Plug, Shield, UserRound, type LucideIcon } from "lucide-react";

export const fallbackUser = {
  name: "Guest",
  email: "guest@marshall.local",
  status: "Signed in placeholder",
};

export const SETTINGS_SECTIONS = {
  account: {
    label: fallbackUser.name,
    description: "Current user placeholder",
    icon: UserRound,
  },
  audio: {
    label: "Audio",
    description: "Transcription provider and settings",
    icon: Mic,
  },
  calendar: {
    label: "Calendar",
    description: "Google Calendar connection",
    icon: CalendarDays,
  },
  integrations: {
    label: "Integrations",
    description: "Connect external services",
    icon: Plug,
  },
  permissions: {
    label: "Permissions",
    description: "Microphone and screen recording",
    icon: Shield,
  },
  monitor: {
    label: "Monitor Agent",
    description: "Choose the AI agent for call monitoring",
    icon: Bot,
  },
} as const satisfies Record<
  string,
  {
    description: string;
    icon: LucideIcon;
    label: string;
  }
>;

export type SettingsSectionId = keyof typeof SETTINGS_SECTIONS;

export const settingsSidebarItems = (
  Object.entries(SETTINGS_SECTIONS) as Array<
    [SettingsSectionId, (typeof SETTINGS_SECTIONS)[SettingsSectionId]]
  >
).map(([id, section]) => ({
  id,
  ...section,
}));
