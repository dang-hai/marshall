#!/usr/bin/env node
/**
 * Notion MCP Server
 *
 * Exposes Notion operations as MCP tools for AI agents.
 *
 * Tools:
 * - notion_search: Search for pages in Notion
 * - notion_get_page_content: Get the text content of a page
 * - notion_get_meeting_context: Search and get content from related pages
 * - notion_list_databases: List available databases
 * - notion_save_meeting: Save meeting notes to a database
 */

import { getTokenFromMarshallStore } from "./client.js";
import type {
  SearchResponse,
  ListBlockChildrenResponse,
  GetDatabaseResponse,
  PageObjectResponse,
  BlockObjectRequest,
} from "./types.js";

const NOTION_API_BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

interface MCPRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface MCPResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface MCPNotification {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown>;
}

const TOOLS = [
  {
    name: "notion_search",
    description:
      "Search for pages in the user's Notion workspace. Use this to find relevant context, documents, or notes related to a topic.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query to find relevant pages",
        },
        limit: {
          type: "number",
          description: "Maximum number of results (default: 5, max: 20)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "notion_get_page_content",
    description:
      "Get the text content of a specific Notion page. Use this after searching to read the full content of a relevant page.",
    inputSchema: {
      type: "object",
      properties: {
        pageId: {
          type: "string",
          description: "The ID of the Notion page to read",
        },
      },
      required: ["pageId"],
    },
  },
  {
    name: "notion_get_meeting_context",
    description:
      "Search for pages related to a meeting topic and return their content as context. This combines search + content retrieval in one call.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Meeting topic, project name, or keywords to search for relevant context",
        },
        maxPages: {
          type: "number",
          description: "Maximum pages to include content from (default: 2)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "notion_list_databases",
    description: "List available Notion databases where meeting notes can be saved.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "notion_save_meeting",
    description:
      "Save meeting notes to a Notion database. Use this after a call ends to persist the summary and action items.",
    inputSchema: {
      type: "object",
      properties: {
        databaseId: {
          type: "string",
          description: "The ID of the database to save to",
        },
        title: {
          type: "string",
          description: "Meeting title",
        },
        date: {
          type: "string",
          description: "Meeting date in YYYY-MM-DD format",
        },
        summary: {
          type: "string",
          description: "Meeting summary",
        },
        actionItems: {
          type: "array",
          items: {
            type: "object",
            properties: {
              text: { type: "string" },
              done: { type: "boolean" },
            },
            required: ["text"],
          },
          description: "List of action items from the meeting",
        },
        transcript: {
          type: "string",
          description: "Optional transcript excerpt",
        },
      },
      required: ["databaseId", "title", "date"],
    },
  },
];

class NotionMCPServer {
  private token: string | null = null;

  private getToken(): string {
    if (!this.token) {
      this.token = getTokenFromMarshallStore() || process.env.NOTION_TOKEN || null;
      if (!this.token) {
        throw new Error(
          "Notion token not found. Connect Notion in Marshall Settings > Integrations, or set NOTION_TOKEN."
        );
      }
    }
    return this.token;
  }

  private async request<T>(
    method: "GET" | "POST" | "PATCH",
    path: string,
    body?: unknown
  ): Promise<T> {
    const token = this.getToken();
    const url = `${NOTION_API_BASE}${path}`;
    const options: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
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

  async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    try {
      switch (request.method) {
        case "initialize":
          return this.handleInitialize(request);
        case "tools/list":
          return this.handleToolsList(request);
        case "tools/call":
          return this.handleToolsCall(request);
        default:
          return {
            jsonrpc: "2.0",
            id: request.id,
            error: {
              code: -32601,
              message: `Method not found: ${request.method}`,
            },
          };
      }
    } catch (error) {
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : "Internal error",
        },
      };
    }
  }

  private handleInitialize(request: MCPRequest): MCPResponse {
    return {
      jsonrpc: "2.0",
      id: request.id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: "notion-mcp",
          version: "1.0.0",
        },
      },
    };
  }

  private handleToolsList(request: MCPRequest): MCPResponse {
    return {
      jsonrpc: "2.0",
      id: request.id,
      result: {
        tools: TOOLS,
      },
    };
  }

  private async handleToolsCall(request: MCPRequest): Promise<MCPResponse> {
    const params = request.params as {
      name: string;
      arguments?: Record<string, unknown>;
    };
    const toolName = params.name;
    const args = params.arguments || {};

    let result: unknown;

    switch (toolName) {
      case "notion_search":
        result = await this.toolSearch(args);
        break;
      case "notion_get_page_content":
        result = await this.toolGetPageContent(args);
        break;
      case "notion_get_meeting_context":
        result = await this.toolGetMeetingContext(args);
        break;
      case "notion_list_databases":
        result = await this.toolListDatabases();
        break;
      case "notion_save_meeting":
        result = await this.toolSaveMeeting(args);
        break;
      default:
        return {
          jsonrpc: "2.0",
          id: request.id,
          error: {
            code: -32602,
            message: `Unknown tool: ${toolName}`,
          },
        };
    }

    return {
      jsonrpc: "2.0",
      id: request.id,
      result: {
        content: [
          {
            type: "text",
            text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
          },
        ],
      },
    };
  }

  private async toolSearch(args: Record<string, unknown>) {
    const query = args.query as string;
    const limit = Math.min((args.limit as number) || 5, 20);

    const response = await this.request<SearchResponse>("POST", "/search", {
      query,
      filter: { property: "object", value: "page" },
      page_size: limit,
    });

    const pages = response.results.flatMap((result) => {
      if (result.object !== "page" || !("properties" in result)) {
        return [];
      }

      const title = this.extractPageTitle(result.properties);
      if (!title) return [];

      return [
        {
          id: result.id,
          title,
          url: `https://notion.so/${result.id.replace(/-/g, "")}`,
          lastEdited: result.last_edited_time,
        },
      ];
    });

    return { pages, count: pages.length };
  }

  private async toolGetPageContent(args: Record<string, unknown>) {
    const pageId = args.pageId as string;

    const response = await this.request<ListBlockChildrenResponse>(
      "GET",
      `/blocks/${pageId}/children?page_size=100`
    );

    const textParts: string[] = [];

    for (const block of response.results) {
      if (!("type" in block)) continue;

      const text = this.extractBlockText(block);
      if (text) textParts.push(text);
    }

    return { pageId, content: textParts.join("\n") };
  }

  private async toolGetMeetingContext(args: Record<string, unknown>) {
    const query = args.query as string;
    const maxPages = Math.min((args.maxPages as number) || 2, 5);

    // First search for relevant pages
    const searchResult = await this.toolSearch({ query, limit: maxPages + 2 });
    const pages = searchResult.pages.slice(0, maxPages);

    if (pages.length === 0) {
      return {
        query,
        found: false,
        message: "No relevant pages found in Notion",
      };
    }

    // Get content from each page
    const contextParts: string[] = [];
    for (const page of pages) {
      try {
        const { content } = await this.toolGetPageContent({ pageId: page.id });
        if (content) {
          contextParts.push(`## ${page.title}\n${content.slice(0, 2000)}`);
        }
      } catch {
        // Skip pages we can't read
      }
    }

    return {
      query,
      found: true,
      pageCount: pages.length,
      pages: pages.map((p) => ({ id: p.id, title: p.title, url: p.url })),
      context: contextParts.join("\n\n"),
    };
  }

  private async toolListDatabases() {
    const response = await this.request<SearchResponse>("POST", "/search", {
      filter: { property: "object", value: "database" },
      page_size: 20,
    });

    const databases = response.results.flatMap((result) => {
      if (result.object !== "database" || !("title" in result)) {
        return [];
      }

      const db = result as {
        id: string;
        title: Array<{ plain_text: string }>;
        icon?: { type: string; emoji?: string };
      };

      const title = db.title.map((t) => t.plain_text).join("");
      if (!title) return [];

      return [
        {
          id: db.id,
          title,
          icon: db.icon?.type === "emoji" ? db.icon.emoji : undefined,
        },
      ];
    });

    return { databases, count: databases.length };
  }

  private async toolSaveMeeting(args: Record<string, unknown>) {
    const databaseId = args.databaseId as string;
    const title = args.title as string;
    const date = args.date as string;
    const summary = args.summary as string | undefined;
    const actionItems = (args.actionItems as Array<{ text: string; done?: boolean }>) || [];
    const transcript = args.transcript as string | undefined;

    // Get database schema
    const database = await this.request<GetDatabaseResponse>("GET", `/databases/${databaseId}`);

    if (!("properties" in database)) {
      throw new Error("Could not retrieve database properties");
    }

    const properties = database.properties;

    // Build properties
    const pageProperties: Record<string, unknown> = {};

    // Find and set title property
    for (const [key, prop] of Object.entries(properties)) {
      if (prop.type === "title") {
        pageProperties[key] = {
          title: [{ text: { content: title } }],
        };
        break;
      }
    }

    // Try to set date
    for (const [key, prop] of Object.entries(properties)) {
      if (prop.type === "date" && key.toLowerCase().includes("date")) {
        pageProperties[key] = { date: { start: date } };
        break;
      }
    }

    // Build page content
    const children: BlockObjectRequest[] = [];

    if (summary) {
      children.push({
        type: "heading_2",
        heading_2: {
          rich_text: [{ type: "text", text: { content: "Summary" } }],
        },
      });
      children.push({
        type: "paragraph",
        paragraph: {
          rich_text: [{ type: "text", text: { content: summary } }],
        },
      });
    }

    if (actionItems.length > 0) {
      children.push({
        type: "heading_2",
        heading_2: {
          rich_text: [{ type: "text", text: { content: "Action Items" } }],
        },
      });

      for (const item of actionItems) {
        children.push({
          type: "to_do",
          to_do: {
            rich_text: [{ type: "text", text: { content: item.text } }],
            checked: item.done ?? false,
          },
        });
      }
    }

    if (transcript) {
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
                rich_text: [{ type: "text", text: { content: transcript.slice(0, 1900) } }],
              },
            },
          ],
        },
      });
    }

    const page = await this.request<PageObjectResponse>("POST", "/pages", {
      parent: { database_id: databaseId },
      properties: pageProperties,
      children,
    });

    return {
      success: true,
      pageId: page.id,
      url: `https://notion.so/${page.id.replace(/-/g, "")}`,
    };
  }

  private extractPageTitle(properties: Record<string, unknown>): string | null {
    for (const prop of Object.values(properties)) {
      const p = prop as { type?: string; title?: Array<{ plain_text: string }> };
      if (p.type === "title" && p.title) {
        return p.title.map((t) => t.plain_text).join("");
      }
    }
    return null;
  }

  private extractBlockText(block: { type: string; [key: string]: unknown }): string | null {
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
    ];

    for (const type of richTextTypes) {
      if (block.type === type && type in block) {
        const content = block[type] as { rich_text?: Array<{ plain_text: string }> };
        if (content?.rich_text) {
          return content.rich_text.map((t) => t.plain_text).join("");
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
      return text ? `${checkbox} ${text}` : null;
    }

    return null;
  }
}

// Main: Run as stdio MCP server
async function main() {
  const server = new NotionMCPServer();
  const decoder = new TextDecoder();
  let buffer = "";

  // Send initialized notification after receiving initialize
  const sendNotification = (notification: MCPNotification) => {
    const message = JSON.stringify(notification);
    process.stdout.write(`Content-Length: ${Buffer.byteLength(message)}\r\n\r\n${message}`);
  };

  const sendResponse = (response: MCPResponse) => {
    const message = JSON.stringify(response);
    process.stdout.write(`Content-Length: ${Buffer.byteLength(message)}\r\n\r\n${message}`);
  };

  process.stdin.on("data", async (chunk: Buffer) => {
    buffer += decoder.decode(chunk, { stream: true });

    // Parse Content-Length header and extract messages
    while (true) {
      const headerMatch = buffer.match(/^Content-Length: (\d+)\r\n\r\n/);
      if (!headerMatch) break;

      const contentLength = parseInt(headerMatch[1], 10);
      const headerLength = headerMatch[0].length;
      const totalLength = headerLength + contentLength;

      if (buffer.length < totalLength) break;

      const content = buffer.slice(headerLength, totalLength);
      buffer = buffer.slice(totalLength);

      try {
        const request = JSON.parse(content) as MCPRequest;
        const response = await server.handleRequest(request);
        sendResponse(response);

        // Send initialized notification after initialize
        if (request.method === "initialize") {
          sendNotification({ jsonrpc: "2.0", method: "notifications/initialized" });
        }
      } catch (error) {
        console.error("Failed to parse request:", error);
      }
    }
  });

  process.stdin.on("end", () => {
    process.exit(0);
  });
}

main().catch(console.error);
