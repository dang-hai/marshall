import { useState, useRef, useEffect, useReducer, KeyboardEvent } from "react";
import { Mic, X, Phone, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "../lib/utils";
import type { DetectedCall } from "../hooks/useCallDetection";

const APP_ICONS: Record<string, string> = {
  Zoom: "🎥",
  "Google Meet": "📹",
  "Microsoft Teams": "👥",
  Slack: "💬",
  Discord: "🎮",
  FaceTime: "📱",
  Webex: "🌐",
  Skype: "💠",
};

interface CallNotificationProps {
  call: DetectedCall;
  onDismiss: (callId: string) => void;
  onStartTranscription: () => void;
  onCreateNote: (title: string) => void;
}

export const CALL_NOTIFICATION_TIMEOUT_MS = 8_000;

export interface CallNotificationTimerState {
  remainingMs: number;
  hasStartedQuickNote: boolean;
  hasTimedOut: boolean;
  isHovered: boolean;
}

type CallNotificationTimerAction =
  | { type: "hover-start" }
  | { type: "hover-end" }
  | { type: "quick-note-start" }
  | { type: "tick"; elapsedMs: number };

export function createCallNotificationTimerState(
  timeoutMs: number = CALL_NOTIFICATION_TIMEOUT_MS
): CallNotificationTimerState {
  return {
    remainingMs: timeoutMs,
    hasStartedQuickNote: false,
    hasTimedOut: false,
    isHovered: false,
  };
}

export function reduceCallNotificationTimer(
  state: CallNotificationTimerState,
  action: CallNotificationTimerAction
): CallNotificationTimerState {
  switch (action.type) {
    case "hover-start":
      if (state.hasStartedQuickNote || state.hasTimedOut) {
        return state;
      }
      return { ...state, isHovered: true };
    case "hover-end":
      if (state.hasStartedQuickNote || state.hasTimedOut) {
        return state;
      }
      return { ...state, isHovered: false };
    case "quick-note-start":
      if (state.hasStartedQuickNote || state.hasTimedOut) {
        return state;
      }
      return { ...state, hasStartedQuickNote: true, isHovered: false };
    case "tick": {
      if (
        state.isHovered ||
        state.hasStartedQuickNote ||
        state.hasTimedOut ||
        action.elapsedMs <= 0
      ) {
        return state;
      }

      const remainingMs = Math.max(0, state.remainingMs - action.elapsedMs);

      return {
        ...state,
        remainingMs,
        hasTimedOut: remainingMs === 0,
      };
    }
    default:
      return state;
  }
}

export function isCallNotificationTimerActive(state: CallNotificationTimerState): boolean {
  return !state.isHovered && !state.hasStartedQuickNote && !state.hasTimedOut;
}

export function getCallNotificationProgressPercent(
  remainingMs: number,
  timeoutMs: number = CALL_NOTIFICATION_TIMEOUT_MS
): number {
  if (timeoutMs <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, (remainingMs / timeoutMs) * 100));
}

export function CallNotification({
  call,
  onDismiss,
  onStartTranscription,
  onCreateNote,
}: CallNotificationProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [timerState, dispatchTimer] = useReducer(
    reduceCallNotificationTimer,
    undefined,
    createCallNotificationTimerState
  );

  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isExpanded]);

  const isTimerActive = isCallNotificationTimerActive(timerState);

  useEffect(() => {
    if (!isTimerActive) {
      return;
    }

    let frameId = 0;
    let previousTickAt = performance.now();

    const tick = (now: number) => {
      dispatchTimer({ type: "tick", elapsedMs: now - previousTickAt });
      previousTickAt = now;
      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [isTimerActive]);

  useEffect(() => {
    if (!timerState.hasTimedOut) {
      return;
    }

    onDismiss(call.id);
  }, [call.id, onDismiss, timerState.hasTimedOut]);

  const handleCreateNote = () => {
    const title = noteTitle.trim() || `${call.appName} Call Notes`;
    onCreateNote(title);
    setNoteTitle("");
    onDismiss(call.id);
  };

  const handleQuickNoteToggle = () => {
    setIsExpanded((current) => {
      const nextIsExpanded = !current;

      if (nextIsExpanded) {
        dispatchTimer({ type: "quick-note-start" });
      }

      return nextIsExpanded;
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleCreateNote();
    }
    if (event.key === "Escape") {
      setIsExpanded(false);
    }
  };

  const handleStartTranscription = () => {
    onStartTranscription();
    onDismiss(call.id);
  };

  const appIcon = APP_ICONS[call.appName] || "📞";
  const progressPercent = getCallNotificationProgressPercent(timerState.remainingMs);

  return (
    <div
      className={cn(
        "app-no-drag relative overflow-hidden rounded-xl border border-border/80 bg-card/95 shadow-lg backdrop-blur-sm transition-all duration-300 ease-out",
        isExpanded ? "w-80" : "w-72"
      )}
      role="alert"
      aria-live="polite"
      onMouseEnter={() => dispatchTimer({ type: "hover-start" })}
      onMouseLeave={() => dispatchTimer({ type: "hover-end" })}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-lg">
          {appIcon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Phone className="h-3 w-3 text-green-500" />
            <span className="text-xs font-medium text-green-600">Call Detected</span>
          </div>
          <p className="truncate text-sm font-medium text-foreground">{call.appName}</p>
        </div>

        <button
          type="button"
          aria-label="Dismiss notification"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          onClick={() => onDismiss(call.id)}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Expandable quick note section */}
      <div className="border-t border-border/50">
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-2.5 text-left text-xs text-muted-foreground transition-colors hover:bg-accent/50"
          onClick={handleQuickNoteToggle}
        >
          <span className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5" />
            Quick note
          </span>
          {isExpanded ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>

        {isExpanded && (
          <div className="px-4 pb-3">
            <input
              ref={inputRef}
              type="text"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`${call.appName} Call Notes`}
              className="w-full rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20"
            />
            <button
              type="button"
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
              onClick={handleCreateNote}
            >
              <FileText className="h-3.5 w-3.5" />
              Create Note
            </button>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 border-t border-border/50 px-4 py-3">
        <button
          type="button"
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          onClick={handleStartTranscription}
        >
          <Mic className="h-3.5 w-3.5" />
          Start Transcribing
        </button>
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-border/30"
      >
        <div
          className={cn(
            "h-full bg-primary/70 transition-[width]",
            isTimerActive ? "duration-100" : "duration-200"
          )}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}

interface CallNotificationStackProps {
  calls: DetectedCall[];
  onDismiss: (callId: string) => void;
  onStartTranscription: () => void;
  onCreateNote: (title: string) => void;
}

export function CallNotificationStack({
  calls,
  onDismiss,
  onStartTranscription,
  onCreateNote,
}: CallNotificationStackProps) {
  if (calls.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      <div className="pointer-events-auto absolute right-4 top-12 flex flex-col gap-3">
        {calls.map((call, index) => (
          <div
            key={call.id}
            className="animate-in slide-in-from-right-4 fade-in duration-300"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <CallNotification
              call={call}
              onDismiss={onDismiss}
              onStartTranscription={onStartTranscription}
              onCreateNote={onCreateNote}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
