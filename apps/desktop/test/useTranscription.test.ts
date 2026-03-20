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
      utterances: [
        {
          id: "utt-0",
          start: 0,
          end: 1.2,
          text: "Hello from the first take.",
          speaker: null,
        },
      ],
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
      utterances: [
        {
          id: "utt-0",
          start: 0,
          end: 1.2,
          text: "Hello from the first take.",
          speaker: null,
        },
      ],
      duration: 1.2,
    });
  });

  it("formats speaker-attributed segments when hydrating a saved snapshot", () => {
    const transcript = snapshotToTranscript({
      id: "tx_2",
      noteId: "note_1",
      status: "completed",
      provider: "deepgram",
      mode: "streaming",
      language: "en",
      model: null,
      transcriptText: "",
      finalText: "",
      interimText: "",
      segments: [
        { start: 0, end: 1.2, text: "Let us kick this off.", speaker: "Speaker 1" },
        { start: 1.2, end: 2.4, text: "I can take the follow up.", speaker: "Speaker 2" },
      ],
      utterances: [
        {
          id: "utt-1",
          start: 0,
          end: 1.2,
          text: "Let us kick this off.",
          speaker: "Speaker 1",
        },
        {
          id: "utt-2",
          start: 1.2,
          end: 2.4,
          text: "I can take the follow up.",
          speaker: "Speaker 2",
        },
      ],
      lastSegmentIndex: 1,
      durationSeconds: 2.4,
      recordingDurationSeconds: 2.4,
      error: null,
      startedAt: "2026-03-19T10:00:00.000Z",
      completedAt: "2026-03-19T10:00:03.000Z",
      lastPartialAt: "2026-03-19T10:00:02.000Z",
      createdAt: "2026-03-19T10:00:00.000Z",
      updatedAt: "2026-03-19T10:00:03.000Z",
    });

    expect(transcript).toEqual({
      text: "Speaker 1: Let us kick this off.\nSpeaker 2: I can take the follow up.",
      language: "en",
      segments: [
        { start: 0, end: 1.2, text: "Let us kick this off.", speaker: "Speaker 1" },
        { start: 1.2, end: 2.4, text: "I can take the follow up.", speaker: "Speaker 2" },
      ],
      utterances: [
        {
          id: "utt-1",
          start: 0,
          end: 1.2,
          text: "Let us kick this off.",
          speaker: "Speaker 1",
        },
        {
          id: "utt-2",
          start: 1.2,
          end: 2.4,
          text: "I can take the follow up.",
          speaker: "Speaker 2",
        },
      ],
      duration: 2.4,
    });
  });

  it("merges a resumed recording onto the existing transcript", () => {
    const base: TranscriptionResult = {
      text: "Hello from the first take.",
      language: "en",
      segments: [{ start: 0, end: 1.2, text: "Hello from the first take." }],
      utterances: [
        {
          id: "utt-base",
          start: 0,
          end: 1.2,
          text: "Hello from the first take.",
          speaker: null,
        },
      ],
      duration: 1.2,
    };
    const resumed: TranscriptionResult = {
      text: "And this is the follow up.",
      language: "en",
      segments: [{ start: 0, end: 0.8, text: "And this is the follow up." }],
      utterances: [
        {
          id: "utt-resumed",
          start: 0,
          end: 0.8,
          text: "And this is the follow up.",
          speaker: null,
        },
      ],
      duration: 0.8,
    };

    expect(mergeTranscriptionResults(base, resumed)).toEqual({
      text: "Hello from the first take. And this is the follow up.",
      language: "en",
      segments: [
        { start: 0, end: 1.2, text: "Hello from the first take." },
        { start: 1.2, end: 2, text: "And this is the follow up." },
      ],
      utterances: [
        {
          id: "utt-base",
          start: 0,
          end: 1.2,
          text: "Hello from the first take.",
          speaker: null,
        },
        {
          id: "utt-resumed",
          start: 1.2,
          end: 2,
          text: "And this is the follow up.",
          speaker: null,
        },
      ],
      duration: 2,
    });
  });

  it("preserves speaker labels when merging a resumed recording", () => {
    const base: TranscriptionResult = {
      text: "Speaker 1: Hello from the first take.",
      language: "en",
      segments: [{ start: 0, end: 1.2, text: "Hello from the first take.", speaker: "Speaker 1" }],
      utterances: [
        {
          id: "utt-speaker-1",
          start: 0,
          end: 1.2,
          text: "Hello from the first take.",
          speaker: "Speaker 1",
        },
      ],
      duration: 1.2,
    };
    const resumed: TranscriptionResult = {
      text: "Speaker 2: And this is the follow up.",
      language: "en",
      segments: [{ start: 0, end: 0.8, text: "And this is the follow up.", speaker: "Speaker 2" }],
      utterances: [
        {
          id: "utt-speaker-2",
          start: 0,
          end: 0.8,
          text: "And this is the follow up.",
          speaker: "Speaker 2",
        },
      ],
      duration: 0.8,
    };

    expect(mergeTranscriptionResults(base, resumed)).toEqual({
      text: "Speaker 1: Hello from the first take.\nSpeaker 2: And this is the follow up.",
      language: "en",
      segments: [
        { start: 0, end: 1.2, text: "Hello from the first take.", speaker: "Speaker 1" },
        { start: 1.2, end: 2, text: "And this is the follow up.", speaker: "Speaker 2" },
      ],
      utterances: [
        {
          id: "utt-speaker-1",
          start: 0,
          end: 1.2,
          text: "Hello from the first take.",
          speaker: "Speaker 1",
        },
        {
          id: "utt-speaker-2",
          start: 1.2,
          end: 2,
          text: "And this is the follow up.",
          speaker: "Speaker 2",
        },
      ],
      duration: 2,
    });
  });
});
