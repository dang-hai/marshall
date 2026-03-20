export const DESKTOP_NAVIGATION_ROUTES = {
  home: "/",
  settings: "/settings",
  settingsAudio: "/settings/audio",
  settingsCalendar: "/settings/calendar",
} as const;

export type DesktopNavigationRoute =
  (typeof DESKTOP_NAVIGATION_ROUTES)[keyof typeof DESKTOP_NAVIGATION_ROUTES];
