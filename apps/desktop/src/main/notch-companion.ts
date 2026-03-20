/**
 * NotchCompanionManager
 *
 * Manages the native Swift NotchCompanion app that displays status in the macOS dynamic notch.
 * Communicates with the companion via WebSocket to broadcast state updates.
 */

import { spawn, ChildProcess } from "child_process";
import { app } from "electron";
import { join } from "path";
import { existsSync } from "fs";
import { WebSocketServer, WebSocket } from "ws";
import type { CodexMonitorState, MeetingProposal } from "@marshall/shared";

// Message types sent to Swift companion
interface NotchStateMessage {
  type: "state";
  payload: NotchStatePayload;
}

interface NotchPingMessage {
  type: "ping";
}

interface NotchShutdownMessage {
  type: "shutdown";
}

type _NotchMessage = NotchStateMessage | NotchPingMessage | NotchShutdownMessage;

export interface NotchStatePayload {
  status: "idle" | "monitoring" | "analyzing" | "chatting" | "error";
  noteTitle: string | null;
  nudge: { text: string; suggestedPhrase: string | null } | null;
  items: Array<{ id: string; text: string; status: string }>;
  itemCount: number;
  pendingItemCount: number;
  error: string | null;
  meetingProposals: Array<{
    id: string;
    title: string;
    startAt: string;
    endAt: string;
    status: "pending" | "accepted" | "reminded" | "discarded";
  }>;
}

// Message from Swift companion for actions
interface NotchActionMessage {
  type: "action";
  action: string;
  payload: { proposalId: string };
}

export class NotchCompanionManager {
  private wss: WebSocketServer | null = null;
  private companionProcess: ChildProcess | null = null;
  private client: WebSocket | null = null;
  private lastState: NotchStatePayload | null = null;
  private isStarting = false;
  private onAcceptProposal?: (id: string) => Promise<{ status: string; error?: string }>;
  private onRemindProposal?: (id: string) => Promise<{ status: string; error?: string }>;
  private onDiscardProposal?: (id: string) => Promise<{ status: string; error?: string }>;

  /**
   * Start the WebSocket server and spawn the Swift companion app.
   */
  async start(): Promise<void> {
    if (this.isStarting || this.wss) {
      console.log("[NotchCompanion] Already started or starting");
      return;
    }

    this.isStarting = true;

    try {
      // 1. Find the companion binary
      const companionPath = this.getCompanionPath();
      if (!companionPath) {
        console.log("[NotchCompanion] Companion binary not found, skipping");
        return;
      }

      // 2. Start WebSocket server on random port
      this.wss = new WebSocketServer({ port: 0 });
      const address = this.wss.address();
      if (typeof address === "string" || !address) {
        throw new Error("Failed to get WebSocket server port");
      }
      const port = address.port;
      console.log(`[NotchCompanion] WebSocket server listening on port ${port}`);

      // 3. Handle client connections
      this.wss.on("connection", (ws) => {
        console.log("[NotchCompanion] Client connected");
        this.client = ws;

        // Send current state immediately on connect
        if (this.lastState) {
          this.sendState(this.lastState);
        }

        // Handle incoming messages from Swift companion
        ws.on("message", (data) => {
          try {
            const message = JSON.parse(data.toString()) as NotchActionMessage;
            if (message.type === "action") {
              this.handleAction(message.action, message.payload);
            }
          } catch (error) {
            console.error("[NotchCompanion] Failed to parse message:", error);
          }
        });

        ws.on("close", () => {
          console.log("[NotchCompanion] Client disconnected");
          if (this.client === ws) {
            this.client = null;
          }
        });

        ws.on("error", (error) => {
          console.error("[NotchCompanion] WebSocket error:", error);
        });
      });

      // 4. Spawn the Swift companion
      console.log(`[NotchCompanion] Spawning companion: ${companionPath}`);
      this.companionProcess = spawn(companionPath, [`--port=${port}`], {
        stdio: ["ignore", "pipe", "pipe"],
        detached: false,
      });

      this.companionProcess.stdout?.on("data", (data: Buffer) => {
        console.log(`[NotchCompanion] stdout: ${data.toString().trim()}`);
      });

      this.companionProcess.stderr?.on("data", (data: Buffer) => {
        console.error(`[NotchCompanion] stderr: ${data.toString().trim()}`);
      });

      this.companionProcess.on("error", (error) => {
        console.error("[NotchCompanion] Process error:", error);
      });

      this.companionProcess.on("exit", (code, signal) => {
        console.log(`[NotchCompanion] Process exited with code ${code}, signal ${signal}`);
        this.companionProcess = null;
      });
    } finally {
      this.isStarting = false;
    }
  }

  /**
   * Stop the companion app and close the WebSocket server.
   */
  async stop(): Promise<void> {
    // Send shutdown signal to companion
    if (this.client?.readyState === WebSocket.OPEN) {
      const message: NotchShutdownMessage = { type: "shutdown" };
      this.client.send(JSON.stringify(message));
    }

    // Close WebSocket connections
    this.client?.close();
    this.client = null;

    // Close server
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    // Kill companion process if still running
    if (this.companionProcess && !this.companionProcess.killed) {
      this.companionProcess.kill("SIGTERM");

      // Force kill after timeout
      setTimeout(() => {
        if (this.companionProcess && !this.companionProcess.killed) {
          this.companionProcess.kill("SIGKILL");
        }
      }, 1000);
    }
    this.companionProcess = null;

    console.log("[NotchCompanion] Stopped");
  }

  /**
   * Set callbacks for proposal actions from Swift companion.
   */
  setProposalCallbacks(callbacks: {
    onAccept: (id: string) => Promise<{ status: string; error?: string }>;
    onRemind: (id: string) => Promise<{ status: string; error?: string }>;
    onDiscard: (id: string) => Promise<{ status: string; error?: string }>;
  }): void {
    this.onAcceptProposal = callbacks.onAccept;
    this.onRemindProposal = callbacks.onRemind;
    this.onDiscardProposal = callbacks.onDiscard;
  }

  /**
   * Broadcast state to the companion app.
   */
  broadcastState(state: CodexMonitorState, meetingProposals: MeetingProposal[] = []): void {
    const payload: NotchStatePayload = {
      status: state.status,
      noteTitle: state.noteTitle,
      nudge: state.nudge
        ? {
            text: state.nudge.text,
            suggestedPhrase: state.nudge.suggestedPhrase,
          }
        : null,
      items: state.items.map((i) => ({ id: i.id, text: i.text, status: i.status })),
      itemCount: state.items.length,
      pendingItemCount: state.items.filter((i) => i.status !== "done").length,
      error: state.error,
      meetingProposals: meetingProposals.map((p) => ({
        id: p.id,
        title: p.title,
        startAt: p.startAt,
        endAt: p.endAt,
        status: p.status,
      })),
    };

    this.lastState = payload;
    this.sendState(payload);
  }

  /**
   * Handle action messages from Swift companion.
   */
  private handleAction(action: string, payload: { proposalId: string }): void {
    console.log(`[NotchCompanion] Received action: ${action}, proposalId: ${payload.proposalId}`);
    switch (action) {
      case "acceptProposal":
        this.onAcceptProposal?.(payload.proposalId);
        break;
      case "remindProposal":
        this.onRemindProposal?.(payload.proposalId);
        break;
      case "discardProposal":
        this.onDiscardProposal?.(payload.proposalId);
        break;
      default:
        console.warn(`[NotchCompanion] Unknown action: ${action}`);
    }
  }

  /**
   * Check if the companion is connected.
   */
  isConnected(): boolean {
    return this.client?.readyState === WebSocket.OPEN;
  }

  private sendState(payload: NotchStatePayload): void {
    if (!this.client || this.client.readyState !== WebSocket.OPEN) {
      console.log(
        "[NotchCompanion] Cannot send state - client not connected (readyState:",
        this.client?.readyState,
        ")"
      );
      return;
    }

    const message: NotchStateMessage = {
      type: "state",
      payload,
    };

    try {
      console.log(
        "[NotchCompanion] Sending state:",
        payload.status,
        "items:",
        payload.items.length,
        "nudge:",
        !!payload.nudge
      );
      this.client.send(JSON.stringify(message));
    } catch (error) {
      console.error("[NotchCompanion] Failed to send state:", error);
    }
  }

  /**
   * Get the path to the NotchCompanion binary.
   * In development, look in the build output.
   * In production, look in app resources.
   */
  private getCompanionPath(): string | null {
    // Development: look in build output
    // From out/main/ go up 3 levels to apps/, then into notch-companion
    const devPath = join(__dirname, "../../../notch-companion/.build/release/NotchCompanion");
    console.log(`[NotchCompanion] Looking for binary at: ${devPath}`);
    if (existsSync(devPath)) {
      return devPath;
    }

    // Production: look in app resources
    const resourcesPath = process.resourcesPath || app.getAppPath();
    const prodPath = join(resourcesPath, "notch-companion/NotchCompanion");
    if (existsSync(prodPath)) {
      return prodPath;
    }

    // Alternative production path
    const altProdPath = join(resourcesPath, "NotchCompanion");
    if (existsSync(altProdPath)) {
      return altProdPath;
    }

    console.log("[NotchCompanion] Binary not found. Checked paths:");
    console.log("  - Dev:", devPath);
    console.log("  - Prod:", prodPath);
    console.log("  - Alt:", altProdPath);
    return null;
  }
}
