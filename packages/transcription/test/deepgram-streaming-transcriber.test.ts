import { describe, expect, it } from "bun:test";
import {
  buildSpeakerSegments,
  formatSpeakerTranscript,
} from "../src/deepgram-streaming-transcriber";

describe("deepgram speaker formatting", () => {
  it("groups consecutive words by speaker", () => {
    expect(
      buildSpeakerSegments([
        { word: "Hello", start: 0, end: 0.2, confidence: 0.9, speaker: 0 },
        { word: "there.", start: 0.2, end: 0.4, confidence: 0.9, speaker: 0 },
        { word: "Hi!", start: 0.5, end: 0.7, confidence: 0.9, speaker: 1 },
      ])
    ).toEqual([
      { start: 0, end: 0.4, text: "Hello there.", speaker: "Speaker 1" },
      { start: 0.5, end: 0.7, text: "Hi!", speaker: "Speaker 2" },
    ]);
  });

  it("formats speaker-attributed transcript text as separate lines", () => {
    expect(
      formatSpeakerTranscript([
        { start: 0, end: 0.4, text: "Hello there.", speaker: "Speaker 1" },
        { start: 0.5, end: 0.7, text: "Hi!", speaker: "Speaker 2" },
      ])
    ).toBe("Speaker 1: Hello there.\nSpeaker 2: Hi!");
  });
});
