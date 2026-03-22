import { app } from "electron";
import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import { mkdtemp, readFile, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { dirname, join } from "path";
import type { MonitorAgent } from "../shared/settings";

export interface AgentInfo {
  id: MonitorAgent;
  name: string;
  available: boolean;
  version: string | null;
}

export interface AgentSpawnOptions<T> {
  prompt: string;
  conversationId: string | null;
  schemaPath: string;
  noteId: string;
  onThreadStarted: (threadId: string) => void;
  parseResult: (lastMessage: string) => T;
  setProcess: (child: ChildProcessWithoutNullStreams | null) => void;
  noResultError: string;
}

export type AgentExecutor = <T>(options: AgentSpawnOptions<T>) => Promise<T>;

async function checkCommandExists(command: string): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn("which", [command], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });

    child.on("close", (code) => {
      resolve(code === 0 ? stdout.trim() : null);
    });

    child.on("error", () => {
      resolve(null);
    });
  });
}

async function getCommandVersion(command: string): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn(command, ["--version"], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });

    child.on("close", (code) => {
      if (code === 0 && stdout.trim()) {
        // Extract version number from output
        const match = stdout.match(/(\d+\.\d+(?:\.\d+)?)/);
        resolve(match ? match[1] : stdout.trim().split("\n")[0]);
      } else {
        resolve(null);
      }
    });

    child.on("error", () => {
      resolve(null);
    });
  });
}

export async function detectAvailableAgents(): Promise<AgentInfo[]> {
  const agents: AgentInfo[] = [];

  // Check for Codex CLI
  const codexPath = await checkCommandExists("codex");
  const codexVersion = codexPath ? await getCommandVersion("codex") : null;
  agents.push({
    id: "codex",
    name: "Codex",
    available: codexPath !== null,
    version: codexVersion,
  });

  // Check for Claude Code CLI
  const claudePath = await checkCommandExists("claude");
  const claudeVersion = claudePath ? await getCommandVersion("claude") : null;
  agents.push({
    id: "claude-code",
    name: "Claude Code",
    available: claudePath !== null,
    version: claudeVersion,
  });

  return agents;
}

export async function createTempSchemaFile(prefix: string, schema: object) {
  const schemaDirectory = await mkdtemp(join(tmpdir(), prefix));
  const schemaPath = join(schemaDirectory, "schema.json");
  await writeFile(schemaPath, JSON.stringify(schema), "utf8");
  return schemaPath;
}

function getNotionMcpServerPath(): string {
  // In development, use the workspace path
  // In production, the utilities package is bundled
  const appPath = app.getAppPath();

  if (process.env.ELECTRON_RENDERER_URL) {
    // Development: use workspace path
    return join(
      dirname(dirname(appPath)),
      "packages",
      "utilities",
      "dist",
      "notion",
      "mcp-server.js"
    );
  }

  // Production: utilities is in node_modules
  return join(appPath, "node_modules", "@marshall", "utilities", "dist", "notion", "mcp-server.js");
}

function buildMcpConfig(): string {
  const mcpServerPath = getNotionMcpServerPath();
  // TOML format for --config flag
  return `mcp_servers.notion={command = "node", args = ["${mcpServerPath}"]}`;
}

export function createCodexExecutor(): AgentExecutor {
  return function spawnCodexProcess<T>(options: AgentSpawnOptions<T>): Promise<T> {
    const {
      prompt,
      conversationId,
      schemaPath,
      noteId: _noteId,
      onThreadStarted,
      parseResult,
      setProcess,
      noResultError,
    } = options;

    const mcpConfig = buildMcpConfig();

    const args = conversationId
      ? [
          "exec",
          "resume",
          "--json",
          "--skip-git-repo-check",
          "-m",
          "gpt-5.4-mini",
          "--config",
          mcpConfig,
          conversationId,
          "-",
        ]
      : [
          "exec",
          "--json",
          "--skip-git-repo-check",
          "--color",
          "never",
          "--sandbox",
          "read-only",
          "-m",
          "gpt-5.4-mini",
          "--config",
          mcpConfig,
          "--output-schema",
          schemaPath,
          "-",
        ];

    return new Promise<T>((resolve, reject) => {
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
            const parsed = JSON.parse(trimmed) as {
              type?: string;
              thread_id?: string;
              item?: { type?: string; text?: string };
            };

            if (parsed.type === "thread.started" && parsed.thread_id) {
              onThreadStarted(parsed.thread_id);
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
          reject(new Error(noResultError));
          return;
        }

        try {
          resolve(parseResult(lastAgentMessage));
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
  };
}

export function createClaudeCodeExecutor(): AgentExecutor {
  return async function spawnClaudeProcess<T>(options: AgentSpawnOptions<T>): Promise<T> {
    const {
      prompt,
      conversationId,
      schemaPath,
      noteId: _noteId,
      onThreadStarted,
      parseResult,
      setProcess,
      noResultError,
    } = options;

    // Claude Code uses --json-schema which accepts a JSON string, not a file path
    const schemaContent = await readFile(schemaPath, "utf8");

    // --print outputs final result, --output-format json for structured output
    const args = conversationId
      ? ["--resume", conversationId, "--print", "--output-format", "json", "-p", prompt]
      : ["--print", "--output-format", "json", "--json-schema", schemaContent, "-p", prompt];

    return new Promise<T>((resolve, reject) => {
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
          reject(new Error(noResultError));
          return;
        }

        try {
          // Try to parse the output as JSON
          // Claude Code outputs JSON when --output-format json is used
          const lines = stdout.trim().split("\n");
          let result: string | null = null;

          // Look for JSON output (might be mixed with other output)
          for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i].trim();
            if (line.startsWith("{") || line.startsWith("[")) {
              try {
                // Try to parse as JSON to validate
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
              // Fall back to last non-empty line as the result
              result = lines[lines.length - 1] || stdout.trim();
            }
          }

          // Extract session ID from output if present (for conversation continuity)
          const sessionMatch = stdout.match(/session[_-]?id["\s:]+["']?([a-zA-Z0-9_-]+)/i);
          if (sessionMatch) {
            onThreadStarted(sessionMatch[1]);
          }

          resolve(parseResult(result));
        } catch (error) {
          reject(
            new Error(
              error instanceof Error
                ? `Failed to parse Claude Code output: ${error.message}`
                : "Failed to parse Claude Code output"
            )
          );
        }
      });
    });
  };
}

export function getAgentExecutor(agent: MonitorAgent): AgentExecutor {
  switch (agent) {
    case "codex":
      return createCodexExecutor();
    case "claude-code":
      return createClaudeCodeExecutor();
    default:
      return createCodexExecutor();
  }
}
