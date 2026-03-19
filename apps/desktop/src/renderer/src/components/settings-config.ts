import { CalendarDays, Mic, Shield, UserRound, type LucideIcon } from "lucide-react";

export const fallbackUser = {
  name: "Hai Dang",
  email: "hai.dang@marshall.local",
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
    description: "Visible calendars and display",
    icon: CalendarDays,
  },
  permissions: {
    label: "Permissions",
    description: "Microphone and screen recording",
    icon: Shield,
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
