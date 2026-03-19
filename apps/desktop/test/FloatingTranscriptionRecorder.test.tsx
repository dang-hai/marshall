import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  FloatingTranscriptionRecorderView,
  resolveRecorderModel,
  type FloatingTranscriptionRecorderViewProps,
} from "../src/renderer/src/components/FloatingTranscriptionRecorder";

const baseProps: FloatingTranscriptionRecorderViewProps = {
  downloadProgressPercent: 0,
  error: null,
  isBootstrapping: false,
  isDownloadingModel: false,
  isExpanded: false,
  isModelDialogOpen: false,
  isRecording: false,
  isTranscribing: false,
  onClose: () => {},
  onDismissModelDialog: () => {},
  onDownloadModel: () => {},
  onOpen: () => {},
  onOpenSettings: () => {},
  onRecordAgain: () => {},
  onStopRecording: () => {},
  partialText: "",
  progress: 0,
  resolvedModel: {
    model: {
      downloaded: true,
      name: "large-v3-turbo",
      path: "/tmp/ggml-large-v3-turbo.bin",
      size: "~1.5 GB",
    },
    selectedModelName: "large-v3-turbo",
    usingFallback: false,
  },
  selectedModelSize: "~1.5 GB",
  transcript: null,
};

describe("floating transcription recorder", () => {
  test("renders a closed floating round button with the recorder label", () => {
    const markup = renderToStaticMarkup(<FloatingTranscriptionRecorderView {...baseProps} />);

    expect(markup).toContain('aria-label="Open recorder"');
    expect(markup).toContain('data-state="closed"');
  });

  test("renders live transcription content while recording", () => {
    const markup = renderToStaticMarkup(
      <FloatingTranscriptionRecorderView
        {...baseProps}
        isExpanded
        isRecording
        partialText="Marshall is writing this down in real time."
      />
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain("animate-soundwave");
    expect(markup).toContain("Marshall is writing this down in real time.");
    expect(markup).toContain('aria-label="Stop recording"');
  });

  test("renders the completed transcript with a record-again action", () => {
    const markup = renderToStaticMarkup(
      <FloatingTranscriptionRecorderView
        {...baseProps}
        isExpanded
        transcript={{
          duration: 21.3,
          language: "en",
          segments: [],
          text: "Final transcript from the completed Whisper pass.",
        }}
      />
    );

    expect(markup).toContain("Final transcript from the completed Whisper pass.");
    expect(markup).toContain("Record again");
  });

  test("renders the model download dialog when no Whisper model is available", () => {
    const markup = renderToStaticMarkup(
      <FloatingTranscriptionRecorderView
        {...baseProps}
        isExpanded
        isModelDialogOpen
        resolvedModel={{
          model: null,
          selectedModelName: "tiny.en",
          usingFallback: false,
        }}
        selectedModelSize="~75 MB"
      />
    );

    expect(markup).toContain("Download Required");
    expect(markup).toContain("tiny.en");
    expect(markup).toContain("Download");
  });
});

describe("resolveRecorderModel", () => {
  test("prefers the selected downloaded model and falls back to another downloaded model", () => {
    const selectedResult = resolveRecorderModel(
      [
        { downloaded: true, name: "tiny.en", path: "/tmp/tiny.bin", size: "~75 MB" },
        { downloaded: true, name: "large-v3-turbo", path: "/tmp/large.bin", size: "~1.5 GB" },
      ],
      "large-v3-turbo"
    );

    expect(selectedResult.model?.name).toBe("large-v3-turbo");
    expect(selectedResult.usingFallback).toBe(false);

    const fallbackResult = resolveRecorderModel(
      [
        { downloaded: true, name: "tiny.en", path: "/tmp/tiny.bin", size: "~75 MB" },
        { downloaded: false, name: "large-v3-turbo", path: "/tmp/large.bin", size: "~1.5 GB" },
      ],
      "large-v3-turbo"
    );

    expect(fallbackResult.model?.name).toBe("tiny.en");
    expect(fallbackResult.usingFallback).toBe(true);
  });
});
