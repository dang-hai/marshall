import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CodexNotificationWindowView } from "../src/renderer/src/components/CodexNotificationWindow";

describe("CodexNotificationWindowView", () => {
  test("renders the active nudge, follow-ups, and final summary", () => {
    const markup = renderToStaticMarkup(
      <CodexNotificationWindowView
        state={{
          status: "monitoring",
          noteId: "note-1",
          noteTitle: "Launch review",
          nudge: {
            id: "nudge-1",
            title: "Close the owner gap",
            body: "Ask who owns the launch checklist before the call drifts.",
            priority: "high",
            suggestedPhrase: "Before we move on, who owns the launch checklist?",
            createdAt: new Date().toISOString(),
          },
          followUps: ["Share the revised timeline with legal."],
          summary: "The team aligned on ownership and queued a legal follow-up.",
          lastAnalyzedAt: new Date().toISOString(),
          error: null,
          debug: {
            transcriptionStatus: "recording",
            transcriptLength: 420,
            checklistItemCount: 2,
            sessionUpdatedAt: new Date().toISOString(),
            pendingAnalysis: false,
            analysisInFlight: false,
            analysisCount: 1,
            lastMode: "live",
            lastStartedAt: new Date().toISOString(),
            lastCompletedAt: new Date().toISOString(),
            lastOutcome: "Codex returned a nudge",
            lastPromptPreview: "prompt preview",
            lastResponsePreview: "response preview",
          },
        }}
        onDismiss={() => {}}
      />
    );

    expect(markup).toContain("Live call guidance");
    expect(markup).toContain("Close the owner gap");
    expect(markup).toContain("Before we move on, who owns the launch checklist?");
    expect(markup).toContain("Share the revised timeline with legal.");
    expect(markup).toContain("The team aligned on ownership and queued a legal follow-up.");
  });
});
