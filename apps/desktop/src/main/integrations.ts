import Store from "electron-store";
import { ipcMain } from "electron";
import type { NotionConnectionStatus, StoredNotionToken } from "@marshall/shared";

export interface IntegrationTokens {
  notion: StoredNotionToken | null;
}

const defaultIntegrationTokens: IntegrationTokens = {
  notion: null,
};

const store = new Store<IntegrationTokens>({
  name: "marshall-integrations",
  defaults: defaultIntegrationTokens,
  schema: {
    notion: {
      type: ["object", "null"],
      properties: {
        accessToken: { type: "string" },
        botId: { type: "string" },
        workspaceId: { type: "string" },
        workspaceName: { type: ["string", "null"] },
        workspaceIcon: { type: ["string", "null"] },
        ownerName: { type: ["string", "null"] },
        ownerEmail: { type: ["string", "null"] },
        createdAt: { type: "string" },
      },
    },
  },
});

// ============ Notion ============

export function getNotionToken(): StoredNotionToken | null {
  return store.get("notion");
}

export function setNotionToken(token: StoredNotionToken): void {
  store.set("notion", token);
}

export function clearNotionToken(): void {
  store.set("notion", null);
}

export function getNotionConnectionStatus(): NotionConnectionStatus {
  const token = getNotionToken();
  if (!token) {
    return {
      connected: false,
      workspaceId: null,
      workspaceName: null,
      workspaceIcon: null,
      botId: null,
      ownerName: null,
      ownerEmail: null,
    };
  }

  return {
    connected: true,
    workspaceId: token.workspaceId,
    workspaceName: token.workspaceName,
    workspaceIcon: token.workspaceIcon,
    botId: token.botId,
    ownerName: token.ownerName,
    ownerEmail: token.ownerEmail,
  };
}

// ============ IPC Setup ============

export function setupIntegrationsIPC(): void {
  // Get Notion connection status
  ipcMain.handle("notion:get-status", () => {
    return getNotionConnectionStatus();
  });

  // Get Notion access token (for CLI use)
  ipcMain.handle("notion:get-token", () => {
    const token = getNotionToken();
    return token?.accessToken ?? null;
  });

  // Disconnect Notion
  ipcMain.handle("notion:disconnect", () => {
    clearNotionToken();
    return { status: "disconnected" };
  });

  // Get integrations store path (for CLI)
  ipcMain.handle("integrations:get-path", () => {
    return store.path;
  });
}

// ============ CLI Token Export ============

/**
 * Export the Notion token for CLI use.
 * The CLI can read this file directly to get the token.
 */
export function getIntegrationsStorePath(): string {
  return store.path;
}
