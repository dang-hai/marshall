import { describe, expect, test } from "bun:test";
import { resolveTranscriptionTargetNoteId } from "../src/renderer/src/components/HomePanel";

describe("resolveTranscriptionTargetNoteId", () => {
  test("keeps the current note target when there is no active note selected", () => {
    expect(
      resolveTranscriptionTargetNoteId({
        activeNoteId: null,
        currentTargetNoteId: "note-a",
        sessionActive: true,
      })
    ).toBe("note-a");
  });

  test("sticks to the existing target while a transcription session is active", () => {
    expect(
      resolveTranscriptionTargetNoteId({
        activeNoteId: "note-b",
        currentTargetNoteId: "note-a",
        sessionActive: true,
      })
    ).toBe("note-a");
  });

  test("follows the newly opened note once the session is idle", () => {
    expect(
      resolveTranscriptionTargetNoteId({
        activeNoteId: "note-b",
        currentTargetNoteId: "note-a",
        sessionActive: false,
      })
    ).toBe("note-b");
  });
});
