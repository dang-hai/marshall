import { describe, expect, it } from "bun:test";
import {
  mergeTranscriptionResults,
  snapshotToTranscript,
  type TranscriptionResult,
} from "../src/renderer/src/hooks/useTranscription";

describe("useTranscription helpers", () => {
  it("hydrates a saved snapshot into a transcript result", () => {
    const transcript = snapshotToTranscript({
      id: "tx_1",
      noteId: "note_1",
      status: "completed",
      provider: "local",
      mode: "streaming",
      language: "en",
      model: "base.en",
      transcriptText: "Hello from the first take.",
      finalText: "Hello from the first take.",
      interimText: "",
      segments: [{ start: 0, end: 1.2, text: "Hello from the first take." }],
      lastSegmentIndex: 0,
      durationSeconds: 1.2,
      recordingDurationSeconds: 1.2,
      error: null,
      startedAt: "2026-03-19T10:00:00.000Z",
      completedAt: "2026-03-19T10:00:02.000Z",
      lastPartialAt: "2026-03-19T10:00:01.000Z",
      createdAt: "2026-03-19T10:00:00.000Z",
      updatedAt: "2026-03-19T10:00:02.000Z",
    });

    expect(transcript).toEqual({
      text: "Hello from the first take.",
      language: "en",
      segments: [{ start: 0, end: 1.2, text: "Hello from the first take." }],
      duration: 1.2,
    });
  });

  it("merges a resumed recording onto the existing transcript", () => {
    const base: TranscriptionResult = {
      text: "Hello from the first take.",
      language: "en",
      segments: [{ start: 0, end: 1.2, text: "Hello from the first take." }],
      duration: 1.2,
    };
    const resumed: TranscriptionResult = {
      text: "And this is the follow up.",
      language: "en",
      segments: [{ start: 0, end: 0.8, text: "And this is the follow up." }],
      duration: 0.8,
    };

    expect(mergeTranscriptionResults(base, resumed)).toEqual({
      text: "Hello from the first take. And this is the follow up.",
      language: "en",
      segments: [
        { start: 0, end: 1.2, text: "Hello from the first take." },
        { start: 1.2, end: 2, text: "And this is the follow up." },
      ],
      duration: 2,
    });
  });
});
