import { ipcMain } from "electron";
import { getNotionToken } from "./integrations";
import type {
  MeetingNoteData,
  NotionDatabase,
  NotionMeetingContext,
  NotionPage,
} from "@marshall/shared";

const NOTION_API_BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

interface BlockObjectRequest {
  type: string;
  [key: string]: unknown;
}

async function notionRequest<T>(
  method: "GET" | "POST" | "PATCH",
  path: string,
  body?: unknown
): Promise<T> {
  const token = getNotionToken();
  if (!token) {
    throw new Error("Notion is not connected. Please connect Notion in Settings > Integrations.");
  }

  const url = `${NOTION_API_BASE}${path}`;
  const options: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${token.accessToken}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const response = await fetch(url, options);

  if (!response.ok) {
    const errorBody = await response.text();
    let message = `Notion API error: ${response.status} ${response.statusText}`;
    try {
      const errorJson = JSON.parse(errorBody);
      if (errorJson.message) {
        message = errorJson.message;
      }
    } catch {
      // Use default message
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

// ============ Search & Context ============

interface SearchResponse {
  results: Array<{
    object: string;
    id: string;
    properties?: Record<string, unknown>;
    last_edited_time?: string;
    url?: string;
    icon?: { type: string; emoji?: string };
    title?: Array<{ plain_text: string }>;
  }>;
}

interface BlockChildrenResponse {
  results: Array<{
    type?: string;
    [key: string]: unknown;
  }>;
}

interface DatabaseResponse {
  properties: Record<string, { type: string; [key: string]: unknown }>;
}

interface PageResponse {
  id: string;
  url?: string;
}

/**
 * Search Notion for pages related to a meeting title or topic
 */
export async function searchRelatedPages(query: string, limit = 5): Promise<NotionPage[]> {
  const response = await notionRequest<SearchResponse>("POST", "/search", {
    query,
    filter: { property: "object", value: "page" },
    page_size: limit,
    sort: { direction: "descending", timestamp: "last_edited_time" },
  });

  return response.results.flatMap((result) => {
    if (result.object !== "page" || !result.properties) {
      return [];
    }

    const title = extractPageTitle(result.properties);
    if (!title) return [];

    return [
      {
        id: result.id,
        title,
        url: result.url || `https://notion.so/${result.id.replace(/-/g, "")}`,
        lastEditedTime: result.last_edited_time,
        icon: extractIcon(result),
      },
    ];
  });
}

/**
 * Get the content of a Notion page as plain text for context
 */
export async function getPageContent(pageId: string): Promise<string> {
  const response = await notionRequest<BlockChildrenResponse>(
    "GET",
    `/blocks/${pageId}/children?page_size=100`
  );

  const textParts: string[] = [];

  for (const block of response.results) {
    if (!block.type) continue;

    const richTextTypes = [
      "paragraph",
      "heading_1",
      "heading_2",
      "heading_3",
      "bulleted_list_item",
      "numbered_list_item",
      "quote",
      "callout",
      "toggle",
    ] as const;

    for (const type of richTextTypes) {
      if (block.type === type && type in block) {
        const content = block[type] as { rich_text?: Array<{ plain_text: string }> };
        if (content?.rich_text) {
          const text = content.rich_text.map((t) => t.plain_text).join("");
          if (text) textParts.push(text);
        }
      }
    }

    if (block.type === "to_do" && "to_do" in block) {
      const todo = block.to_do as {
        checked: boolean;
        rich_text?: Array<{ plain_text: string }>;
      };
      const text = todo.rich_text?.map((t) => t.plain_text).join("") || "";
      const checkbox = todo.checked ? "[x]" : "[ ]";
      if (text) textParts.push(`${checkbox} ${text}`);
    }
  }

  return textParts.join("\n");
}

/**
 * Get context from multiple related pages
 */
export async function getMeetingContext(meetingTitle: string): Promise<NotionMeetingContext> {
  const pages = await searchRelatedPages(meetingTitle, 3);

  if (pages.length === 0) {
    return { pages: [], context: "" };
  }

  const contextParts: string[] = [];

  for (const page of pages.slice(0, 2)) {
    try {
      const content = await getPageContent(page.id);
      if (content) {
        contextParts.push(`## ${page.title}\n${content.slice(0, 2000)}`);
      }
    } catch {
      // Skip pages we can't read
    }
  }

  return {
    pages,
    context: contextParts.join("\n\n"),
  };
}

// ============ Save to Notion ============

/**
 * List databases the user can save meeting notes to
 */
export async function listDatabases(): Promise<NotionDatabase[]> {
  const response = await notionRequest<SearchResponse>("POST", "/search", {
    filter: { property: "object", value: "database" },
    page_size: 20,
  });

  return response.results.flatMap((result) => {
    if (result.object !== "database" || !result.title) {
      return [];
    }

    const title = result.title.map((t) => t.plain_text).join("");
    if (!title) return [];

    return [
      {
        id: result.id,
        title,
        icon: result.icon?.type === "emoji" ? result.icon.emoji : undefined,
      },
    ];
  });
}

/**
 * Save meeting notes to a Notion database
 */
export async function saveMeetingToDatabase(
  databaseId: string,
  data: MeetingNoteData
): Promise<{ pageId: string; url: string }> {
  // Get database schema to understand properties
  const database = await notionRequest<DatabaseResponse>("GET", `/databases/${databaseId}`);
  const properties = database.properties;

  // Build properties based on what's available
  const pageProperties: Record<string, unknown> = {};

  // Find title property
  for (const [key, prop] of Object.entries(properties)) {
    if (prop.type === "title") {
      pageProperties[key] = {
        title: [{ text: { content: data.title } }],
      };
      break;
    }
  }

  // Try to set date if there's a date property
  for (const [key, prop] of Object.entries(properties)) {
    if (prop.type === "date" && key.toLowerCase().includes("date")) {
      pageProperties[key] = {
        date: { start: data.date },
      };
      break;
    }
  }

  // Build page content
  const children: BlockObjectRequest[] = [];

  // Add summary
  if (data.summary) {
    children.push({
      type: "heading_2",
      heading_2: {
        rich_text: [{ type: "text", text: { content: "Summary" } }],
      },
    });
    children.push({
      type: "paragraph",
      paragraph: {
        rich_text: [{ type: "text", text: { content: data.summary } }],
      },
    });
  }

  // Add action items
  if (data.items.length > 0) {
    children.push({
      type: "heading_2",
      heading_2: {
        rich_text: [{ type: "text", text: { content: "Action Items" } }],
      },
    });

    for (const item of data.items) {
      children.push({
        type: "to_do",
        to_do: {
          rich_text: [{ type: "text", text: { content: item.text } }],
          checked: item.status === "done",
        },
      });
    }
  }

  // Add transcript excerpt if provided
  if (data.transcript) {
    children.push({
      type: "heading_2",
      heading_2: {
        rich_text: [{ type: "text", text: { content: "Transcript" } }],
      },
    });
    children.push({
      type: "toggle",
      toggle: {
        rich_text: [{ type: "text", text: { content: "View transcript" } }],
        children: [
          {
            type: "paragraph",
            paragraph: {
              rich_text: [{ type: "text", text: { content: data.transcript.slice(0, 1900) } }],
            },
          },
        ],
      },
    });
  }

  const page = await notionRequest<PageResponse>("POST", "/pages", {
    parent: { database_id: databaseId },
    properties: pageProperties,
    children,
  });

  return {
    pageId: page.id,
    url: page.url || `https://notion.so/${page.id.replace(/-/g, "")}`,
  };
}

/**
 * Save meeting notes as a child page under another page
 */
export async function saveMeetingAsPage(
  parentPageId: string,
  data: MeetingNoteData
): Promise<{ pageId: string; url: string }> {
  const children: BlockObjectRequest[] = [];

  // Meeting metadata
  children.push({
    type: "callout",
    callout: {
      rich_text: [{ type: "text", text: { content: `Meeting on ${data.date}` } }],
      icon: { type: "emoji", emoji: "📅" },
    },
  });

  // Summary
  if (data.summary) {
    children.push({
      type: "heading_2",
      heading_2: {
        rich_text: [{ type: "text", text: { content: "Summary" } }],
      },
    });
    children.push({
      type: "paragraph",
      paragraph: {
        rich_text: [{ type: "text", text: { content: data.summary } }],
      },
    });
  }

  // Action items
  if (data.items.length > 0) {
    children.push({
      type: "heading_2",
      heading_2: {
        rich_text: [{ type: "text", text: { content: "Action Items" } }],
      },
    });

    for (const item of data.items) {
      children.push({
        type: "to_do",
        to_do: {
          rich_text: [{ type: "text", text: { content: item.text } }],
          checked: item.status === "done",
        },
      });
    }
  }

  // Transcript
  if (data.transcript) {
    children.push({
      type: "heading_2",
      heading_2: {
        rich_text: [{ type: "text", text: { content: "Transcript" } }],
      },
    });
    children.push({
      type: "toggle",
      toggle: {
        rich_text: [{ type: "text", text: { content: "View full transcript" } }],
        children: [
          {
            type: "paragraph",
            paragraph: {
              rich_text: [{ type: "text", text: { content: data.transcript.slice(0, 1900) } }],
            },
          },
        ],
      },
    });
  }

  const page = await notionRequest<PageResponse>("POST", "/pages", {
    parent: { page_id: parentPageId },
    properties: {
      title: {
        title: [{ text: { content: data.title } }],
      },
    },
    children,
  });

  return {
    pageId: page.id,
    url: page.url || `https://notion.so/${page.id.replace(/-/g, "")}`,
  };
}

// ============ Helpers ============

function extractPageTitle(properties: Record<string, unknown>): string | null {
  for (const prop of Object.values(properties)) {
    const p = prop as { type?: string; title?: Array<{ plain_text: string }> };
    if (p.type === "title" && p.title) {
      return p.title.map((t) => t.plain_text).join("");
    }
  }
  return null;
}

function extractIcon(result: unknown): string | undefined {
  const page = result as { icon?: { type: string; emoji?: string } };
  if (page.icon?.type === "emoji") {
    return page.icon.emoji;
  }
  return undefined;
}

// ============ IPC Setup ============

export function setupNotionIntegrationIPC(): void {
  // Search for related pages
  ipcMain.handle("notion:search-related", async (_event, query: string) => {
    return searchRelatedPages(query);
  });

  // Get meeting context
  ipcMain.handle("notion:get-meeting-context", async (_event, meetingTitle: string) => {
    return getMeetingContext(meetingTitle);
  });

  // Get page content
  ipcMain.handle("notion:get-page-content", async (_event, pageId: string) => {
    return getPageContent(pageId);
  });

  // List databases
  ipcMain.handle("notion:list-databases", async () => {
    return listDatabases();
  });

  // Save meeting to database
  ipcMain.handle(
    "notion:save-meeting-to-database",
    async (_event, databaseId: string, data: MeetingNoteData) => {
      return saveMeetingToDatabase(databaseId, data);
    }
  );

  // Save meeting as page
  ipcMain.handle(
    "notion:save-meeting-as-page",
    async (_event, parentPageId: string, data: MeetingNoteData) => {
      return saveMeetingAsPage(parentPageId, data);
    }
  );
}
