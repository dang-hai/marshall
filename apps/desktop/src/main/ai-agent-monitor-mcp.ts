/**
 * AI Agent Monitor with MCP Tools
 *
 * This version gives the agent tools to access transcript and notes on-demand,
 * rather than embedding everything in the prompt.
 * Supports multiple coding agents (Codex, Claude Code, etc.)
 */

import { BrowserWindow } from "electron";
import { randomUUID } from "crypto";
import { mkdtemp, readFile, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import type {
  AIAgentMonitorNotePatch,
  AIAgentMonitorSessionInput,
  AIAgentMonitorState,
  AIAgentMonitorItem,
  AIAgentMonitorItemStatus,
  AgentOperation,
  NoteRecord,
  MeetingProposal,
} from "@marshall/shared";
import { getConversationId, setConversationId, updateLastUsed } from "./codex-sessions";
import type { MonitorAgent } from "../shared/settings";

// ============================================================================
// Types
// ============================================================================

interface AIAgentMonitorMCPServiceOptions {
  createNotificationWindow: () => BrowserWindow;
  /** Callback to fetch notes from database */
  fetchNotes?: (params: {
    userId: string;
    limit?: number;
    search?: string;
  }) => Promise<NoteRecord[]>;
  /** Callback to fetch a single note */
  fetchNote?: (noteId: string) => Promise<NoteRecord | null>;
  /** Callback to get the selected monitoring agent */
  getSelectedAgent?: () => MonitorAgent;
}

interface AIAgentMonitorResultItem {
  text: string;
  status: AIAgentMonitorItemStatus;
}

// Agent's final response after using tools
interface AgentFinalResponse {
  nudge: {
    text: string;
    suggestedPhrase: string | null;
  } | null;
  items: AIAgentMonitorResultItem[];
  summary: string | null;
  meetingProposal: {
    title: string;
    startAt: string;
    endAt: string;
    participants?: string[];
    location?: string;
    description?: string;
  } | null;
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
    meetingProposal: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          properties: {
            title: { type: "string" },
            startAt: { type: "string", description: "ISO 8601 datetime" },
            endAt: { type: "string", description: "ISO 8601 datetime" },
            participants: {
              type: "array",
              items: { type: "string" },
              description: "Email addresses",
            },
            location: { type: "string" },
            description: { type: "string" },
          },
          required: ["title", "startAt", "endAt"],
          additionalProperties: false,
        },
      ],
    },
  },
  required: ["nudge", "items", "summary", "meetingProposal"],
  additionalProperties: false,
} as const;

// ============================================================================
// Helpers
// ============================================================================

function isActiveCall(status: AIAgentMonitorSessionInput["transcription"]["status"]) {
  return status === "recording" || status === "transcribing";
}

function normalizeListItem(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeSignature(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeMeetingProposalSignature(proposal: {
  title: string;
  startAt: string;
  endAt: string;
}): string {
  // Normalize by title + start/end times to detect duplicate proposals
  const normalizedTitle = normalizeSignature(proposal.title);
  // Truncate timestamps to minute precision to handle slight variations
  const startMinute = proposal.startAt.slice(0, 16);
  const endMinute = proposal.endAt.slice(0, 16);
  return `${normalizedTitle}|${startMinute}|${endMinute}`;
}

function createEmptyDebugState(): AIAgentMonitorState["debug"] {
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
// Context Prompt Builder
// ============================================================================

function buildContextPrompt(params: {
  noteTitle: string;
  noteBody: string;
  transcript: string;
  mode: "live" | "final";
  chatMessage?: string | null;
}): string {
  const transcriptSection = params.transcript.trim()
    ? `## Current Transcript
${params.transcript.trim()}`
    : "## Current Transcript\n(No transcript yet)";

  const noteSection = params.noteBody.trim()
    ? `## Current Note
${params.noteBody.trim()}`
    : "## Current Note\n(Empty note)";

  const userRequestSection = params.chatMessage
    ? `\n## User Request\n${params.chatMessage}\n\nIMPORTANT: Respond to this request directly. If asked to schedule a meeting, populate meetingProposal.`
    : "";

  return `You are Marshall, an AI assistant helping during a call.

## Call: ${params.noteTitle}

${transcriptSection}

${noteSection}
${userRequestSection}

## Your Task
Analyze the transcript and note above. Respond with a JSON object containing:
- "nudge": An object with "text" (advice for the user) and "suggestedPhrase" (what to say), or null
- "items": Array of action items with "text" and "status" ("pending", "done", or "attention")
- "summary": ${params.mode === "final" ? "A brief summary of the call" : "null (only provide in final mode)"}
- "meetingProposal": If anyone in the transcript mentions scheduling, creating, or proposing a meeting, you MUST create a proposal:
  - "title": Meeting title (infer from context if not explicitly stated)
  - "startAt": ISO 8601 datetime. Today is ${new Date().toISOString().split("T")[0]}. "Tomorrow at 2pm" means the next day at 14:00.
  - "endAt": ISO 8601 datetime. Calculate from duration (e.g., "30 minutes" = startAt + 30 min)
  - "participants": Array of email addresses. If names are mentioned without emails, use format "name@example.com" as placeholder.
  - "location": Location or video link (optional)
  - "description": Meeting description (optional)
  Set to null ONLY if no meeting was discussed in the transcript.

CRITICAL: When the transcript contains phrases like "schedule a meeting", "set up a call", "let's meet", "book a meeting", or similar - you MUST populate meetingProposal. Extract the details (time, duration, participants) from what was said. Do NOT just add it as an action item - CREATE the proposal.

${params.mode === "final" ? "This is the FINAL analysis after the call ended. Provide a summary." : "This is a LIVE check during the call. Focus on immediate guidance."}

Respond ONLY with valid JSON matching this schema. No other text.`;
}

// ============================================================================
// Agent Process Execution
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

async function runCodexWithContext(
  prompt: string,
  schemaPath: string,
  conversationId: string | null,
  noteId: string,
  onThreadStarted: (threadId: string) => void,
  setProcess: (child: ChildProcessWithoutNullStreams | null) => void
): Promise<AgentFinalResponse> {
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

    const handleStdout = (chunk: Buffer) => {
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
        reject(new Error(stderr.trim() || `Agent exited with code ${code}`));
        return;
      }

      if (!lastAgentMessage) {
        reject(new Error("Agent returned no response"));
        return;
      }

      try {
        resolve(JSON.parse(lastAgentMessage) as AgentFinalResponse);
      } catch {
        // Agent returned plain text instead of JSON - treat as a nudge
        console.warn(
          "[AIAgentMonitor] Agent returned non-JSON response:",
          lastAgentMessage.slice(0, 100)
        );
        resolve({
          nudge: {
            text: lastAgentMessage.trim(),
            suggestedPhrase: null,
          },
          items: [],
          summary: null,
          meetingProposal: null,
        });
      }
    });

    // Send initial prompt
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

async function runClaudeCodeWithContext(
  prompt: string,
  schemaPath: string,
  conversationId: string | null,
  noteId: string,
  onThreadStarted: (threadId: string) => void,
  setProcess: (child: ChildProcessWithoutNullStreams | null) => void
): Promise<AgentFinalResponse> {
  // Claude Code uses --json-schema which accepts a JSON string, not a file path
  const schemaContent = await readFile(schemaPath, "utf8");

  return new Promise((resolve, reject) => {
    const args = conversationId
      ? ["--resume", conversationId, "--print", "--output-format", "json", "-p", prompt]
      : ["--print", "--output-format", "json", "--json-schema", schemaContent, "-p", prompt];

    const child = spawn("claude", args, {
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    setProcess(child);

    let stdout = "";
    let stderr = "";

    const handleStdout = (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
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
        reject(new Error(stderr.trim() || `Claude Code exited with code ${code}`));
        return;
      }

      if (!stdout.trim()) {
        reject(new Error("Claude Code returned no response"));
        return;
      }

      try {
        // Try to parse the output as JSON
        const lines = stdout.trim().split("\n");
        let result: string | null = null;

        // Look for JSON output (might be mixed with other output)
        for (let i = lines.length - 1; i >= 0; i--) {
          const line = lines[i].trim();
          if (line.startsWith("{") || line.startsWith("[")) {
            try {
              JSON.parse(line);
              result = line;
              break;
            } catch {
              continue;
            }
          }
        }

        // If no valid JSON found, try parsing entire output
        if (!result) {
          try {
            JSON.parse(stdout.trim());
            result = stdout.trim();
          } catch {
            result = lines[lines.length - 1] || stdout.trim();
          }
        }

        // Extract session ID for conversation continuity
        const sessionMatch = stdout.match(/session[_-]?id["\s:]+["']?([a-zA-Z0-9_-]+)/i);
        if (sessionMatch) {
          onThreadStarted(sessionMatch[1]);
          if (noteId) {
            setConversationId(noteId, sessionMatch[1]);
          }
        }

        resolve(JSON.parse(result) as AgentFinalResponse);
      } catch {
        // Agent returned plain text instead of JSON - treat as a nudge
        console.warn(
          "[AIAgentMonitor] Claude Code returned non-JSON response:",
          stdout.slice(0, 100)
        );
        resolve({
          nudge: {
            text: stdout.trim(),
            suggestedPhrase: null,
          },
          items: [],
          summary: null,
          meetingProposal: null,
        });
      }
    });
  });
}

// ============================================================================
// Service Class
// ============================================================================

export class AIAgentMonitorMCPService {
  private readonly createNotificationWindow: () => BrowserWindow;
  private readonly options: AIAgentMonitorMCPServiceOptions;
  private readonly getSelectedAgent: () => MonitorAgent;
  private schemaPathPromise: Promise<string> | null = null;
  private session: AIAgentMonitorSessionInput | null = null;
  private state: AIAgentMonitorState = {
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
  private windowManuallyShown = false;
  private pendingDocumentOps: AgentOperation[] = [];
  private pendingMeetingProposals: Map<string, MeetingProposal> = new Map();
  private pendingChatMessage: string | null = null;
  private lastMeetingProposalSignature: string | null = null;

  constructor(options: AIAgentMonitorMCPServiceOptions) {
    this.createNotificationWindow = options.createNotificationWindow;
    this.options = options;
    this.getSelectedAgent = options.getSelectedAgent ?? (() => "codex");
  }

  private runAgentWithContext(
    prompt: string,
    schemaPath: string,
    conversationId: string | null,
    noteId: string,
    onThreadStarted: (threadId: string) => void,
    setProcess: (child: ChildProcessWithoutNullStreams | null) => void
  ): Promise<AgentFinalResponse> {
    const agent = this.getSelectedAgent();
    if (agent === "claude-code") {
      return runClaudeCodeWithContext(
        prompt,
        schemaPath,
        conversationId,
        noteId,
        onThreadStarted,
        setProcess
      );
    }
    return runCodexWithContext(
      prompt,
      schemaPath,
      conversationId,
      noteId,
      onThreadStarted,
      setProcess
    );
  }

  getState() {
    return this.state;
  }

  async updateSession(input: AIAgentMonitorSessionInput) {
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
    this.lastMeetingProposalSignature = null;
    this.windowDismissed = false;
    this.conversationId = null;
    this.pendingDocumentOps = [];
    this.pendingMeetingProposals.clear();
    this.broadcastState();
    return { status: "cleared" };
  }

  async dismissWindow() {
    this.windowDismissed = true;
    this.windowManuallyShown = false;
    this.notificationWindow?.hide();
    return { status: "dismissed" };
  }

  hideWindow() {
    this.notificationWindow?.hide();
  }

  showWindowIfNeeded() {
    this.syncNotificationWindow();
  }

  showWindow() {
    const window = this.ensureNotificationWindow();
    if (!window.isVisible()) {
      window.showInactive();
    }
    this.windowDismissed = false;
    this.windowManuallyShown = true;
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
    if (!this.session) {
      return { status: "error", error: "No active session" };
    }

    // Store the chat message to include in the next analysis
    this.pendingChatMessage = message;
    this.scheduleAnalysis(false, 0);
    return { status: "queued", message: `Chat message "${message}" will be processed` };
  }

  getMeetingProposal(proposalId: string): MeetingProposal | null {
    return this.pendingMeetingProposals.get(proposalId) ?? null;
  }

  getPendingMeetingProposals(): MeetingProposal[] {
    return Array.from(this.pendingMeetingProposals.values()).filter((p) => p.status === "pending");
  }

  /** Get meeting proposals that should appear in notes (accepted or reminded, not discarded) */
  getVisibleMeetingProposals(): MeetingProposal[] {
    return Array.from(this.pendingMeetingProposals.values()).filter(
      (p) => p.status === "accepted" || p.status === "reminded"
    );
  }

  async acceptMeetingProposal(
    proposalId: string,
    participants?: string[]
  ): Promise<{ status: string; error?: string }> {
    const proposal = this.pendingMeetingProposals.get(proposalId);
    if (!proposal) {
      return { status: "error", error: "Proposal not found" };
    }

    if (proposal.status !== "pending") {
      return { status: "error", error: `Proposal already ${proposal.status}` };
    }

    // Update participants if provided
    if (participants) {
      proposal.participants = participants;
    }
    proposal.status = "accepted";
    this.pendingMeetingProposals.set(proposalId, proposal);

    // Emit update to UI
    this.emitMeetingProposalUpdate(proposal);

    // Emit note patch with meeting proposal
    if (this.session) {
      this.emitNotePatch({
        noteId: this.session.noteId,
        checkedPlanItems: [],
        items: [],
        meetingProposals: this.getVisibleMeetingProposals(),
        summary: null,
        final: false,
        generatedAt: new Date().toISOString(),
      });
    }

    return { status: "accepted" };
  }

  async remindMeetingProposal(
    proposalId: string,
    participants?: string[]
  ): Promise<{ status: string; error?: string }> {
    const proposal = this.pendingMeetingProposals.get(proposalId);
    if (!proposal) {
      return { status: "error", error: "Proposal not found" };
    }

    if (proposal.status !== "pending") {
      return { status: "error", error: `Proposal already ${proposal.status}` };
    }

    // Update participants if provided
    if (participants) {
      proposal.participants = participants;
    }
    proposal.status = "reminded";
    this.pendingMeetingProposals.set(proposalId, proposal);

    // Emit update to UI
    this.emitMeetingProposalUpdate(proposal);

    // Emit note patch with meeting proposal
    if (this.session) {
      this.emitNotePatch({
        noteId: this.session.noteId,
        checkedPlanItems: [],
        items: [],
        meetingProposals: this.getVisibleMeetingProposals(),
        summary: null,
        final: false,
        generatedAt: new Date().toISOString(),
      });
    }

    return { status: "reminded" };
  }

  async discardMeetingProposal(proposalId: string): Promise<{ status: string; error?: string }> {
    const proposal = this.pendingMeetingProposals.get(proposalId);
    if (!proposal) {
      return { status: "error", error: "Proposal not found" };
    }

    if (proposal.status !== "pending") {
      return { status: "error", error: `Proposal already ${proposal.status}` };
    }

    proposal.status = "discarded";
    this.pendingMeetingProposals.set(proposalId, proposal);

    // Emit update to UI
    this.emitMeetingProposalUpdate(proposal);

    return { status: "discarded" };
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
    this.lastMeetingProposalSignature = null;
    this.windowDismissed = false;
    this.pendingDocumentOps = [];
    this.pendingMeetingProposals.clear();

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

    // If an analysis is already running, just mark for rerun instead of scheduling
    if (this.analysisProcess) {
      this.rerunRequested = true;
      return;
    }

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

      // Build prompt with embedded context (include chat message if present)
      const chatMessage = this.pendingChatMessage;
      this.pendingChatMessage = null; // Clear after use

      const prompt = buildContextPrompt({
        noteTitle: currentSession.noteTitle,
        noteBody: currentSession.noteBodyText,
        transcript: currentSession.transcription.transcriptText,
        mode: finalize ? "final" : "live",
        chatMessage,
      });

      const schemaPath = await this.getSchemaPath();

      // Run agent with context embedded in prompt (uses selected agent from settings)
      const result = await this.runAgentWithContext(
        prompt,
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

      // Process result (defensive: ensure items is an array)
      const mergedItems = Array.isArray(result.items)
        ? this.mergeItems(result.items)
        : this.state.items;
      const summary = finalize ? result.summary?.trim() || null : this.state.summary;
      const nextNudge = finalize ? null : this.buildNudge(result);

      // Handle meeting proposal if present (with deduplication)
      if (result.meetingProposal) {
        const proposalSignature = normalizeMeetingProposalSignature(result.meetingProposal);

        // Skip if we've already emitted an equivalent proposal
        if (proposalSignature !== this.lastMeetingProposalSignature) {
          this.lastMeetingProposalSignature = proposalSignature;
          const proposal: MeetingProposal = {
            id: randomUUID(),
            title: result.meetingProposal.title,
            startAt: result.meetingProposal.startAt,
            endAt: result.meetingProposal.endAt,
            participants: result.meetingProposal.participants || [],
            location: result.meetingProposal.location || null,
            description: result.meetingProposal.description || null,
            createdAt: new Date().toISOString(),
            status: "pending",
          };
          this.emitMeetingProposal(proposal);
        }
      }

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

  private mergeItems(nextItems: AIAgentMonitorResultItem[]): AIAgentMonitorItem[] {
    const merged: AIAgentMonitorItem[] = [];
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

  private emitNotePatch(patch: AIAgentMonitorNotePatch) {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send("ai-agent-monitor:note-patch", patch);
      }
    }
  }

  private emitMeetingProposal(proposal: MeetingProposal) {
    // Store the proposal for later accept/discard
    this.pendingMeetingProposals.set(proposal.id, proposal);

    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send("ai-agent-monitor:meeting-proposal", proposal);
      }
    }
  }

  private emitMeetingProposalUpdate(proposal: MeetingProposal) {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send("ai-agent-monitor:meeting-proposal-update", proposal);
      }
    }
  }

  private broadcastState() {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send("ai-agent-monitor:state", this.state);
      }
    }
    this.syncNotificationWindow();
  }

  private syncNotificationWindow() {
    const hasContent = Boolean(
      this.state.error || this.state.nudge || this.state.summary || this.state.items.length > 0
    );
    const shouldShow = !this.windowDismissed && (hasContent || this.windowManuallyShown);

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
