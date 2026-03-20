/**
 * Codex Monitor with MCP Tools
 *
 * This version gives the agent tools to access transcript and notes on-demand,
 * rather than embedding everything in the prompt.
 */

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
  AgentOperation,
  NoteRecord,
  MeetingProposal,
} from "@marshall/shared";
import type { ProposeMeetingInput } from "@marshall/shared";
import {
  MARSHALL_MCP_TOOLS,
  handleToolCall,
  buildMinimalAgentPrompt,
  type MarshallMCPContext,
} from "@marshall/shared";
import { getConversationId, setConversationId, updateLastUsed } from "./codex-sessions";

// ============================================================================
// Types
// ============================================================================

interface CodexMonitorMCPServiceOptions {
  createNotificationWindow: () => BrowserWindow;
  /** Callback to fetch notes from database */
  fetchNotes?: (params: {
    userId: string;
    limit?: number;
    search?: string;
  }) => Promise<NoteRecord[]>;
  /** Callback to fetch a single note */
  fetchNote?: (noteId: string) => Promise<NoteRecord | null>;
}

interface CodexMonitorResultItem {
  text: string;
  status: CodexMonitorItemStatus;
}

// Agent's final response after using tools
interface AgentFinalResponse {
  nudge: {
    text: string;
    suggestedPhrase: string | null;
  } | null;
  items: CodexMonitorResultItem[];
  summary: string | null;
}

// ============================================================================
// Constants
// ============================================================================

const LIVE_ANALYSIS_DELAY_MS = 4000;
const FINAL_ANALYSIS_DEBOUNCE_MS = 1200;
const MIN_TRANSCRIPT_GROWTH_FOR_RECHECK = 180;

// Simplified schema - agent uses tools for data access
const FINAL_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    nudge: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          properties: {
            text: { type: "string" },
            suggestedPhrase: { anyOf: [{ type: "string" }, { type: "null" }] },
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
    summary: { anyOf: [{ type: "string" }, { type: "null" }] },
  },
  required: ["nudge", "items", "summary"],
  additionalProperties: false,
} as const;

// ============================================================================
// Helpers
// ============================================================================

function isActiveCall(status: CodexMonitorSessionInput["transcription"]["status"]) {
  return status === "recording" || status === "transcribing";
}

function normalizeListItem(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeSignature(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
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

async function createTempFile(prefix: string, filename: string, content: string) {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  const path = join(dir, filename);
  await writeFile(path, content, "utf8");
  return path;
}

// ============================================================================
// MCP Context Builder
// ============================================================================

function buildMCPContext(
  session: CodexMonitorSessionInput,
  options: CodexMonitorMCPServiceOptions,
  pendingOps: AgentOperation[],
  emitMeetingProposal: (proposal: MeetingProposal) => void
): MarshallMCPContext {
  return {
    userId: "", // Would come from session in real implementation
    currentNote: {
      id: session.noteId,
      title: session.noteTitle,
      body: session.noteBodyText,
    },
    transcription: {
      status: session.transcription.status,
      text: session.transcription.transcriptText,
      utterances: session.transcription.utterances || [],
    },
    fetchNotes: options.fetchNotes || (async () => []),
    fetchNote: options.fetchNote || (async () => null),
    applyOperations: async (_noteId, ops) => {
      // Collect operations to apply after agent finishes
      pendingOps.push(...ops);
    },
    proposeMeeting: async (input: ProposeMeetingInput) => {
      const proposal: MeetingProposal = {
        id: randomUUID(),
        title: input.title,
        startAt: input.startAt,
        endAt: input.endAt,
        participants: input.participants || [],
        location: input.location || null,
        description: input.description || null,
        createdAt: new Date().toISOString(),
        status: "pending",
      };
      emitMeetingProposal(proposal);
      return proposal;
    },
  };
}

// ============================================================================
// Tool Definitions for Codex
// ============================================================================

function buildToolsConfig() {
  // Convert MCP tools to Codex tool format
  return MARSHALL_MCP_TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.inputSchema,
  }));
}

// ============================================================================
// Codex Process with Tool Calling
// ============================================================================

interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

interface CodexMessage {
  type: string;
  thread_id?: string;
  item?: {
    type?: string;
    text?: string;
    tool_calls?: ToolCall[];
  };
}

async function runCodexWithTools(
  prompt: string,
  context: MarshallMCPContext,
  schemaPath: string,
  conversationId: string | null,
  noteId: string,
  onThreadStarted: (threadId: string) => void,
  setProcess: (child: ChildProcessWithoutNullStreams | null) => void
): Promise<AgentFinalResponse> {
  const toolsPath = await createTempFile(
    "marshall-tools-",
    "tools.json",
    JSON.stringify(buildToolsConfig())
  );

  return new Promise((resolve, reject) => {
    const args = conversationId
      ? ["exec", "resume", "--json", "-m", "gpt-5.4-mini", conversationId, "-"]
      : [
          "exec",
          "--json",
          "--color",
          "never",
          "-m",
          "gpt-5.4-mini",
          "--tools",
          toolsPath,
          "--output-schema",
          schemaPath,
          "-",
        ];

    const child = spawn("codex", args, {
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    setProcess(child);

    let lastAgentMessage = "";
    let stderr = "";
    let pendingToolCalls: ToolCall[] = [];

    const handleStdout = async (chunk: Buffer) => {
      const text = chunk.toString("utf8");

      for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("{")) continue;

        try {
          const parsed = JSON.parse(trimmed) as CodexMessage;

          // Track thread ID
          if (parsed.type === "thread.started" && parsed.thread_id) {
            onThreadStarted(parsed.thread_id);
            if (noteId) {
              setConversationId(noteId, parsed.thread_id);
            }
          }

          // Handle tool calls
          if (parsed.type === "item.created" && parsed.item?.tool_calls) {
            pendingToolCalls.push(...parsed.item.tool_calls);
          }

          // Handle tool call requests - execute and send results back
          if (parsed.type === "tool_call.requested" && parsed.item?.tool_calls) {
            for (const toolCall of parsed.item.tool_calls) {
              const result = await handleToolCall(context, toolCall.name, toolCall.arguments);

              // Send tool result back to Codex
              const toolResult = {
                type: "tool_result",
                tool_call_id: toolCall.id,
                content: result.content,
                is_error: result.isError || false,
              };
              child.stdin.write(JSON.stringify(toolResult) + "\n");
            }
          }

          // Capture final agent message
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
        reject(new Error("Codex returned no response"));
        return;
      }

      try {
        resolve(JSON.parse(lastAgentMessage) as AgentFinalResponse);
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

    // Send initial prompt
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

// ============================================================================
// Service Class
// ============================================================================

export class CodexMonitorMCPService {
  private readonly createNotificationWindow: () => BrowserWindow;
  private readonly options: CodexMonitorMCPServiceOptions;
  private schemaPathPromise: Promise<string> | null = null;
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
  private pendingDocumentOps: AgentOperation[] = [];

  constructor(options: CodexMonitorMCPServiceOptions) {
    this.createNotificationWindow = options.createNotificationWindow;
    this.options = options;
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
    const currentIsActive = isActiveCall(input.transcription.status);

    this.state = {
      ...this.state,
      noteId: input.noteId,
      noteTitle: input.noteTitle,
      status: currentIsActive ? "monitoring" : "idle",
      error: null,
      debug: {
        ...this.state.debug,
        transcriptionStatus: input.transcription.status,
        transcriptLength: transcriptText.length,
        sessionUpdatedAt: new Date().toISOString(),
      },
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
    this.pendingDocumentOps = [];
    this.broadcastState();
    return { status: "cleared" };
  }

  async dismissWindow() {
    this.windowDismissed = true;
    this.notificationWindow?.hide();
    return { status: "dismissed" };
  }

  hideWindow() {
    this.notificationWindow?.hide();
  }

  showWindowIfNeeded() {
    this.syncNotificationWindow();
  }

  async dispose() {
    await this.clearSession();
    if (this.notificationWindow && !this.notificationWindow.isDestroyed()) {
      this.notificationWindow.close();
      this.notificationWindow = null;
    }
    return { status: "disposed" };
  }

  async sendChat(message: string) {
    // In MCP mode, chat is handled through the agent's tools
    // The agent can use get_transcript to answer questions
    if (!this.session) {
      return { status: "error", error: "No active session" };
    }

    // For now, trigger an analysis that will use tools to answer
    // TODO: Implement dedicated chat flow with MCP tools
    this.scheduleAnalysis(false, 0);
    return { status: "queued", message: `Chat message "${message}" will be processed` };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private resetSessionState(noteId: string, noteTitle: string) {
    this.clearPendingAnalysis();
    this.analysisProcess?.kill();
    this.analysisProcess = null;
    this.lastAnalyzedTranscriptLength = 0;
    this.lastFinalizedTranscriptSignature = null;
    this.lastNudgeSignature = null;
    this.windowDismissed = false;
    this.pendingDocumentOps = [];

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
      debug: { ...this.state.debug, pendingAnalysis: false },
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
    if (!this.session) return;
    if (this.analysisProcess) {
      this.rerunRequested = true;
      return;
    }

    const currentSession = this.session;
    const transcriptText = currentSession.transcription.transcriptText.trim();
    const hasMaterial = Boolean(transcriptText || currentSession.noteBodyText.trim());
    if (!hasMaterial) return;

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
        lastOutcome: `Running ${finalize ? "final" : "live"} analysis with MCP tools`,
      },
    };
    this.broadcastState();

    try {
      // Reset pending ops
      this.pendingDocumentOps = [];

      // Build MCP context
      const context = buildMCPContext(
        currentSession,
        this.options,
        this.pendingDocumentOps,
        (proposal) => this.emitMeetingProposal(proposal)
      );

      // Build minimal prompt (agent will use tools for data)
      const prompt = buildMinimalAgentPrompt({
        noteTitle: currentSession.noteTitle,
        mode: finalize ? "final" : "live",
      });

      const schemaPath = await this.getSchemaPath();

      // Run Codex with tool support
      const result = await runCodexWithTools(
        prompt,
        context,
        schemaPath,
        this.conversationId,
        currentSession.noteId,
        (threadId) => {
          this.conversationId = threadId;
        },
        (child) => {
          this.analysisProcess = child;
        }
      );

      if (!this.session || this.session.noteId !== currentSession.noteId) {
        return;
      }

      // Process result
      const mergedItems = this.mergeItems(result.items);
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
            ? "Agent returned a nudge"
            : summary
              ? "Agent returned summary"
              : "Agent updated items",
          lastPromptPreview: prompt,
          lastResponsePreview: JSON.stringify(result, null, 2).slice(0, 900),
        },
      };

      if (finalize && transcriptText) {
        this.lastFinalizedTranscriptSignature = normalizeSignature(transcriptText);
      }

      this.broadcastState();

      // Emit patch with any document operations the agent performed
      if (mergedItems.length > 0 || summary || this.pendingDocumentOps.length > 0) {
        this.emitNotePatch({
          noteId: currentSession.noteId,
          checkedPlanItems: [],
          documentOps: this.pendingDocumentOps,
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
        error: error instanceof Error ? error.message : "Analysis failed",
        debug: {
          ...this.state.debug,
          pendingAnalysis: false,
          analysisInFlight: false,
          lastCompletedAt: new Date().toISOString(),
          lastOutcome: error instanceof Error ? error.message : "Analysis failed",
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

    for (const existing of this.state.items) {
      const sig = normalizeSignature(existing.text);
      const update = nextItems.find((n) => normalizeSignature(n.text) === sig);
      merged.push(update ? { ...existing, status: update.status } : existing);
      seenSignatures.add(sig);
    }

    for (const newItem of nextItems) {
      const sig = normalizeSignature(newItem.text);
      if (seenSignatures.has(sig)) continue;
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

  private buildNudge(result: AgentFinalResponse) {
    if (!result.nudge) return null;

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

  private emitMeetingProposal(proposal: MeetingProposal) {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send("codex-monitor:meeting-proposal", proposal);
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
    this.schemaPathPromise ??= createTempFile(
      "marshall-mcp-schema-",
      "schema.json",
      JSON.stringify(FINAL_RESPONSE_SCHEMA)
    );
    return this.schemaPathPromise;
  }
}
