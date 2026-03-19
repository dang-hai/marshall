import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CodexMonitorDebugPanel } from "../src/renderer/src/components/CodexMonitorDebugPanel";

describe("CodexMonitorDebugPanel", () => {
  test("renders monitor telemetry for the active note", () => {
    const markup = renderToStaticMarkup(
      <CodexMonitorDebugPanel
        noteId="note-1"
        transcription={null}
        state={{
          status: "monitoring",
          noteId: "note-1",
          noteTitle: "Roadmap sync",
          nudge: null,
          followUps: [],
          summary: null,
          lastAnalyzedAt: new Date().toISOString(),
          error: null,
          debug: {
            transcriptionStatus: "recording",
            transcriptLength: 812,
            checklistItemCount: 3,
            sessionUpdatedAt: new Date().toISOString(),
            pendingAnalysis: true,
            analysisInFlight: false,
            analysisCount: 2,
            lastMode: "live",
            lastStartedAt: new Date().toISOString(),
            lastCompletedAt: new Date().toISOString(),
            lastOutcome: "Codex returned no nudge",
            lastPromptPreview: "prompt preview",
            lastResponsePreview: "response preview",
          },
        }}
      />
    );

    expect(markup).toContain("Codex Debug");
    expect(markup).toContain("Transcript chars");
    expect(markup).toContain("812");
    expect(markup).toContain("Codex returned no nudge");
    expect(markup).toContain("prompt preview");
  });
});
