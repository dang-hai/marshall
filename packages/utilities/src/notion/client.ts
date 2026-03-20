import {
  isFullPage,
  isFullBlock,
  isFullDatabase,
  type SearchParameters,
  type SearchResponse,
  type QueryDatabaseParameters,
  type QueryDatabaseResponse,
  type GetPageResponse,
  type CreatePageParameters,
  type CreatePageResponse,
  type UpdatePageParameters,
  type UpdatePageResponse,
  type GetBlockResponse,
  type ListBlockChildrenResponse,
  type AppendBlockChildrenParameters,
  type AppendBlockChildrenResponse,
  type UpdateBlockParameters,
  type UpdateBlockResponse,
  type GetDatabaseResponse,
  type BlockObjectRequest,
} from "./types.js";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const NOTION_API_BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

export interface NotionClientConfig {
  auth?: string;
}

/**
 * Get the Notion token from Marshall's electron-store integration file.
 * This allows the CLI to use the token stored by the desktop app.
 */
export function getTokenFromMarshallStore(): string | null {
  try {
    // electron-store saves files in different locations per platform
    const platform = process.platform;
    let configPath: string;

    if (platform === "darwin") {
      configPath = join(
        homedir(),
        "Library",
        "Application Support",
        "marshall",
        "marshall-integrations.json"
      );
    } else if (platform === "win32") {
      configPath = join(
        process.env.APPDATA || join(homedir(), "AppData", "Roaming"),
        "marshall",
        "marshall-integrations.json"
      );
    } else {
      // Linux
      configPath = join(
        process.env.XDG_CONFIG_HOME || join(homedir(), ".config"),
        "marshall",
        "marshall-integrations.json"
      );
    }

    if (!existsSync(configPath)) {
      return null;
    }

    const data = JSON.parse(readFileSync(configPath, "utf-8")) as {
      notion?: { accessToken?: string } | null;
    };

    return data.notion?.accessToken ?? null;
  } catch {
    return null;
  }
}

export interface SearchOptions {
  query?: string;
  filter?: {
    property: "object";
    value: "page" | "database";
  };
  sort?: {
    direction: "ascending" | "descending";
    timestamp: "last_edited_time";
  };
  pageSize?: number;
  startCursor?: string;
}

export interface QueryDatabaseOptions {
  databaseId: string;
  filter?: QueryDatabaseParameters["filter"];
  sorts?: QueryDatabaseParameters["sorts"];
  pageSize?: number;
  startCursor?: string;
}

export interface CreatePageOptions {
  parentId: string;
  parentType: "database" | "page";
  properties?: CreatePageParameters["properties"];
  children?: BlockObjectRequest[];
  icon?: CreatePageParameters["icon"];
  cover?: CreatePageParameters["cover"];
}

export interface UpdatePageOptions {
  pageId: string;
  properties?: UpdatePageParameters["properties"];
  archived?: boolean;
  icon?: UpdatePageParameters["icon"];
  cover?: UpdatePageParameters["cover"];
}

export interface AppendBlocksOptions {
  blockId: string;
  children: BlockObjectRequest[];
  after?: string;
}

export interface UpdateBlockOptions {
  blockId: string;
  block: Omit<UpdateBlockParameters, "block_id">;
}

export class NotionClient {
  private auth: string;

  constructor(config: NotionClientConfig = {}) {
    // Priority: explicit config > env vars > Marshall desktop app token
    const auth =
      config.auth ||
      process.env.NOTION_API_KEY ||
      process.env.NOTION_TOKEN ||
      getTokenFromMarshallStore();

    if (!auth) {
      throw new Error(
        "Notion API key required. Either:\n" +
          "  1. Connect Notion in Marshall desktop app\n" +
          "  2. Set NOTION_API_KEY or NOTION_TOKEN environment variable\n" +
          "  3. Pass auth option to NotionClient"
      );
    }
    this.auth = auth;
  }

  private async request<T>(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${NOTION_API_BASE}${path}`;
    const options: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${this.auth}`,
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

  // ============ Search ============

  async search(options: SearchOptions = {}): Promise<SearchResponse> {
    const body: SearchParameters = {};

    if (options.query) body.query = options.query;
    if (options.filter) body.filter = options.filter;
    if (options.sort) body.sort = options.sort;
    if (options.pageSize) body.page_size = options.pageSize;
    if (options.startCursor) body.start_cursor = options.startCursor;

    return this.request<SearchResponse>("POST", "/search", body);
  }

  async searchPages(query?: string, pageSize = 100): Promise<SearchResponse> {
    return this.search({
      query,
      filter: { property: "object", value: "page" },
      pageSize,
    });
  }

  async searchDatabases(query?: string, pageSize = 100): Promise<SearchResponse> {
    return this.search({
      query,
      filter: { property: "object", value: "database" },
      pageSize,
    });
  }

  // ============ Pages ============

  async getPage(pageId: string): Promise<GetPageResponse> {
    return this.request<GetPageResponse>("GET", `/pages/${pageId}`);
  }

  async createPage(options: CreatePageOptions): Promise<CreatePageResponse> {
    const body: CreatePageParameters = {
      parent:
        options.parentType === "database"
          ? { database_id: options.parentId }
          : { page_id: options.parentId },
      properties: options.properties || {},
    };

    if (options.children) body.children = options.children;
    if (options.icon) body.icon = options.icon;
    if (options.cover) body.cover = options.cover;

    return this.request<CreatePageResponse>("POST", "/pages", body);
  }

  async updatePage(options: UpdatePageOptions): Promise<UpdatePageResponse> {
    const body: Omit<UpdatePageParameters, "page_id"> = {};

    if (options.properties) body.properties = options.properties;
    if (options.archived !== undefined) body.archived = options.archived;
    if (options.icon !== undefined) body.icon = options.icon;
    if (options.cover !== undefined) body.cover = options.cover;

    return this.request<UpdatePageResponse>("PATCH", `/pages/${options.pageId}`, body);
  }

  async archivePage(pageId: string): Promise<UpdatePageResponse> {
    return this.updatePage({ pageId, archived: true });
  }

  async restorePage(pageId: string): Promise<UpdatePageResponse> {
    return this.updatePage({ pageId, archived: false });
  }

  // ============ Blocks ============

  async getBlock(blockId: string): Promise<GetBlockResponse> {
    return this.request<GetBlockResponse>("GET", `/blocks/${blockId}`);
  }

  async getBlockChildren(
    blockId: string,
    pageSize = 100,
    startCursor?: string
  ): Promise<ListBlockChildrenResponse> {
    let path = `/blocks/${blockId}/children?page_size=${pageSize}`;
    if (startCursor) {
      path += `&start_cursor=${startCursor}`;
    }
    return this.request<ListBlockChildrenResponse>("GET", path);
  }

  async getAllBlockChildren(blockId: string): Promise<ListBlockChildrenResponse["results"]> {
    const allBlocks: ListBlockChildrenResponse["results"] = [];
    let cursor: string | undefined;

    do {
      const response = await this.getBlockChildren(blockId, 100, cursor);
      allBlocks.push(...response.results);
      cursor = response.next_cursor ?? undefined;
    } while (cursor);

    return allBlocks;
  }

  async appendBlocks(options: AppendBlocksOptions): Promise<AppendBlockChildrenResponse> {
    const body: Omit<AppendBlockChildrenParameters, "block_id"> = {
      children: options.children,
    };

    if (options.after) (body as { after?: string }).after = options.after;

    return this.request<AppendBlockChildrenResponse>(
      "PATCH",
      `/blocks/${options.blockId}/children`,
      body
    );
  }

  async updateBlock(options: UpdateBlockOptions): Promise<UpdateBlockResponse> {
    return this.request<UpdateBlockResponse>("PATCH", `/blocks/${options.blockId}`, options.block);
  }

  async deleteBlock(blockId: string): Promise<UpdateBlockResponse> {
    return this.request<UpdateBlockResponse>("PATCH", `/blocks/${blockId}`, {
      archived: true,
    });
  }

  // ============ Databases ============

  async getDatabase(databaseId: string): Promise<GetDatabaseResponse> {
    return this.request<GetDatabaseResponse>("GET", `/databases/${databaseId}`);
  }

  async queryDatabase(options: QueryDatabaseOptions): Promise<QueryDatabaseResponse> {
    const body: Omit<QueryDatabaseParameters, "database_id"> = {};

    if (options.filter) body.filter = options.filter;
    if (options.sorts) body.sorts = options.sorts;
    if (options.pageSize) body.page_size = options.pageSize;
    if (options.startCursor) body.start_cursor = options.startCursor;

    return this.request<QueryDatabaseResponse>(
      "POST",
      `/databases/${options.databaseId}/query`,
      body
    );
  }

  async queryAllDatabasePages(
    options: Omit<QueryDatabaseOptions, "pageSize" | "startCursor">
  ): Promise<QueryDatabaseResponse["results"]> {
    const allPages: QueryDatabaseResponse["results"] = [];
    let cursor: string | undefined;

    do {
      const response = await this.queryDatabase({
        ...options,
        pageSize: 100,
        startCursor: cursor,
      });
      allPages.push(...response.results);
      cursor = response.next_cursor ?? undefined;
    } while (cursor);

    return allPages;
  }

  // ============ Content Reading ============

  async getPageContent(pageId: string): Promise<{
    page: GetPageResponse;
    blocks: ListBlockChildrenResponse["results"];
  }> {
    const [page, blocks] = await Promise.all([
      this.getPage(pageId),
      this.getAllBlockChildren(pageId),
    ]);
    return { page, blocks };
  }

  async getPageContentRecursive(
    pageId: string,
    maxDepth = 3
  ): Promise<{
    page: GetPageResponse;
    blocks: Array<ListBlockChildrenResponse["results"][0] & { children?: unknown[] }>;
  }> {
    const page = await this.getPage(pageId);
    const blocks = await this.getBlocksRecursive(pageId, maxDepth);
    return { page, blocks };
  }

  private async getBlocksRecursive(
    blockId: string,
    maxDepth: number,
    currentDepth = 0
  ): Promise<Array<ListBlockChildrenResponse["results"][0] & { children?: unknown[] }>> {
    if (currentDepth >= maxDepth) {
      return [];
    }

    const blocks = await this.getAllBlockChildren(blockId);
    const blocksWithChildren: Array<
      ListBlockChildrenResponse["results"][0] & { children?: unknown[] }
    > = [];

    for (const block of blocks) {
      const blockWithChildren: ListBlockChildrenResponse["results"][0] & { children?: unknown[] } =
        { ...block };

      if (isFullBlock(block) && block.has_children) {
        blockWithChildren.children = await this.getBlocksRecursive(
          block.id,
          maxDepth,
          currentDepth + 1
        );
      }

      blocksWithChildren.push(blockWithChildren);
    }

    return blocksWithChildren;
  }

  // ============ Utility Methods ============

  isFullPage = isFullPage;
  isFullBlock = isFullBlock;
  isFullDatabase = isFullDatabase;

  extractPageTitle(page: GetPageResponse): string | null {
    if (!isFullPage(page)) return null;

    const properties = page.properties;
    for (const key of Object.keys(properties)) {
      const prop = properties[key];
      if (prop.type === "title" && prop.title && prop.title.length > 0) {
        return prop.title.map((t) => t.plain_text).join("");
      }
    }
    return null;
  }

  extractPlainText(blocks: ListBlockChildrenResponse["results"]): string {
    const textParts: string[] = [];

    for (const block of blocks) {
      if (!isFullBlock(block)) continue;

      const richTextBlocks = [
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

      for (const type of richTextBlocks) {
        if (block.type === type && type in block) {
          const content = block[type as keyof typeof block] as {
            rich_text?: Array<{ plain_text: string }>;
          };
          if (content?.rich_text) {
            const text = content.rich_text.map((t) => t.plain_text).join("");
            if (text) textParts.push(text);
          }
        }
      }

      if (block.type === "code" && "code" in block) {
        const code = block.code as { rich_text?: Array<{ plain_text: string }> };
        if (code?.rich_text) {
          textParts.push(code.rich_text.map((t) => t.plain_text).join(""));
        }
      }
    }

    return textParts.join("\n");
  }
}

export function createNotionClient(config?: NotionClientConfig): NotionClient {
  return new NotionClient(config);
}
