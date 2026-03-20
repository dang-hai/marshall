import type { CodexMonitorState, NoteTranscriptionSnapshot } from "@marshall/shared";

interface CodexMonitorDebugPanelProps {
  state: CodexMonitorState;
  noteId: string;
  transcription: NoteTranscriptionSnapshot | null;
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return "Not yet";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString();
}

function row(label: string, value: string | number | null | boolean) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-stone-500">{label}</dt>
      <dd className="max-w-[60%] break-words text-right text-stone-800">{String(value)}</dd>
    </div>
  );
}

export function CodexMonitorDebugPanel({
  state,
  noteId,
  transcription,
}: CodexMonitorDebugPanelProps) {
  const isForActiveNote = state.noteId === noteId;
  const debug = state.debug;

  return (
    <section className="mt-6 rounded-2xl border border-amber-200/80 bg-amber-50/80 px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-700">
            Codex Debug
          </p>
          <p className="mt-1 text-sm text-stone-700">
            Inspect what the live monitor sees and whether it is actually running analyses.
          </p>
        </div>
        <div className="rounded-full border border-amber-300/80 bg-white/80 px-3 py-1 text-xs font-medium text-amber-800">
          {isForActiveNote ? state.status : "idle"}
        </div>
      </div>

      <dl className="mt-4 space-y-2 text-xs">
        {row("Active note wired", isForActiveNote)}
        {row("Transcription status", debug.transcriptionStatus ?? transcription?.status ?? "none")}
        {row("Transcript chars", debug.transcriptLength)}
        {row("Checklist items", debug.checklistItemCount)}
        {row("Pending analysis", debug.pendingAnalysis)}
        {row("Analysis in flight", debug.analysisInFlight)}
        {row("Analysis count", debug.analysisCount)}
        {row("Last mode", debug.lastMode ?? "none")}
        {row("Session updated", formatTimestamp(debug.sessionUpdatedAt))}
        {row("Last started", formatTimestamp(debug.lastStartedAt))}
        {row("Last completed", formatTimestamp(debug.lastCompletedAt))}
        {row("Last analyzed", formatTimestamp(state.lastAnalyzedAt))}
      </dl>

      <div className="mt-4 space-y-3">
        <div className="rounded-xl border border-amber-200 bg-white/80 px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
            Last outcome
          </p>
          <p className="mt-2 text-xs leading-relaxed text-stone-700">
            {state.error ?? debug.lastOutcome ?? "No analysis has completed yet."}
          </p>
        </div>

        {debug.lastResponsePreview && (
          <div className="rounded-xl border border-amber-200 bg-white/80 px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
              Last response preview
            </p>
            <pre className="mt-2 max-h-[28rem] overflow-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-stone-700">
              {debug.lastResponsePreview}
            </pre>
          </div>
        )}

        {debug.lastPromptPreview && (
          <div className="rounded-xl border border-amber-200 bg-white/80 px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
              Last prompt
            </p>
            <pre className="mt-2 max-h-[28rem] overflow-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-stone-700">
              {debug.lastPromptPreview}
            </pre>
          </div>
        )}
      </div>
    </section>
  );
}
