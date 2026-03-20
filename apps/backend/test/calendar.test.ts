import { describe, expect, test } from "bun:test";
import {
  GOOGLE_CALENDAR_READONLY_SCOPE,
  hasGoogleCalendarAccess,
  parseGoogleCalendarScopes,
  serializeGoogleCalendarEvent,
} from "../src/calendar";

describe("google calendar helpers", () => {
  test("detects when calendar access is available", () => {
    const scopes = parseGoogleCalendarScopes(`openid,email,${GOOGLE_CALENDAR_READONLY_SCOPE}`);

    expect(hasGoogleCalendarAccess(scopes)).toBe(true);
  });

  test("serializes timed Google Calendar events", () => {
    expect(
      serializeGoogleCalendarEvent({
        id: "event-1",
        summary: "Weekly sync",
        start: { dateTime: "2026-03-21T09:00:00.000Z" },
        end: { dateTime: "2026-03-21T09:30:00.000Z" },
        location: "Google Meet",
        htmlLink: "https://calendar.google.com/event?eid=1",
        status: "confirmed",
      })
    ).toEqual({
      id: "event-1",
      title: "Weekly sync",
      startAt: "2026-03-21T09:00:00.000Z",
      endAt: "2026-03-21T09:30:00.000Z",
      isAllDay: false,
      location: "Google Meet",
      htmlLink: "https://calendar.google.com/event?eid=1",
      status: "confirmed",
    });
  });

  test("drops malformed events without a start time", () => {
    expect(
      serializeGoogleCalendarEvent({
        id: "event-2",
        summary: "Broken event",
      })
    ).toBeNull();
  });
});
