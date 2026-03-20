import { describe, expect, mock, test } from "bun:test";
import type { CodexMonitorSessionInput } from "@marshall/shared";

mock.module("electron", () => ({
  default: {
    app: {
      getPath: () => "/tmp",
      getAppPath: () => "/tmp/app",
      getName: () => "Marshall",
      getVersion: () => "0.0.0",
    },
  },
  app: {
    getPath: () => "/tmp",
    getAppPath: () => "/tmp/app",
    getName: () => "Marshall",
    getVersion: () => "0.0.0",
  },
  BrowserWindow: class BrowserWindow {
    static getAllWindows() {
      return [];
    }
  },
  ipcMain: {
    handle: () => {},
  },
}));

mock.module("@notionhq/client", () => ({
  Client: class Client {
    search() {
      return { results: [] };
    }
    blocks = {
      children: {
        list: () => ({ results: [] }),
      },
    };
  },
}));

mock.module("electron-store", () => ({
  default: class Store<T extends Record<string, unknown>> {
    private data: T;

    constructor(options?: { defaults?: T }) {
      this.data = (options?.defaults ?? {}) as T;
    }

    get<K extends keyof T>(key: K) {
      return this.data[key];
    }

    set<K extends keyof T>(key: K, value: T[K]) {
      this.data[key] = value;
    }
  },
}));

describe("CodexMonitorService", () => {
  test("stores the full debug prompt without truncation", async () => {
    const { CodexMonitorService } = await import("../src/main/codex-monitor");
    let capturedPrompt = "";
    const service = new CodexMonitorService({
      createNotificationWindow: (() => null) as any,
      executeCodexProcess: async ({ prompt }) => {
        capturedPrompt = prompt;
        return {
          nudge: null,
          items: [],
          checkedPlanItems: [],
          summary: null,
        };
      },
    });

    const session: CodexMonitorSessionInput = {
      noteId: "note-1",
      noteTitle: "Launch review",
      noteBodyHtml: "<p>Agenda</p>",
      noteBodyText: ["Agenda", "- [ ] Confirm owner", "", "Notes", "A".repeat(3200)].join("\n"),
      transcription: {
        status: "recording",
        provider: "local",
        mode: "streaming",
        language: "en",
        model: null,
        transcriptText: `Transcript start ${"B".repeat(1600)} transcript end`,
        finalText: "",
        interimText: "",
        segments: [],
        lastSegmentIndex: null,
        durationSeconds: 0,
        recordingDurationSeconds: 0,
        error: null,
        startedAt: null,
        completedAt: null,
        lastPartialAt: null,
      },
    };

    await (service as any).executeCodex(session, false, "/tmp/schema.json");

    expect(capturedPrompt.length).toBeGreaterThan(900);
    expect(service.getState().debug.lastPromptPreview).toBe(capturedPrompt);
    expect(service.getState().debug.lastPromptPreview).toContain("transcript end");
    expect(service.getState().debug.lastPromptPreview).toContain(`"mode": "live"`);
  });
});
