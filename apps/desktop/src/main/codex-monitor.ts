import { BrowserWindow } from "electron";
import { randomUUID } from "crypto";
import { mkdtemp, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import type {
  CodexMonitorNotePatch,
  CodexMonitorSessionInput,
  CodexMonitorState,
  CodexMonitorItem,
  CodexMonitorItemStatus,
  CodexMonitorChatMessage,
} from "@marshall/shared";
import { getConversationId, setConversationId, updateLastUsed } from "./codex-sessions";

interface CodexMonitorServiceOptions {
  createNotificationWindow: () => BrowserWindow;
}

interface CodexMonitorResultItem {
  text: string;
  status: CodexMonitorItemStatus;
}

interface CodexMonitorResult {
  nudge: {
    text: string;
    suggestedPhrase: string | null;
  } | null;
  items: CodexMonitorResultItem[];
  checkedPlanItems: string[];
  summary: string | null;
}

interface ChatResult {
  response: string;
  items: CodexMonitorResultItem[] | null;
}

const LIVE_ANALYSIS_DELAY_MS = 4000;
const FINAL_ANALYSIS_DEBOUNCE_MS = 1200;
const MIN_TRANSCRIPT_GROWTH_FOR_RECHECK = 180;
const TRANSCRIPT_EXCERPT_LIMIT = 12000;
const DEBUG_PREVIEW_LIMIT = 900;

const RESULT_SCHEMA = {
  type: "object",
  properties: {
    nudge: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          properties: {
            text: { type: "string" },
            suggestedPhrase: {
              anyOf: [{ type: "string" }, { type: "null" }],
            },
          },
          required: ["text", "suggestedPhrase"],
          additionalProperties: false,
        },
      ],
    },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          status: { type: "string", enum: ["pending", "done", "attention"] },
        },
        required: ["text", "status"],
        additionalProperties: false,
      },
    },
    checkedPlanItems: {
      type: "array",
      items: { type: "string" },
    },
    summary: {
      anyOf: [{ type: "string" }, { type: "null" }],
    },
  },
  required: ["nudge", "items", "checkedPlanItems", "summary"],
  additionalProperties: false,
} as const;

const CHAT_RESULT_SCHEMA = {
  type: "object",
  properties: {
    response: { type: "string" },
    items: {
      anyOf: [
        { type: "null" },
        {
          type: "array",
          items: {
            type: "object",
            properties: {
              text: { type: "string" },
              status: { type: "string", enum: ["pending", "done", "attention"] },
            },
            required: ["text", "status"],
            additionalProperties: false,
          },
        },
      ],
    },
  },
  required: ["response", "items"],
  additionalProperties: false,
} as const;

function isActiveCall(status: CodexMonitorSessionInput["transcription"]["status"]) {
  return status === "recording" || status === "transcribing";
}

function normalizeListItem(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeSignature(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function extractChecklistItems(planText: string) {
  return planText
    .split("\n")
    .map((line) => line.trim())
    .flatMap((line) => {
      const match = line.match(/^[-*]\s+\[(?: |x|X)\]\s+(.+)$/);
      return match ? [match[1].trim()] : [];
    });
}

function buildTranscriptExcerpt(transcriptText: string) {
  const normalized = transcriptText.trim();
  if (normalized.length <= TRANSCRIPT_EXCERPT_LIMIT) {
    return normalized;
  }

  const leading = normalized.slice(0, Math.floor(TRANSCRIPT_EXCERPT_LIMIT / 3));
  const trailing = normalized.slice(-(TRANSCRIPT_EXCERPT_LIMIT - leading.length));
  return `${leading}\n...\n${trailing}`;
}

async function createSchemaFile() {
  const schemaDirectory = await mkdtemp(join(tmpdir(), "marshall-codex-monitor-"));
  const schemaPath = join(schemaDirectory, "result-schema.json");
  await writeFile(schemaPath, JSON.stringify(RESULT_SCHEMA), "utf8");
  return schemaPath;
}

async function createChatSchemaFile() {
  const schemaDirectory = await mkdtemp(join(tmpdir(), "marshall-codex-chat-"));
  const schemaPath = join(schemaDirectory, "chat-schema.json");
  await writeFile(schemaPath, JSON.stringify(CHAT_RESULT_SCHEMA), "utf8");
  return schemaPath;
}

function truncatePreview(value: string | null | undefined, limit = DEBUG_PREVIEW_LIMIT) {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length <= limit) {
    return normalized;
  }

  return `${normalized.slice(0, limit)}...`;
}

function createEmptyDebugState(): CodexMonitorState["debug"] {
  return {
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
  };
}

export class CodexMonitorService {
  private readonly createNotificationWindow: () => BrowserWindow;
  private schemaPathPromise: Promise<string> | null = null;
  private chatSchemaPathPromise: Promise<string> | null = null;
  private session: CodexMonitorSessionInput | null = null;
  private state: CodexMonitorState = {
    status: "idle",
    noteId: null,
    noteTitle: null,
    nudge: null,
    items: [],
    summary: null,
    chatMessages: [],
    lastAnalyzedAt: null,
    error: null,
    debug: createEmptyDebugState(),
  };
  private chatProcess: ChildProcessWithoutNullStreams | null = null;
  private notificationWindow: BrowserWindow | null = null;
  private analysisTimer: NodeJS.Timeout | null = null;
  private conversationId: string | null = null;
  private scheduledAnalysisMode: "live" | "final" | null = null;
  private analysisProcess: ChildProcessWithoutNullStreams | null = null;
  private lastAnalyzedTranscriptLength = 0;
  private lastFinalizedTranscriptSignature: string | null = null;
  private lastNudgeSignature: string | null = null;
  private rerunRequested = false;
  private windowDismissed = false;

  constructor(options: CodexMonitorServiceOptions) {
    this.createNotificationWindow = options.createNotificationWindow;
  }

  getState() {
    return this.state;
  }

  async updateSession(input: CodexMonitorSessionInput) {
    const previousSession = this.session;
    const previousWasActive = previousSession
      ? isActiveCall(previousSession.transcription.status)
      : false;
    const transcriptText = input.transcription.transcriptText.trim();

    if (!previousSession || previousSession.noteId !== input.noteId) {
      this.resetSessionState(input.noteId, input.noteTitle);
    }

    this.session = input;
    this.state = {
      ...this.state,
      noteId: input.noteId,
      noteTitle: input.noteTitle,
      status: isActiveCall(input.transcription.status) ? "monitoring" : this.state.status,
      error: null,
      debug: {
        ...this.state.debug,
        transcriptionStatus: input.transcription.status,
        transcriptLength: transcriptText.length,
        checklistItemCount: extractChecklistItems(input.noteBodyText).length,
        sessionUpdatedAt: new Date().toISOString(),
      },
    };
    this.broadcastState();

    const currentIsActive = isActiveCall(input.transcription.status);

    this.state = {
      ...this.state,
      status: currentIsActive ? "monitoring" : "idle",
    };
    this.broadcastState();

    if (currentIsActive) {
      const transcriptGrowth = transcriptText.length - this.lastAnalyzedTranscriptLength;
      if (
        transcriptText.length === 0 ||
        this.state.lastAnalyzedAt === null ||
        transcriptGrowth >= MIN_TRANSCRIPT_GROWTH_FOR_RECHECK
      ) {
        this.scheduleAnalysis(false, LIVE_ANALYSIS_DELAY_MS);
      }
      return { status: "updated" };
    }

    if (
      transcriptText &&
      (previousWasActive || input.transcription.status === "completed") &&
      this.lastFinalizedTranscriptSignature !== normalizeSignature(transcriptText)
    ) {
      this.scheduleAnalysis(true, FINAL_ANALYSIS_DEBOUNCE_MS);
      return { status: "finalizing" };
    }

    if (!transcriptText) {
      this.syncNotificationWindow();
    }

    return { status: "updated" };
  }

  async clearSession(noteId?: string) {
    if (noteId && this.session?.noteId !== noteId) {
      return { status: "ignored" };
    }

    this.session = null;
    this.clearPendingAnalysis();
    this.analysisProcess?.kill();
    this.analysisProcess = null;
    this.chatProcess?.kill();
    this.chatProcess = null;
    this.state = {
      status: "idle",
      noteId: null,
      noteTitle: null,
      nudge: null,
      items: [],
      summary: null,
      chatMessages: [],
      lastAnalyzedAt: null,
      error: null,
      debug: createEmptyDebugState(),
    };
    this.lastNudgeSignature = null;
    this.windowDismissed = false;
    this.conversationId = null;
    this.broadcastState();
    return { status: "cleared" };
  }

  async dismissWindow() {
    this.windowDismissed = true;
    this.notificationWindow?.hide();
    return { status: "dismissed" };
  }

  /**
   * Hides the notification window without affecting session state.
   * Used when the parent window is hidden (e.g., macOS close behavior).
   */
  hideWindow() {
    this.notificationWindow?.hide();
  }

  /**
   * Shows the notification window if there's content to display.
   * Used when the parent window is shown again.
   */
  showWindowIfNeeded() {
    this.syncNotificationWindow();
  }

  /**
   * Closes the notification window and frees all resources.
   * Should be called when the associated notes editor window is closed.
   */
  async dispose() {
    await this.clearSession();

    if (this.notificationWindow && !this.notificationWindow.isDestroyed()) {
      this.notificationWindow.close();
      this.notificationWindow = null;
    }

    return { status: "disposed" };
  }

  async sendChat(message: string) {
    if (!this.session) {
      return { status: "error", error: "No active session" };
    }

    if (this.chatProcess) {
      return { status: "error", error: "Chat already in progress" };
    }

    const userMessage: CodexMonitorChatMessage = {
      id: randomUUID(),
      role: "user",
      text: message.trim(),
      createdAt: new Date().toISOString(),
    };

    this.state = {
      ...this.state,
      status: "chatting",
      chatMessages: [...this.state.chatMessages, userMessage],
      error: null,
    };
    this.broadcastState();
    this.syncNotificationWindow();

    try {
      const result = await this.executeChatQuery(this.session, message);

      const assistantMessage: CodexMonitorChatMessage = {
        id: randomUUID(),
        role: "assistant",
        text: result.response.trim(),
        createdAt: new Date().toISOString(),
      };

      // Update items if the chat returned any
      const updatedItems = result.items ? this.mergeItems(result.items) : this.state.items;

      this.state = {
        ...this.state,
        status: isActiveCall(this.session.transcription.status) ? "monitoring" : "idle",
        chatMessages: [...this.state.chatMessages, assistantMessage],
        items: updatedItems,
      };
      this.broadcastState();

      return { status: "success", response: result.response };
    } catch (error) {
      this.state = {
        ...this.state,
        status: "error",
        error: error instanceof Error ? error.message : "Chat failed",
      };
      this.broadcastState();
      return { status: "error", error: this.state.error };
    } finally {
      this.chatProcess = null;
    }
  }

  private async executeChatQuery(session: CodexMonitorSessionInput, userMessage: string) {
    const transcriptExcerpt = buildTranscriptExcerpt(session.transcription.transcriptText);
    const chatHistory = this.state.chatMessages
      .slice(-6) // Keep last 6 messages for context
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.text}`)
      .join("\n");

    const existingItems = this.state.items.map((item) => ({
      text: item.text,
      status: item.status,
    }));

    const prompt = [
      "You are Marshall, a call assistant helping the user during a live call.",
      "The user is asking you a question while on a call. Answer concisely so they can glance at it quickly.",
      "",
      "## Call Context",
      `Title: ${session.noteTitle}`,
      "",
      "## Meeting Plan/Agenda:",
      session.noteBodyText.trim().slice(0, 3000) || "(No agenda provided)",
      "",
      "## What's Been Discussed (Transcript):",
      transcriptExcerpt || "(Call just started, no transcript yet)",
      "",
      "## Current Tracking:",
      existingItems.length > 0
        ? existingItems.map((item) => `- [${item.status}] ${item.text}`).join("\n")
        : "(No tracked items yet)",
      "",
      chatHistory ? `## Previous Questions:\n${chatHistory}\n` : "",
      `## User's Question:\n${userMessage}`,
      "",
      "Answer the question based on the transcript and meeting context.",
      "Be very concise (1-2 sentences max) - they're in a live call.",
      "If they ask about something not yet discussed, say so.",
      "",
      'Return JSON: {"response": "your answer", "items": null}',
    ].join("\n");

    const schemaPath = await this.getChatSchemaPath();

    // Build args: use "resume" if we have an existing session, otherwise start fresh
    // Note: resume only supports --json, not --color/--sandbox/--output-schema
    const args = this.conversationId
      ? ["exec", "resume", "--json", this.conversationId, "-"]
      : [
          "exec",
          "--json",
          "--color",
          "never",
          "--sandbox",
          "read-only",
          "--output-schema",
          schemaPath,
          "-",
        ];

    return await new Promise<ChatResult>((resolve, reject) => {
      const child = spawn("codex", args, {
        env: process.env,
        stdio: ["pipe", "pipe", "pipe"],
      });
      this.chatProcess = child;

      let lastAgentMessage = "";
      let stderr = "";

      const handleStdout = (chunk: Buffer) => {
        const text = chunk.toString("utf8");
        for (const line of text.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("{")) {
            continue;
          }

          try {
            const parsed = JSON.parse(trimmed) as {
              type?: string;
              thread_id?: string;
              item?: { type?: string; text?: string };
            };

            // Capture the thread_id from the first response and persist it
            if (parsed.type === "thread.started" && parsed.thread_id) {
              this.conversationId = parsed.thread_id;
              if (session.noteId) {
                setConversationId(session.noteId, parsed.thread_id);
              }
            }

            if (
              parsed.type === "item.completed" &&
              parsed.item?.type === "agent_message" &&
              typeof parsed.item.text === "string"
            ) {
              lastAgentMessage = parsed.item.text;
            }
          } catch {
            continue;
          }
        }
      };

      const handleStderr = (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      };

      const cleanup = () => {
        child.stdout.removeListener("data", handleStdout);
        child.stderr.removeListener("data", handleStderr);
      };

      child.stdout.on("data", handleStdout);
      child.stderr.on("data", handleStderr);
      child.on("error", (err) => {
        cleanup();
        reject(err);
      });
      child.on("close", (code) => {
        cleanup();

        if (code !== 0) {
          reject(new Error(stderr.trim() || `Codex exited with code ${code}`));
          return;
        }

        if (!lastAgentMessage) {
          reject(new Error("No response from assistant"));
          return;
        }

        try {
          resolve(JSON.parse(lastAgentMessage) as ChatResult);
        } catch {
          // If JSON parsing fails, treat the whole message as the response
          resolve({ response: lastAgentMessage, items: null });
        }
      });

      child.stdin.write(prompt);
      child.stdin.end();
    });
  }

  private resetSessionState(noteId: string, noteTitle: string) {
    this.clearPendingAnalysis();
    this.analysisProcess?.kill();
    this.analysisProcess = null;
    this.chatProcess?.kill();
    this.chatProcess = null;
    this.lastAnalyzedTranscriptLength = 0;
    this.lastFinalizedTranscriptSignature = null;
    this.lastNudgeSignature = null;
    this.windowDismissed = false;

    // Load existing session if available, otherwise start fresh (codex will assign ID)
    const existingConversationId = getConversationId(noteId);
    if (existingConversationId) {
      this.conversationId = existingConversationId;
      updateLastUsed(noteId);
    } else {
      this.conversationId = null;
    }

    this.state = {
      status: "monitoring",
      noteId,
      noteTitle,
      nudge: null,
      items: [],
      summary: null,
      chatMessages: [],
      lastAnalyzedAt: null,
      error: null,
      debug: createEmptyDebugState(),
    };
  }

  private clearPendingAnalysis() {
    if (this.analysisTimer) {
      clearTimeout(this.analysisTimer);
      this.analysisTimer = null;
    }

    this.scheduledAnalysisMode = null;
    this.state = {
      ...this.state,
      debug: {
        ...this.state.debug,
        pendingAnalysis: false,
      },
    };
  }

  private scheduleAnalysis(finalize: boolean, delayMs: number) {
    const nextMode = finalize ? "final" : "live";
    if (this.analysisTimer) {
      if (this.scheduledAnalysisMode === "final" || this.scheduledAnalysisMode === nextMode) {
        return;
      }

      this.clearPendingAnalysis();
    }

    this.state = {
      ...this.state,
      debug: {
        ...this.state.debug,
        pendingAnalysis: true,
        lastMode: nextMode,
        lastOutcome: `Scheduled ${nextMode} analysis in ${Math.round(delayMs / 1000)}s`,
      },
    };
    this.broadcastState();
    this.scheduledAnalysisMode = nextMode;
    this.analysisTimer = setTimeout(() => {
      this.analysisTimer = null;
      this.scheduledAnalysisMode = null;
      void this.runAnalysis(finalize);
    }, delayMs);
  }

  private async runAnalysis(finalize: boolean) {
    if (!this.session) {
      return;
    }

    if (this.analysisProcess) {
      this.rerunRequested = true;
      return;
    }

    const currentSession = this.session;
    const transcriptText = currentSession.transcription.transcriptText.trim();
    const hasMaterial = Boolean(transcriptText || currentSession.noteBodyText.trim());
    if (!hasMaterial) {
      return;
    }

    this.state = {
      ...this.state,
      status: "analyzing",
      error: null,
      debug: {
        ...this.state.debug,
        pendingAnalysis: false,
        analysisInFlight: true,
        analysisCount: this.state.debug.analysisCount + 1,
        lastMode: finalize ? "final" : "live",
        lastStartedAt: new Date().toISOString(),
        lastOutcome: `Running ${finalize ? "final" : "live"} Codex analysis`,
      },
    };
    this.broadcastState();

    try {
      const schemaPath = await this.getSchemaPath();
      const result = await this.executeCodex(currentSession, finalize, schemaPath);
      if (!this.session || this.session.noteId !== currentSession.noteId) {
        return;
      }

      const mergedItems = this.mergeItems(result.items);
      const checkedPlanItems = this.filterChecklistMatches(
        extractChecklistItems(currentSession.noteBodyText),
        result.checkedPlanItems
      );
      const summary = finalize ? result.summary?.trim() || null : this.state.summary;
      const nextNudge = finalize ? null : this.buildNudge(result);

      this.lastAnalyzedTranscriptLength = transcriptText.length;
      this.state = {
        ...this.state,
        status: isActiveCall(currentSession.transcription.status) ? "monitoring" : "idle",
        nudge: nextNudge,
        items: mergedItems,
        summary,
        lastAnalyzedAt: new Date().toISOString(),
        error: null,
        debug: {
          ...this.state.debug,
          pendingAnalysis: false,
          analysisInFlight: false,
          lastCompletedAt: new Date().toISOString(),
          lastOutcome: nextNudge
            ? "Codex returned a nudge"
            : summary
              ? "Codex returned the final summary"
              : mergedItems.length > 0 || checkedPlanItems.length > 0
                ? "Codex updated items or checklist"
                : "Codex returned no nudge",
          lastResponsePreview: truncatePreview(JSON.stringify(result, null, 2)),
        },
      };

      if (finalize && transcriptText) {
        this.lastFinalizedTranscriptSignature = normalizeSignature(transcriptText);
      }

      this.broadcastState();

      if (checkedPlanItems.length > 0 || mergedItems.length > 0 || summary) {
        this.emitNotePatch({
          noteId: currentSession.noteId,
          checkedPlanItems,
          items: mergedItems,
          summary,
          final: finalize,
          generatedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      this.state = {
        ...this.state,
        status: "error",
        error: error instanceof Error ? error.message : "Codex monitoring failed",
        debug: {
          ...this.state.debug,
          pendingAnalysis: false,
          analysisInFlight: false,
          lastCompletedAt: new Date().toISOString(),
          lastOutcome: error instanceof Error ? error.message : "Codex monitoring failed",
        },
      };
      this.broadcastState();
    } finally {
      this.analysisProcess = null;

      if (this.rerunRequested) {
        this.rerunRequested = false;
        const shouldFinalize = this.session
          ? !isActiveCall(this.session.transcription.status) &&
            Boolean(this.session.transcription.transcriptText.trim())
          : finalize;
        void this.runAnalysis(shouldFinalize);
      }
    }
  }

  private mergeItems(nextItems: CodexMonitorResultItem[]): CodexMonitorItem[] {
    const merged: CodexMonitorItem[] = [];
    const seenSignatures = new Set<string>();

    // First, process existing items and update their status if mentioned
    for (const existing of this.state.items) {
      const sig = normalizeSignature(existing.text);
      const update = nextItems.find((n) => normalizeSignature(n.text) === sig);

      if (update) {
        // Update status if AI says it changed
        merged.push({ ...existing, status: update.status });
      } else {
        // Keep existing item unchanged
        merged.push(existing);
      }
      seenSignatures.add(sig);
    }

    // Then, add new items that weren't already in the list
    for (const newItem of nextItems) {
      const sig = normalizeSignature(newItem.text);
      if (seenSignatures.has(sig)) {
        continue;
      }

      seenSignatures.add(sig);
      merged.push({
        id: randomUUID(),
        text: normalizeListItem(newItem.text),
        status: newItem.status,
        addedAt: new Date().toISOString(),
      });
    }

    return merged;
  }

  private filterChecklistMatches(planChecklistItems: string[], checkedItems: string[]) {
    const available = new Map(
      planChecklistItems.map((item) => [normalizeSignature(item), item] as const)
    );

    return checkedItems.flatMap((item) => {
      const match = available.get(normalizeSignature(item));
      return match ? [match] : [];
    });
  }

  private buildNudge(result: CodexMonitorResult) {
    if (!result.nudge) {
      return null; // Clear nudge when AI doesn't provide one
    }

    const signature = normalizeSignature(result.nudge.text);
    if (signature === this.lastNudgeSignature) {
      return this.state.nudge;
    }

    this.lastNudgeSignature = signature;
    this.windowDismissed = false;

    return {
      id: randomUUID(),
      text: result.nudge.text.trim(),
      suggestedPhrase: result.nudge.suggestedPhrase?.trim() || null,
      createdAt: new Date().toISOString(),
    };
  }

  private emitNotePatch(patch: CodexMonitorNotePatch) {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send("codex-monitor:note-patch", patch);
      }
    }
  }

  private broadcastState() {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send("codex-monitor:state", this.state);
      }
    }

    this.syncNotificationWindow();
  }

  private syncNotificationWindow() {
    const shouldShow =
      !this.windowDismissed &&
      Boolean(
        this.state.error || this.state.nudge || this.state.summary || this.state.items.length > 0
      );

    if (!shouldShow) {
      this.notificationWindow?.hide();
      return;
    }

    const window = this.ensureNotificationWindow();
    if (!window.isVisible()) {
      window.showInactive();
    }
  }

  private ensureNotificationWindow() {
    if (!this.notificationWindow || this.notificationWindow.isDestroyed()) {
      this.notificationWindow = this.createNotificationWindow();
      this.notificationWindow.on("closed", () => {
        this.notificationWindow = null;
      });
    }

    return this.notificationWindow;
  }

  private async getSchemaPath() {
    this.schemaPathPromise ??= createSchemaFile();
    return this.schemaPathPromise;
  }

  private async getChatSchemaPath() {
    this.chatSchemaPathPromise ??= createChatSchemaFile();
    return this.chatSchemaPathPromise;
  }

  private async executeCodex(
    session: CodexMonitorSessionInput,
    finalize: boolean,
    schemaPath: string
  ) {
    const prompt = this.buildPrompt(session, finalize);
    this.state = {
      ...this.state,
      debug: {
        ...this.state.debug,
        lastPromptPreview: truncatePreview(prompt),
      },
    };
    this.broadcastState();

    // Build args: use "resume" if we have an existing session, otherwise start fresh
    // Note: resume only supports --json, not --color/--sandbox/--output-schema
    const args = this.conversationId
      ? ["exec", "resume", "--json", this.conversationId, "-"]
      : [
          "exec",
          "--json",
          "--color",
          "never",
          "--sandbox",
          "read-only",
          "--output-schema",
          schemaPath,
          "-",
        ];

    return await new Promise<CodexMonitorResult>((resolve, reject) => {
      const child = spawn("codex", args, {
        env: process.env,
        stdio: ["pipe", "pipe", "pipe"],
      });
      this.analysisProcess = child;

      let lastAgentMessage = "";
      let stderr = "";

      const handleStdout = (chunk: Buffer) => {
        const text = chunk.toString("utf8");
        for (const line of text.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("{")) {
            continue;
          }

          try {
            const parsed = JSON.parse(trimmed) as {
              type?: string;
              thread_id?: string;
              item?: { type?: string; text?: string };
            };

            // Capture the thread_id from the first response and persist it
            if (parsed.type === "thread.started" && parsed.thread_id) {
              this.conversationId = parsed.thread_id;
              if (session.noteId) {
                setConversationId(session.noteId, parsed.thread_id);
              }
            }

            if (
              parsed.type === "item.completed" &&
              parsed.item?.type === "agent_message" &&
              typeof parsed.item.text === "string"
            ) {
              lastAgentMessage = parsed.item.text;
            }
          } catch {
            continue;
          }
        }
      };

      const handleStderr = (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      };

      const cleanup = () => {
        child.stdout.removeListener("data", handleStdout);
        child.stderr.removeListener("data", handleStderr);
      };

      child.stdout.on("data", handleStdout);
      child.stderr.on("data", handleStderr);
      child.on("error", (err) => {
        cleanup();
        reject(err);
      });
      child.on("close", (code) => {
        cleanup();

        if (code !== 0) {
          reject(new Error(stderr.trim() || `Codex exited with code ${code}`));
          return;
        }

        if (!lastAgentMessage) {
          reject(new Error("Codex returned no structured result"));
          return;
        }

        try {
          resolve(JSON.parse(lastAgentMessage) as CodexMonitorResult);
        } catch (error) {
          reject(
            new Error(
              error instanceof Error
                ? `Failed to parse Codex output: ${error.message}`
                : "Failed to parse Codex output"
            )
          );
        }
      });

      child.stdin.write(prompt);
      child.stdin.end();
    });
  }

  private buildPrompt(session: CodexMonitorSessionInput, finalize: boolean) {
    const checklistItems = extractChecklistItems(session.noteBodyText);
    const existingItems = this.state.items.map((item) => ({
      text: item.text,
      status: item.status,
    }));

    const promptPayload = {
      mode: finalize ? "final" : "live",
      noteTitle: session.noteTitle,
      planText: session.noteBodyText.trim().slice(0, 5000),
      planChecklistItems: checklistItems,
      transcriptExcerpt: buildTranscriptExcerpt(session.transcription.transcriptText),
      existingItems,
      previousNudge: this.state.nudge?.text ?? null,
    };

    return [
      "You are Marshall's live call monitor.",
      "Read the call plan and transcript excerpt and return JSON that matches the provided schema.",
      "",
      "## Items",
      "- Return `items` as an array of {text, status} objects.",
      "- Status values: `pending` (not yet addressed), `done` (completed/discussed), `attention` (needs focus now).",
      "- Include existing items with updated status if their status changed based on the conversation.",
      "- Add new action items discovered in the conversation.",
      "- Keep item text concise (under 80 characters).",
      "",
      "## Nudge",
      "- `nudge` is an ephemeral in-the-moment tip to help guide the conversation.",
      "- Set to null unless there's something specific to say right now.",
      "- Keep `nudge.text` under 100 characters - it should be glanceable.",
      "- Avoid repeating the previous nudge.",
      "",
      "## Other rules",
      "- `checkedPlanItems` must only contain exact labels from `planChecklistItems` that are clearly completed.",
      "- Set `summary` to null unless `mode` is `final`.",
      "- In `final` mode, write a concise 2-3 sentence summary.",
      "",
      JSON.stringify(promptPayload, null, 2),
    ].join("\n");
  }
}
