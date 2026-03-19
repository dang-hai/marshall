export const DESKTOP_NAVIGATION_ROUTES = {
  home: "/",
  settings: "/settings",
  settingsAudio: "/settings/audio",
} as const;

export type DesktopNavigationRoute =
  (typeof DESKTOP_NAVIGATION_ROUTES)[keyof typeof DESKTOP_NAVIGATION_ROUTES];
