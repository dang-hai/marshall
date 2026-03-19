import { useEffect, useState } from "react";
import type { CodexMonitorState } from "@marshall/shared";
import { X, Sparkles, CircleAlert } from "lucide-react";

export interface CodexNotificationWindowViewProps {
  state: CodexMonitorState;
  onDismiss: () => void;
}

function priorityLabel(priority: NonNullable<CodexMonitorState["nudge"]>["priority"]) {
  switch (priority) {
    case "high":
      return "Urgent";
    case "medium":
      return "Heads-up";
    default:
      return "Light nudge";
  }
}

export function CodexNotificationWindowView({
  state,
  onDismiss,
}: CodexNotificationWindowViewProps) {
  const nudge = state.nudge;

  return (
    <div className="min-h-screen bg-transparent p-3 text-stone-900">
      <div className="app-no-drag overflow-hidden rounded-[1.75rem] border border-stone-200/80 bg-stone-50/95 shadow-[0_24px_60px_-24px_rgba(41,37,36,0.5)] backdrop-blur-xl">
        <div className="flex items-start justify-between gap-4 border-b border-stone-200/70 px-4 py-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">
              Marshall
            </p>
            <p className="mt-1 font-serif text-lg leading-tight text-stone-900">
              Live call guidance
            </p>
            {state.noteTitle && <p className="mt-1 text-xs text-stone-500">{state.noteTitle}</p>}
          </div>

          <button
            type="button"
            aria-label="Dismiss guidance window"
            className="rounded-full p-1.5 text-stone-400 transition-colors hover:bg-stone-200/70 hover:text-stone-700"
            onClick={onDismiss}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-4 py-4">
          {state.error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700">
              <div className="flex items-center gap-2 font-medium">
                <CircleAlert className="h-4 w-4" />
                <span>Codex monitor paused</span>
              </div>
              <p className="mt-2 text-rose-600">{state.error}</p>
            </div>
          )}

          {nudge && (
            <div className="rounded-2xl bg-stone-900 px-4 py-4 text-stone-50">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-300">
                <Sparkles className="h-3.5 w-3.5" />
                <span>{priorityLabel(nudge.priority)}</span>
              </div>
              <p className="mt-3 font-serif text-xl leading-tight">{nudge.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-stone-200">{nudge.body}</p>
              {nudge.suggestedPhrase && (
                <div className="mt-3 rounded-xl bg-white/10 px-3 py-3 text-sm text-stone-100">
                  "{nudge.suggestedPhrase}"
                </div>
              )}
            </div>
          )}

          {state.followUps.length > 0 && (
            <div className="rounded-2xl border border-stone-200 bg-white/70 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500">
                Follow-up
              </p>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-stone-700">
                {state.followUps.slice(0, 4).map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-stone-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {state.summary && (
            <div className="rounded-2xl border border-stone-200 bg-stone-100/80 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500">
                Summary
              </p>
              <p className="mt-3 text-sm leading-relaxed text-stone-700">{state.summary}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const defaultState: CodexMonitorState = {
  status: "idle",
  noteId: null,
  noteTitle: null,
  nudge: null,
  followUps: [],
  summary: null,
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
};

export function CodexNotificationWindow() {
  const [state, setState] = useState<CodexMonitorState>(defaultState);

  useEffect(() => {
    let mounted = true;

    window.codexMonitorAPI
      ?.getState()
      .then((nextState) => {
        if (mounted) {
          setState(nextState);
        }
      })
      .catch(() => {
        // Ignore initial load failures in the overlay window.
      });

    const cleanup = window.codexMonitorAPI?.onState((nextState) => {
      setState(nextState);
    });

    return () => {
      mounted = false;
      cleanup?.();
    };
  }, []);

  return (
    <CodexNotificationWindowView
      state={state}
      onDismiss={() => {
        void window.codexMonitorAPI?.dismissWindow();
      }}
    />
  );
}
