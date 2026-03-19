import { describe, expect, it } from "bun:test";
import { getTableColumns } from "drizzle-orm";
import {
  NOTE_TRANSCRIPTION_MODES,
  NOTE_TRANSCRIPTION_PROVIDERS,
  NOTE_TRANSCRIPTION_STATUSES,
  note,
  noteTranscription,
} from "../src/schema";

describe("database schema", () => {
  it("defines notes as user-owned documents", () => {
    const columns = getTableColumns(note);

    expect(Object.keys(columns)).toEqual([
      "id",
      "userId",
      "title",
      "body",
      "createdAt",
      "updatedAt",
      "trashedAt",
    ]);
  });

  it("defines note transcription snapshots for resume support", () => {
    const columns = getTableColumns(noteTranscription);

    expect(Object.keys(columns)).toEqual([
      "id",
      "noteId",
      "status",
      "provider",
      "mode",
      "language",
      "model",
      "transcriptText",
      "finalText",
      "interimText",
      "segments",
      "lastSegmentIndex",
      "durationSeconds",
      "recordingDurationSeconds",
      "error",
      "startedAt",
      "completedAt",
      "lastPartialAt",
      "createdAt",
      "updatedAt",
    ]);

    expect(NOTE_TRANSCRIPTION_STATUSES).toContain("recording");
    expect(NOTE_TRANSCRIPTION_STATUSES).toContain("completed");
    expect(NOTE_TRANSCRIPTION_PROVIDERS).toContain("deepgram");
    expect(NOTE_TRANSCRIPTION_MODES).toContain("streaming");
  });
});
