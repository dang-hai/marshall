import type { GoogleCalendarEvent } from "@marshall/shared";

export const GOOGLE_CALENDAR_PROVIDER_ID = "google";
export const GOOGLE_CALENDAR_READONLY_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

const GOOGLE_CALENDAR_ACCESS_SCOPES = new Set([
  GOOGLE_CALENDAR_READONLY_SCOPE,
  "https://www.googleapis.com/auth/calendar",
]);

interface GoogleCalendarApiEventDateTime {
  date?: string;
  dateTime?: string;
}

interface GoogleCalendarApiEvent {
  id?: string;
  summary?: string;
  status?: string;
  htmlLink?: string;
  location?: string;
  start?: GoogleCalendarApiEventDateTime;
  end?: GoogleCalendarApiEventDateTime;
}

export function parseGoogleCalendarScopes(scope: string | null | undefined) {
  return (scope ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function hasGoogleCalendarAccess(scopes: string[]) {
  return scopes.some((scope) => GOOGLE_CALENDAR_ACCESS_SCOPES.has(scope));
}

export function serializeGoogleCalendarEvent(
  event: GoogleCalendarApiEvent
): GoogleCalendarEvent | null {
  const startAt = event.start?.dateTime ?? event.start?.date;
  if (!event.id || !startAt) {
    return null;
  }

  return {
    id: event.id,
    title: event.summary?.trim() || "Untitled event",
    startAt,
    endAt: event.end?.dateTime ?? event.end?.date ?? null,
    isAllDay: !event.start?.dateTime,
    location: event.location ?? null,
    htmlLink: event.htmlLink ?? null,
    status: event.status ?? null,
  };
}
