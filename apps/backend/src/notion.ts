/**
 * Notion OAuth integration
 * Uses Notion's public integration OAuth flow
 */

export const NOTION_PROVIDER_ID = "notion";

export interface NotionOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface NotionTokenResponse {
  access_token: string;
  token_type: string;
  bot_id: string;
  workspace_id: string;
  workspace_name?: string;
  workspace_icon?: string;
  owner: {
    type: string;
    user?: {
      id: string;
      name?: string;
      avatar_url?: string;
      type: string;
      person?: { email?: string };
    };
  };
  duplicated_template_id?: string;
  request_id: string;
}

export interface NotionConnectionStatus {
  connected: boolean;
  workspaceId: string | null;
  workspaceName: string | null;
  workspaceIcon: string | null;
  botId: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
}

export interface StoredNotionToken {
  accessToken: string;
  botId: string;
  workspaceId: string;
  workspaceName: string | null;
  workspaceIcon: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  createdAt: string;
}

/**
 * Build the Notion OAuth authorization URL
 */
export function buildNotionAuthUrl(config: NotionOAuthConfig, state: string): string {
  const url = new URL("https://api.notion.com/v1/oauth/authorize");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("owner", "user");
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeNotionCode(
  config: NotionOAuthConfig,
  code: string
): Promise<NotionTokenResponse> {
  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");

  const response = await fetch("https://api.notion.com/v1/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${credentials}`,
      "Notion-Version": "2022-06-28",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Notion OAuth token exchange failed: ${error}`);
  }

  return response.json() as Promise<NotionTokenResponse>;
}

/**
 * Parse token response into storable format
 */
export function parseNotionTokenResponse(token: NotionTokenResponse): StoredNotionToken {
  return {
    accessToken: token.access_token,
    botId: token.bot_id,
    workspaceId: token.workspace_id,
    workspaceName: token.workspace_name ?? null,
    workspaceIcon: token.workspace_icon ?? null,
    ownerName: token.owner?.user?.name ?? null,
    ownerEmail: token.owner?.user?.person?.email ?? null,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Build connection status from stored token
 */
export function buildNotionConnectionStatus(
  token: StoredNotionToken | null
): NotionConnectionStatus {
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

/**
 * Verify a Notion token is still valid
 */
export async function verifyNotionToken(accessToken: string): Promise<boolean> {
  try {
    const response = await fetch("https://api.notion.com/v1/users/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Notion-Version": "2022-06-28",
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}
