import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AIAgentNotificationWindowView } from "../src/renderer/src/components/AIAgentNotificationWindow";

describe("AIAgentNotificationWindowView", () => {
  test("renders items with different statuses and the active nudge", () => {
    const markup = renderToStaticMarkup(
      <AIAgentNotificationWindowView
        state={{
          status: "monitoring",
          noteId: "note-1",
          noteTitle: "Launch review",
          nudge: {
            id: "nudge-1",
            text: "Ask who owns the launch checklist",
            suggestedPhrase: "Before we move on, who owns the launch checklist?",
            createdAt: new Date().toISOString(),
          },
          items: [
            {
              id: "item-1",
              text: "Confirm timeline with stakeholders",
              status: "done",
              addedAt: new Date().toISOString(),
            },
            {
              id: "item-2",
              text: "Share the revised timeline with legal",
              status: "pending",
              addedAt: new Date().toISOString(),
            },
            {
              id: "item-3",
              text: "Discuss launch blockers",
              status: "attention",
              addedAt: new Date().toISOString(),
            },
          ],
          summary: null,
          chatMessages: [],
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
            lastOutcome: "Agent returned a nudge",
            lastPromptPreview: "prompt preview",
            lastResponsePreview: "response preview",
          },
        }}
        meetingProposals={[]}
        onDismiss={() => {}}
        onSendChat={() => {}}
      />
    );

    // Header
    expect(markup).toContain("Launch review");

    // Nudge
    expect(markup).toContain("Ask who owns the launch checklist");
    expect(markup).toContain("Before we move on, who owns the launch checklist?");

    // Items
    expect(markup).toContain("Confirm timeline with stakeholders");
    expect(markup).toContain("Share the revised timeline with legal");
    expect(markup).toContain("Discuss launch blockers");
  });

  test("renders summary when call ends", () => {
    const markup = renderToStaticMarkup(
      <AIAgentNotificationWindowView
        state={{
          status: "idle",
          noteId: "note-1",
          noteTitle: "Launch review",
          nudge: null,
          items: [
            {
              id: "item-1",
              text: "Share timeline with legal",
              status: "done",
              addedAt: new Date().toISOString(),
            },
          ],
          summary: "The team aligned on ownership and queued a legal follow-up.",
          chatMessages: [],
          lastAnalyzedAt: new Date().toISOString(),
          error: null,
          debug: {
            transcriptionStatus: "completed",
            transcriptLength: 1200,
            checklistItemCount: 2,
            sessionUpdatedAt: new Date().toISOString(),
            pendingAnalysis: false,
            analysisInFlight: false,
            analysisCount: 3,
            lastMode: "final",
            lastStartedAt: new Date().toISOString(),
            lastCompletedAt: new Date().toISOString(),
            lastOutcome: "Agent returned the final summary",
            lastPromptPreview: "prompt preview",
            lastResponsePreview: "response preview",
          },
        }}
        meetingProposals={[]}
        onDismiss={() => {}}
        onSendChat={() => {}}
      />
    );

    expect(markup).toContain("The team aligned on ownership and queued a legal follow-up.");
  });

  test("renders empty state when no content to show", () => {
    const markup = renderToStaticMarkup(
      <AIAgentNotificationWindowView
        state={{
          status: "idle",
          noteId: null,
          noteTitle: null,
          nudge: null,
          items: [],
          summary: null,
          chatMessages: [],
          lastAnalyzedAt: null,
          error: null,
          debug: {
            transcriptionStatus: null,
            transcriptLength: 0,
            checklistItemCount: 0,
            sessionUpdatedAt: null,
            pendingAnalysis: false,
            analysisInFlight: false,
            analysisCount: 0,
            lastMode: null,
            lastStartedAt: null,
            lastCompletedAt: null,
            lastOutcome: null,
            lastPromptPreview: null,
            lastResponsePreview: null,
          },
        }}
        meetingProposals={[]}
        onDismiss={() => {}}
        onSendChat={() => {}}
      />
    );

    expect(markup).toContain("Marshall is ready to help");
    expect(markup).toContain("Start a recording to get live assistance");
  });
});
