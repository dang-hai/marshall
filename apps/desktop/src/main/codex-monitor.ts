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
} from "@marshall/shared";

interface CodexMonitorServiceOptions {
  createNotificationWindow: () => BrowserWindow;
}

interface CodexMonitorResult {
  nudge: {
    title: string;
    body: string;
    priority: "high" | "medium" | "low";
    suggestedPhrase: string | null;
  } | null;
  checkedPlanItems: string[];
  followUps: string[];
  summary: string | null;
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
            title: { type: "string" },
            body: { type: "string" },
            priority: {
              type: "string",
              enum: ["high", "medium", "low"],
            },
            suggestedPhrase: {
              anyOf: [{ type: "string" }, { type: "null" }],
            },
          },
          required: ["title", "body", "priority", "suggestedPhrase"],
          additionalProperties: false,
        },
      ],
    },
    checkedPlanItems: {
      type: "array",
      items: { type: "string" },
    },
    followUps: {
      type: "array",
      items: { type: "string" },
    },
    summary: {
      anyOf: [{ type: "string" }, { type: "null" }],
    },
  },
  required: ["nudge", "checkedPlanItems", "followUps", "summary"],
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
  private session: CodexMonitorSessionInput | null = null;
  private state: CodexMonitorState = {
    status: "idle",
    noteId: null,
    noteTitle: null,
    nudge: null,
    followUps: [],
    summary: null,
    lastAnalyzedAt: null,
    error: null,
    debug: createEmptyDebugState(),
  };
  private notificationWindow: BrowserWindow | null = null;
  private analysisTimer: NodeJS.Timeout | null = null;
  private scheduledAnalysisMode: "live" | "final" | null = null;
  private analysisProcess: ChildProcessWithoutNullStreams | null = null;
  private lastAnalyzedTranscriptLength = 0;
  private lastFinalizedTranscriptSignature: string | null = null;
  private followUpSignatures = new Set<string>();
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
    this.state = {
      status: "idle",
      noteId: null,
      noteTitle: null,
      nudge: null,
      followUps: [],
      summary: null,
      lastAnalyzedAt: null,
      error: null,
      debug: createEmptyDebugState(),
    };
    this.followUpSignatures.clear();
    this.lastNudgeSignature = null;
    this.windowDismissed = false;
    this.broadcastState();
    return { status: "cleared" };
  }

  async dismissWindow() {
    this.windowDismissed = true;
    this.notificationWindow?.hide();
    return { status: "dismissed" };
  }

  private resetSessionState(noteId: string, noteTitle: string) {
    this.clearPendingAnalysis();
    this.analysisProcess?.kill();
    this.analysisProcess = null;
    this.lastAnalyzedTranscriptLength = 0;
    this.lastFinalizedTranscriptSignature = null;
    this.followUpSignatures.clear();
    this.lastNudgeSignature = null;
    this.windowDismissed = false;
    this.state = {
      status: "monitoring",
      noteId,
      noteTitle,
      nudge: null,
      followUps: [],
      summary: null,
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

      const mergedFollowUps = this.mergeFollowUps(result.followUps);
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
        followUps: mergedFollowUps,
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
              : mergedFollowUps.length > 0 || checkedPlanItems.length > 0
                ? "Codex updated follow-ups or checklist items"
                : "Codex returned no nudge",
          lastResponsePreview: truncatePreview(JSON.stringify(result, null, 2)),
        },
      };

      if (finalize && transcriptText) {
        this.lastFinalizedTranscriptSignature = normalizeSignature(transcriptText);
      }

      this.broadcastState();

      if (checkedPlanItems.length > 0 || mergedFollowUps.length > 0 || summary) {
        this.emitNotePatch({
          noteId: currentSession.noteId,
          checkedPlanItems,
          followUps: mergedFollowUps,
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

  private mergeFollowUps(nextFollowUps: string[]) {
    const merged = [...this.state.followUps];

    nextFollowUps
      .map((item) => normalizeListItem(item))
      .filter(Boolean)
      .forEach((item) => {
        const signature = normalizeSignature(item);
        if (this.followUpSignatures.has(signature)) {
          return;
        }

        this.followUpSignatures.add(signature);
        merged.push(item);
      });

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
      return this.state.nudge;
    }

    const signature = normalizeSignature(`${result.nudge.title} ${result.nudge.body}`);
    if (signature === this.lastNudgeSignature) {
      return this.state.nudge;
    }

    this.lastNudgeSignature = signature;
    this.windowDismissed = false;

    return {
      id: randomUUID(),
      title: result.nudge.title.trim(),
      body: result.nudge.body.trim(),
      priority: result.nudge.priority,
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
        this.state.error || this.state.nudge || this.state.summary || this.state.followUps[0]
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
    const args = [
      "exec",
      "--json",
      "--color",
      "never",
      "--sandbox",
      "read-only",
      "--ephemeral",
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

      const handleChunk = (chunk: Buffer) => {
        const text = chunk.toString("utf8");
        for (const line of text.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("{")) {
            continue;
          }

          try {
            const parsed = JSON.parse(trimmed) as {
              type?: string;
              item?: { type?: string; text?: string };
            };

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

      child.stdout.on("data", handleChunk);
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString("utf8");
      });
      child.on("error", reject);
      child.on("close", (code) => {
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
    const promptPayload = {
      mode: finalize ? "final" : "live",
      noteTitle: session.noteTitle,
      planText: session.noteBodyText.trim().slice(0, 5000),
      planChecklistItems: checklistItems,
      transcriptExcerpt: buildTranscriptExcerpt(session.transcription.transcriptText),
      existingFollowUps: this.state.followUps,
      previousNudge: this.state.nudge
        ? {
            title: this.state.nudge.title,
            body: this.state.nudge.body,
          }
        : null,
    };

    return [
      "You are Marshall's live call monitor.",
      "Read the call plan and transcript excerpt and return JSON that matches the provided schema.",
      "Rules:",
      "- Never invent facts that are not supported by the transcript or plan.",
      "- `checkedPlanItems` must only contain exact checklist labels from `planChecklistItems` that are clearly completed.",
      "- `followUps` should be concise standalone action items and should avoid repeating `existingFollowUps`.",
      "- `nudge` is optional. Use it only when a short, actionable moderator nudge would help right now.",
      "- Keep `nudge.title` short and `nudge.body` under 140 characters.",
      "- Set `summary` to null unless `mode` is `final`.",
      "- In `final` mode, write a concise 2-4 sentence summary covering decisions, blockers, and next steps.",
      "",
      JSON.stringify(promptPayload, null, 2),
    ].join("\n");
  }
}
