import { useEffect, useState } from "react";
import type { CodexMonitorState, CodexMonitorItem } from "@marshall/shared";
import { X, AlertCircle, Check, Circle, AlertTriangle } from "lucide-react";

export interface CodexNotificationWindowViewProps {
  state: CodexMonitorState;
  onDismiss: () => void;
}

function ItemIcon({ status }: { status: CodexMonitorItem["status"] }) {
  switch (status) {
    case "done":
      return <Check className="h-3.5 w-3.5 text-emerald-500" />;
    case "attention":
      return <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />;
    default:
      return <Circle className="h-3 w-3 text-zinc-500" />;
  }
}

function itemStyles(status: CodexMonitorItem["status"]) {
  switch (status) {
    case "done":
      return "text-zinc-500 line-through";
    case "attention":
      return "text-amber-200";
    default:
      return "text-zinc-200";
  }
}

export function CodexNotificationWindowView({
  state,
  onDismiss,
}: CodexNotificationWindowViewProps) {
  const { nudge, items, error, summary } = state;
  const hasContent = error || nudge || items.length > 0 || summary;

  if (!hasContent) {
    return null;
  }

  // Sort items: attention first, then pending, then done
  const sortedItems = [...items].sort((a, b) => {
    const order = { attention: 0, pending: 1, done: 2 };
    return order[a.status] - order[b.status];
  });

  const pendingCount = items.filter((i) => i.status !== "done").length;

  return (
    <div className="min-h-screen bg-transparent p-3">
      <div className="app-no-drag overflow-hidden rounded-lg bg-neutral-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-zinc-200">
              {state.noteTitle ?? "Marshall"}
            </span>
            {pendingCount > 0 && (
              <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-400">
                {pendingCount}
              </span>
            )}
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            className="rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
            onClick={onDismiss}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Error state */}
        {error && (
          <div className="flex items-start gap-2.5 border-b border-zinc-800 bg-red-950/30 px-4 py-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Checklist - stable, status-tracked items */}
        {sortedItems.length > 0 && (
          <div className="border-b border-zinc-800 px-4 py-3">
            <ul className="space-y-2">
              {sortedItems.map((item) => (
                <li
                  key={item.id}
                  className={`flex items-start gap-2.5 text-sm transition-opacity ${itemStyles(item.status)}`}
                >
                  <span className="mt-0.5 shrink-0">
                    <ItemIcon status={item.status} />
                  </span>
                  <span className="leading-snug">{item.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Live nudge - ephemeral, in-the-moment guidance */}
        {nudge && (
          <div className="bg-zinc-800/50 px-4 py-3">
            <p className="text-sm leading-snug text-zinc-100">{nudge.text}</p>
            {nudge.suggestedPhrase && (
              <p className="mt-2 text-sm italic text-zinc-400">"{nudge.suggestedPhrase}"</p>
            )}
          </div>
        )}

        {/* Summary - only shown at end of call */}
        {summary && !nudge && (
          <div className="bg-zinc-800/30 px-4 py-3">
            <p className="text-sm leading-relaxed text-zinc-400">{summary}</p>
          </div>
        )}
      </div>
    </div>
  );
}

const defaultState: CodexMonitorState = {
  status: "idle",
  noteId: null,
  noteTitle: null,
  nudge: null,
  items: [],
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

  // Make the window chrome transparent for this overlay
  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    return () => {
      document.documentElement.style.background = "";
      document.body.style.background = "";
    };
  }, []);

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
