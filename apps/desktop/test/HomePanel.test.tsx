import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { GoogleCalendarEvent, NoteRecord } from "@marshall/shared";
import {
  formatUpcomingEventSchedule,
  getFloatingRecorderNote,
  getTranscriptionLaunchNote,
  UpcomingEventsPanel,
} from "../src/renderer/src/components/HomePanel";

function createNote(overrides: Partial<NoteRecord> = {}): NoteRecord {
  return {
    id: "note-1",
    userId: "user-1",
    title: "Note",
    body: "<p>Body</p>",
    createdAt: "2026-03-19T10:00:00.000Z",
    updatedAt: "2026-03-19T10:00:00.000Z",
    trashedAt: null,
    transcription: null,
    ...overrides,
  };
}

describe("getFloatingRecorderNote", () => {
  test("keeps the recorder attached to the active transcription note", () => {
    const recordingNote = createNote({
      id: "note-recording",
      updatedAt: "2026-03-19T10:05:00.000Z",
      transcription: {
        id: "tx-recording",
        noteId: "note-recording",
        status: "recording",
        provider: "local",
        mode: "streaming",
        language: "en",
        model: "base.en",
        transcriptText: "Live transcript",
        finalText: "",
        interimText: "Live transcript",
        segments: [],
        lastSegmentIndex: 0,
        durationSeconds: 3,
        recordingDurationSeconds: 3,
        error: null,
        startedAt: "2026-03-19T10:04:57.000Z",
        completedAt: null,
        lastPartialAt: "2026-03-19T10:05:00.000Z",
        createdAt: "2026-03-19T10:04:57.000Z",
        updatedAt: "2026-03-19T10:05:00.000Z",
      },
    });
    const selectedNote = createNote({
      id: "note-selected",
      title: "Selected note",
    });

    expect(getFloatingRecorderNote([recordingNote, selectedNote], "note-selected")?.id).toBe(
      "note-recording"
    );
  });

  test("falls back to the selected note when nothing is recording", () => {
    const selectedNote = createNote({
      id: "note-selected",
      title: "Selected note",
    });
    const otherNote = createNote({
      id: "note-other",
      title: "Other note",
      updatedAt: "2026-03-19T10:02:00.000Z",
    });

    expect(getFloatingRecorderNote([otherNote, selectedNote], "note-selected")?.id).toBe(
      "note-selected"
    );
  });

  test("ignores trashed notes even if they still carry an active snapshot", () => {
    const trashedRecordingNote = createNote({
      id: "note-trashed",
      trashedAt: "2026-03-19T10:06:00.000Z",
      transcription: {
        id: "tx-trashed",
        noteId: "note-trashed",
        status: "recording",
        provider: "local",
        mode: "streaming",
        language: "en",
        model: "base.en",
        transcriptText: "",
        finalText: "",
        interimText: "",
        segments: [],
        lastSegmentIndex: null,
        durationSeconds: 0,
        recordingDurationSeconds: 1,
        error: null,
        startedAt: "2026-03-19T10:05:59.000Z",
        completedAt: null,
        lastPartialAt: null,
        createdAt: "2026-03-19T10:05:59.000Z",
        updatedAt: "2026-03-19T10:06:00.000Z",
      },
    });
    const selectedNote = createNote({
      id: "note-selected",
      title: "Selected note",
    });

    expect(getFloatingRecorderNote([trashedRecordingNote, selectedNote], "note-selected")?.id).toBe(
      "note-selected"
    );
  });
});

describe("UpcomingEventsPanel", () => {
  test("renders a connect prompt when Google Calendar is not connected", () => {
    const markup = renderToStaticMarkup(
      <UpcomingEventsPanel
        events={[]}
        error={null}
        isLoading={false}
        onOpenSettings={() => {}}
        onRefresh={() => {}}
        status={{ connected: false, accountEmail: null, scopes: [] }}
      />
    );

    expect(markup).toContain("Connect Google Calendar");
  });

  test("renders the upcoming event list when events are available", () => {
    const events: GoogleCalendarEvent[] = [
      {
        id: "event-1",
        title: "Design review",
        startAt: "2026-03-21T09:00:00.000Z",
        endAt: "2026-03-21T09:30:00.000Z",
        isAllDay: false,
        location: "Google Meet",
        htmlLink: null,
        status: "confirmed",
      },
    ];

    const markup = renderToStaticMarkup(
      <UpcomingEventsPanel
        events={events}
        error={null}
        isLoading={false}
        onOpenSettings={() => {}}
        onRefresh={() => {}}
        status={{ connected: true, accountEmail: "marshall@example.com", scopes: [] }}
      />
    );

    expect(markup).toContain("Design review");
    expect(markup).toContain("Google Meet");
  });
});

describe("formatUpcomingEventSchedule", () => {
  test("formats timed events with the day and time range", () => {
    expect(
      formatUpcomingEventSchedule({
        id: "event-1",
        title: "Standup",
        startAt: "2026-03-21T09:00:00.000Z",
        endAt: "2026-03-21T09:15:00.000Z",
        isAllDay: false,
        location: null,
        htmlLink: null,
        status: "confirmed",
      })
    ).toContain("9:00");
  });

  test("formats all-day events without a time range", () => {
    expect(
      formatUpcomingEventSchedule({
        id: "event-2",
        title: "Offsite",
        startAt: "2026-03-22",
        endAt: "2026-03-23",
        isAllDay: true,
        location: null,
        htmlLink: null,
        status: "confirmed",
      })
    ).toContain("All day");
  });
});

describe("getTranscriptionLaunchNote", () => {
  test("prefers the in-progress transcription note when one exists", () => {
    const recordingNote = createNote({
      id: "note-recording",
      transcription: {
        id: "tx-recording",
        noteId: "note-recording",
        status: "recording",
        provider: "local",
        mode: "streaming",
        language: "en",
        model: "base.en",
        transcriptText: "Live transcript",
        finalText: "",
        interimText: "Live transcript",
        segments: [],
        lastSegmentIndex: 0,
        durationSeconds: 3,
        recordingDurationSeconds: 3,
        error: null,
        startedAt: "2026-03-19T10:04:57.000Z",
        completedAt: null,
        lastPartialAt: "2026-03-19T10:05:00.000Z",
        createdAt: "2026-03-19T10:04:57.000Z",
        updatedAt: "2026-03-19T10:05:00.000Z",
      },
    });
    const selectedNote = createNote({
      id: "note-selected",
    });

    expect(getTranscriptionLaunchNote([recordingNote, selectedNote], "note-selected")?.id).toBe(
      "note-recording"
    );
  });

  test("uses the active note when there is no active transcription session", () => {
    const selectedNote = createNote({
      id: "note-selected",
    });

    expect(getTranscriptionLaunchNote([selectedNote], "note-selected")?.id).toBe("note-selected");
  });

  test("returns null when there is no note to open", () => {
    expect(getTranscriptionLaunchNote([], null)).toBeNull();
  });
});
