import { useState, useCallback, KeyboardEvent, useRef, useEffect, useMemo } from "react";
import { ArrowUp, Clock, Loader2, X } from "lucide-react";
import { Button } from "./ui/button";

interface PlanMeetingModalProps {
  onClose: () => void;
  onPlanGenerated: (plan: string, title: string) => void;
}

const DURATION_OPTIONS = [
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "45 min", value: 45 },
  { label: "60 min", value: 60 },
];

const SYSTEM_PROMPT = `You are a meeting planning assistant. Your task is to create a concise, actionable meeting structure based on the user's goals and guardrails.

Output format:
- Start with a brief 1-sentence purpose statement
- List 3-5 key questions that MUST be answered during the call
- Add 2-3 checkpoint moments (e.g., "At 10 min: Check if we've covered X")
- End with a clear "Success = ..." statement

Keep the entire plan to ONE PAGE maximum. Be direct and practical. No fluff.`;

function buildPrompt(purpose: string, goalsAndGuardrails: string, duration: number): string {
  const parts = [];

  if (purpose) {
    parts.push(`Meeting Purpose: ${purpose}`);
  }

  parts.push(`Duration: ${duration} minutes`);
  parts.push(`\nGoals and Guardrails:\n${goalsAndGuardrails}`);

  return parts.join("\n");
}

export function PlanMeetingModal({ onClose, onPlanGenerated }: PlanMeetingModalProps) {
  const [purpose, setPurpose] = useState("");
  const [goalsAndGuardrails, setGoalsAndGuardrails] = useState("");
  const [duration, setDuration] = useState(30);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleGenerate = useCallback(async () => {
    const trimmedGoals = goalsAndGuardrails.trim();
    if (!trimmedGoals) {
      setError("Please describe the goals and guardrails for your meeting.");
      return;
    }

    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsGenerating(true);
    setError(null);

    try {
      const trimmedPurpose = purpose.trim();
      const prompt = buildPrompt(trimmedPurpose, trimmedGoals, duration);
      const { text } = await window.aiAPI.completion({
        prompt,
        system: SYSTEM_PROMPT,
      });

      onPlanGenerated(text, trimmedPurpose || "Meeting Plan");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate plan");
    } finally {
      setIsGenerating(false);
      isSubmittingRef.current = false;
    }
  }, [purpose, goalsAndGuardrails, duration, onPlanGenerated]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        handleGenerate();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    },
    [handleGenerate, onClose]
  );

  const canGenerate = useMemo(
    () => goalsAndGuardrails.trim().length > 0 && !isGenerating,
    [goalsAndGuardrails, isGenerating]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onKeyDown={handleKeyDown}>
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-xl border border-border/60 bg-card p-6 shadow-lifted">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-5">
          <h2 className="font-serif text-xl font-medium">Plan Meeting</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Describe your meeting goals to generate a focused structure.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Purpose (optional)
            </label>
            <input
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g., Q1 Planning Review"
              className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Goals & Guardrails
            </label>
            <textarea
              ref={textareaRef}
              value={goalsAndGuardrails}
              onChange={(e) => setGoalsAndGuardrails(e.target.value)}
              placeholder="What needs to be decided? What topics should we avoid? What's the ideal outcome?"
              rows={5}
              className="w-full resize-none rounded-lg border border-border/60 bg-background px-3 py-2 text-sm leading-relaxed outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              <Clock className="mr-1 inline-block h-3 w-3" />
              Duration
            </label>
            <div className="flex gap-2">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDuration(opt.value)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    duration === opt.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/60 bg-background text-muted-foreground hover:border-border hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
              {error}
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <p className="text-2xs text-muted-foreground/70">
            Press <kbd className="rounded bg-muted px-1 py-0.5 font-mono">Cmd+Enter</kbd> to
            generate
          </p>
          <Button onClick={handleGenerate} disabled={!canGenerate}>
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <ArrowUp className="mr-1 h-4 w-4" />
                Generate Plan
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
