import { useEffect, useState, useRef, type KeyboardEvent } from "react";
import type {
  CodexMonitorState,
  CodexMonitorItem,
  CodexMonitorChatMessage,
} from "@marshall/shared";
import {
  X,
  AlertCircle,
  Check,
  Circle,
  AlertTriangle,
  Send,
  Loader2,
  MessageSquare,
} from "lucide-react";

export interface CodexNotificationWindowViewProps {
  state: CodexMonitorState;
  onDismiss: () => void;
  onSendChat: (message: string) => void;
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

function ChatMessage({ message }: { message: CodexMonitorChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-xl px-4 py-2.5 text-[13px] leading-relaxed ${
          isUser ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-100"
        }`}
      >
        {message.text}
      </div>
    </div>
  );
}

function StatusIndicator({ state }: { state: CodexMonitorState }) {
  const isComputing = state.status === "analyzing" || state.status === "chatting";
  const isPending = state.debug.pendingAnalysis;
  const isMonitoring = state.status === "monitoring";

  if (isComputing) {
    return (
      <span className="flex items-center gap-2" title="Processing...">
        <Loader2 className="h-3 w-3 animate-spin text-blue-400" />
        <span className="text-[11px] font-medium text-blue-400">Processing</span>
      </span>
    );
  }

  if (isPending) {
    return (
      <span className="flex items-center gap-2" title="Update pending...">
        <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
        <span className="text-[11px] font-medium text-amber-400">Pending</span>
      </span>
    );
  }

  if (isMonitoring) {
    return (
      <span className="flex items-center gap-2" title="Listening...">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        <span className="text-[11px] font-medium text-emerald-500">Listening</span>
      </span>
    );
  }

  return null;
}

export function CodexNotificationWindowView({
  state,
  onDismiss,
  onSendChat,
}: CodexNotificationWindowViewProps) {
  const { nudge, items, error, summary, chatMessages } = state;
  const [chatInput, setChatInput] = useState("");
  const [showChat, setShowChat] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isChatting = state.status === "chatting";
  const hasContent = error || nudge || items.length > 0 || summary || chatMessages.length > 0;

  // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Show chat panel when there are messages
  useEffect(() => {
    if (chatMessages.length > 0) {
      setShowChat(true);
    }
  }, [chatMessages.length]);

  const handleSendChat = () => {
    const message = chatInput.trim();
    if (message && !isChatting) {
      onSendChat(message);
      setChatInput("");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendChat();
    }
  };

  if (!hasContent && !showChat) {
    return null;
  }

  // Sort items: attention first, then pending, then done
  const sortedItems = [...items].sort((a, b) => {
    const order = { attention: 0, pending: 1, done: 2 };
    return order[a.status] - order[b.status];
  });

  const pendingCount = items.filter((i) => i.status !== "done").length;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-neutral-900">
      {/* Header - draggable */}
      <div className="app-drag flex shrink-0 items-center justify-between border-b border-zinc-800/60 px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-medium tracking-tight text-zinc-100">
            {state.noteTitle ?? "Marshall"}
          </span>
          {pendingCount > 0 && (
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] font-medium tabular-nums text-zinc-400">
              {pendingCount}
            </span>
          )}
          <StatusIndicator state={state} />
        </div>
        <div className="app-no-drag flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Toggle chat"
            className={`rounded-md p-1.5 transition-colors ${
              showChat
                ? "bg-zinc-700 text-zinc-100"
                : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
            }`}
            onClick={() => {
              setShowChat(!showChat);
              if (!showChat) {
                setTimeout(() => inputRef.current?.focus(), 100);
              }
            }}
          >
            <MessageSquare className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Dismiss"
            className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
            onClick={onDismiss}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Scrollable content area */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {/* Error state */}
        {error && (
          <div className="flex shrink-0 items-start gap-3 border-b border-zinc-800/60 bg-red-950/40 px-5 py-4">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <p className="text-[13px] leading-relaxed text-red-300">{error}</p>
          </div>
        )}

        {/* Checklist - stable, status-tracked items */}
        {sortedItems.length > 0 && (
          <div className="shrink-0 border-b border-zinc-800/60 px-5 py-4">
            <ul className="space-y-3">
              {sortedItems.map((item) => (
                <li
                  key={item.id}
                  className={`flex items-start gap-3 text-[13px] transition-opacity ${itemStyles(item.status)}`}
                >
                  <span className="mt-0.5 shrink-0">
                    <ItemIcon status={item.status} />
                  </span>
                  <span className="leading-relaxed">{item.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Live nudge - ephemeral, in-the-moment guidance */}
        {nudge && (
          <div className="shrink-0 border-b border-zinc-800/60 bg-zinc-800/40 px-5 py-4">
            <p className="text-[13px] leading-relaxed text-zinc-100">{nudge.text}</p>
            {nudge.suggestedPhrase && (
              <p className="mt-3 text-[13px] italic text-zinc-400">"{nudge.suggestedPhrase}"</p>
            )}
          </div>
        )}

        {/* Summary - only shown at end of call */}
        {summary && !nudge && (
          <div className="shrink-0 border-b border-zinc-800/60 bg-zinc-800/20 px-5 py-4">
            <p className="text-[13px] leading-relaxed text-zinc-400">{summary}</p>
          </div>
        )}

        {/* Chat messages */}
        {showChat && (
          <div
            ref={chatContainerRef}
            className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4"
          >
            {chatMessages.length === 0 && (
              <p className="py-8 text-center text-[13px] text-zinc-500">
                Ask about the call or request info
              </p>
            )}
            {chatMessages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            {isChatting && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2.5 rounded-lg bg-zinc-800 px-4 py-2.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />
                  <span className="text-[13px] text-zinc-400">Thinking...</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chat input - fixed at bottom */}
      {showChat && (
        <div className="shrink-0 border-t border-zinc-800/60 bg-zinc-900 px-5 py-4">
          <div className="flex items-center gap-3">
            <input
              ref={inputRef}
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="What did they say about...?"
              disabled={isChatting}
              className="flex-1 rounded-lg border border-zinc-700/80 bg-zinc-800/80 px-4 py-2.5 text-[13px] text-zinc-100 placeholder-zinc-500 transition-colors focus:border-zinc-600 focus:outline-none disabled:opacity-50"
            />
            <button
              type="button"
              onClick={handleSendChat}
              disabled={!chatInput.trim() || isChatting}
              className="rounded-lg bg-blue-600 p-2.5 text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isChatting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      )}
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

  const handleSendChat = (message: string) => {
    void window.codexMonitorAPI?.sendChat(message);
  };

  return (
    <CodexNotificationWindowView
      state={state}
      onDismiss={() => {
        void window.codexMonitorAPI?.dismissWindow();
      }}
      onSendChat={handleSendChat}
    />
  );
}
