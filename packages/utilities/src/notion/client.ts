import { Client, isFullPage, isFullBlock, isFullDatabase } from "@notionhq/client";
import type {
  SearchParameters,
  SearchResponse,
  QueryDatabaseParameters,
  QueryDatabaseResponse,
  GetPageResponse,
  CreatePageParameters,
  CreatePageResponse,
  UpdatePageParameters,
  UpdatePageResponse,
  GetBlockResponse,
  ListBlockChildrenResponse,
  AppendBlockChildrenParameters,
  AppendBlockChildrenResponse,
  UpdateBlockParameters,
  UpdateBlockResponse,
  GetDatabaseResponse,
  BlockObjectRequest,
} from "@notionhq/client/build/src/api-endpoints";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

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
  private client: Client;

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
    this.client = new Client({ auth });
  }

  // ============ Search ============

  async search(options: SearchOptions = {}): Promise<SearchResponse> {
    const params: SearchParameters = {};

    if (options.query) params.query = options.query;
    if (options.filter) params.filter = options.filter;
    if (options.sort) params.sort = options.sort;
    if (options.pageSize) params.page_size = options.pageSize;
    if (options.startCursor) params.start_cursor = options.startCursor;

    return this.client.search(params);
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
    return this.client.pages.retrieve({ page_id: pageId });
  }

  async createPage(options: CreatePageOptions): Promise<CreatePageResponse> {
    const params: CreatePageParameters = {
      parent:
        options.parentType === "database"
          ? { database_id: options.parentId }
          : { page_id: options.parentId },
      properties: options.properties || {},
    };

    if (options.children) params.children = options.children;
    if (options.icon) params.icon = options.icon;
    if (options.cover) params.cover = options.cover;

    return this.client.pages.create(params);
  }

  async updatePage(options: UpdatePageOptions): Promise<UpdatePageResponse> {
    const params: UpdatePageParameters = {
      page_id: options.pageId,
    };

    if (options.properties) params.properties = options.properties;
    if (options.archived !== undefined) params.archived = options.archived;
    if (options.icon) params.icon = options.icon;
    if (options.cover) params.cover = options.cover;

    return this.client.pages.update(params);
  }

  async archivePage(pageId: string): Promise<UpdatePageResponse> {
    return this.updatePage({ pageId, archived: true });
  }

  async restorePage(pageId: string): Promise<UpdatePageResponse> {
    return this.updatePage({ pageId, archived: false });
  }

  // ============ Blocks ============

  async getBlock(blockId: string): Promise<GetBlockResponse> {
    return this.client.blocks.retrieve({ block_id: blockId });
  }

  async getBlockChildren(
    blockId: string,
    pageSize = 100,
    startCursor?: string
  ): Promise<ListBlockChildrenResponse> {
    return this.client.blocks.children.list({
      block_id: blockId,
      page_size: pageSize,
      start_cursor: startCursor,
    });
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
    const params: AppendBlockChildrenParameters = {
      block_id: options.blockId,
      children: options.children,
    };

    if (options.after) params.after = options.after;

    return this.client.blocks.children.append(params);
  }

  async updateBlock(options: UpdateBlockOptions): Promise<UpdateBlockResponse> {
    return this.client.blocks.update({
      block_id: options.blockId,
      ...options.block,
    });
  }

  async deleteBlock(blockId: string): Promise<UpdateBlockResponse> {
    return this.client.blocks.update({
      block_id: blockId,
      archived: true,
    });
  }

  // ============ Databases ============

  async getDatabase(databaseId: string): Promise<GetDatabaseResponse> {
    return this.client.databases.retrieve({ database_id: databaseId });
  }

  async queryDatabase(options: QueryDatabaseOptions): Promise<QueryDatabaseResponse> {
    const params: QueryDatabaseParameters = {
      database_id: options.databaseId,
    };

    if (options.filter) params.filter = options.filter;
    if (options.sorts) params.sorts = options.sorts;
    if (options.pageSize) params.page_size = options.pageSize;
    if (options.startCursor) params.start_cursor = options.startCursor;

    return this.client.databases.query(params);
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
      if (prop.type === "title" && prop.title.length > 0) {
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
