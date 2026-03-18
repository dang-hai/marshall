export const DESKTOP_NAVIGATION_ROUTES = {
  home: "/",
  settings: "/settings",
} as const;

export type DesktopNavigationRoute =
  (typeof DESKTOP_NAVIGATION_ROUTES)[keyof typeof DESKTOP_NAVIGATION_ROUTES];
