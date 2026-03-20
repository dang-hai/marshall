import { describe, expect, mock, test } from "bun:test";

mock.module("electron", () => ({
  app: {
    getPath: () => "/tmp",
    getAppPath: () => "/tmp/app",
    getName: () => "Marshall",
    getVersion: () => "0.0.0",
  },
}));

describe("coding-agents", () => {
  test("detectAvailableAgents returns agent info for codex and claude-code", async () => {
    const { detectAvailableAgents } = await import("../src/main/coding-agents");
    const agents = await detectAvailableAgents();

    expect(agents).toHaveLength(2);
    expect(agents[0].id).toBe("codex");
    expect(agents[0].name).toBe("Codex");
    expect(typeof agents[0].available).toBe("boolean");

    expect(agents[1].id).toBe("claude-code");
    expect(agents[1].name).toBe("Claude Code");
    expect(typeof agents[1].available).toBe("boolean");
  });

  test("getAgentExecutor returns an executor for codex", async () => {
    const { getAgentExecutor } = await import("../src/main/coding-agents");
    const executor = getAgentExecutor("codex");

    expect(typeof executor).toBe("function");
  });

  test("getAgentExecutor returns an executor for claude-code", async () => {
    const { getAgentExecutor } = await import("../src/main/coding-agents");
    const executor = getAgentExecutor("claude-code");

    expect(typeof executor).toBe("function");
  });

  test("createTempSchemaFile creates a temporary file with schema", async () => {
    const { createTempSchemaFile } = await import("../src/main/coding-agents");
    const { readFile } = await import("fs/promises");

    const schema = { type: "object", properties: { test: { type: "string" } } };
    const schemaPath = await createTempSchemaFile("test-", schema);

    expect(schemaPath).toContain("test-");
    expect(schemaPath).toContain("schema.json");

    const content = await readFile(schemaPath, "utf8");
    expect(JSON.parse(content)).toEqual(schema);
  });
});
