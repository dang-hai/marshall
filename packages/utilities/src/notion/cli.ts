#!/usr/bin/env node

import { NotionClient } from "./client.js";
import type { BlockObjectRequest } from "@notionhq/client/build/src/api-endpoints";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

interface StoredNotionToken {
  accessToken: string;
  botId: string;
  workspaceId: string;
  workspaceName: string | null;
  workspaceIcon: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  createdAt: string;
}

function getMarshallIntegrationsPath(): string {
  const platform = process.platform;
  if (platform === "darwin") {
    return join(
      homedir(),
      "Library",
      "Application Support",
      "marshall",
      "marshall-integrations.json"
    );
  } else if (platform === "win32") {
    return join(
      process.env.APPDATA || join(homedir(), "AppData", "Roaming"),
      "marshall",
      "marshall-integrations.json"
    );
  } else {
    return join(
      process.env.XDG_CONFIG_HOME || join(homedir(), ".config"),
      "marshall",
      "marshall-integrations.json"
    );
  }
}

function getStoredNotionToken(): StoredNotionToken | null {
  try {
    const configPath = getMarshallIntegrationsPath();
    if (!existsSync(configPath)) {
      return null;
    }
    const data = JSON.parse(readFileSync(configPath, "utf-8")) as {
      notion?: StoredNotionToken | null;
    };
    return data.notion ?? null;
  } catch {
    return null;
  }
}

interface CliOptions {
  json: boolean;
  pageSize?: number;
  cursor?: string;
  recursive?: boolean;
  depth?: number;
}

interface CliResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

function parseArgs(args: string[]): {
  command: string;
  subcommand?: string;
  args: string[];
  options: CliOptions;
} {
  const options: CliOptions = { json: false };
  const positionalArgs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--json" || arg === "-j") {
      options.json = true;
    } else if (arg === "--page-size" || arg === "-n") {
      options.pageSize = parseInt(args[++i], 10);
    } else if (arg === "--cursor" || arg === "-c") {
      options.cursor = args[++i];
    } else if (arg === "--recursive" || arg === "-r") {
      options.recursive = true;
    } else if (arg === "--depth" || arg === "-d") {
      options.depth = parseInt(args[++i], 10);
    } else if (!arg.startsWith("-")) {
      positionalArgs.push(arg);
    }
  }

  const [command, subcommand, ...rest] = positionalArgs;
  return { command, subcommand, args: rest, options };
}

function output(result: CliResult, options: CliOptions): void {
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (result.success) {
    if (result.data) {
      console.log(JSON.stringify(result.data, null, 2));
    }
  } else {
    console.error(`Error: ${result.error}`);
    process.exit(1);
  }
}

function success(data: unknown): CliResult {
  return { success: true, data };
}

function error(message: string): CliResult {
  return { success: false, error: message };
}

// ============ Command Handlers ============

async function handleSearch(
  client: NotionClient,
  args: string[],
  options: CliOptions
): Promise<CliResult> {
  const query = args[0];
  const result = await client.search({
    query,
    pageSize: options.pageSize || 100,
    startCursor: options.cursor,
  });
  return success(result);
}

async function handleSearchPages(
  client: NotionClient,
  args: string[],
  options: CliOptions
): Promise<CliResult> {
  const query = args[0];
  const result = await client.searchPages(query, options.pageSize || 100);
  return success(result);
}

async function handleSearchDatabases(
  client: NotionClient,
  args: string[],
  options: CliOptions
): Promise<CliResult> {
  const query = args[0];
  const result = await client.searchDatabases(query, options.pageSize || 100);
  return success(result);
}

async function handlePageGet(
  client: NotionClient,
  args: string[],
  options: CliOptions
): Promise<CliResult> {
  const pageId = args[0];
  if (!pageId) return error("Page ID required");

  if (options.recursive) {
    const result = await client.getPageContentRecursive(pageId, options.depth || 3);
    return success(result);
  }

  const result = await client.getPageContent(pageId);
  return success(result);
}

async function handlePageCreate(client: NotionClient, args: string[]): Promise<CliResult> {
  // Expects JSON input from stdin or as argument
  const jsonInput = args[0] || (await readStdin());
  if (!jsonInput) return error("JSON input required (pass as argument or via stdin)");

  try {
    const input = JSON.parse(jsonInput);
    const { parentId, parentType, properties, children, icon, cover } = input;

    if (!parentId) return error("parentId required in JSON input");
    if (!parentType) return error("parentType (database or page) required in JSON input");

    const result = await client.createPage({
      parentId,
      parentType,
      properties,
      children,
      icon,
      cover,
    });
    return success(result);
  } catch (e) {
    return error(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function handlePageUpdate(client: NotionClient, args: string[]): Promise<CliResult> {
  const pageId = args[0];
  const jsonInput = args[1] || (await readStdin());

  if (!pageId) return error("Page ID required");
  if (!jsonInput) return error("JSON input required for properties");

  try {
    const input = JSON.parse(jsonInput);
    const result = await client.updatePage({
      pageId,
      properties: input.properties,
      archived: input.archived,
      icon: input.icon,
      cover: input.cover,
    });
    return success(result);
  } catch (e) {
    return error(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function handlePageArchive(client: NotionClient, args: string[]): Promise<CliResult> {
  const pageId = args[0];
  if (!pageId) return error("Page ID required");
  const result = await client.archivePage(pageId);
  return success(result);
}

async function handlePageRestore(client: NotionClient, args: string[]): Promise<CliResult> {
  const pageId = args[0];
  if (!pageId) return error("Page ID required");
  const result = await client.restorePage(pageId);
  return success(result);
}

async function handleBlockGet(
  client: NotionClient,
  args: string[],
  _options: CliOptions
): Promise<CliResult> {
  const blockId = args[0];
  if (!blockId) return error("Block ID required");
  const result = await client.getBlock(blockId);
  return success(result);
}

async function handleBlockChildren(
  client: NotionClient,
  args: string[],
  options: CliOptions
): Promise<CliResult> {
  const blockId = args[0];
  if (!blockId) return error("Block ID required");

  if (options.cursor) {
    const result = await client.getBlockChildren(blockId, options.pageSize || 100, options.cursor);
    return success(result);
  }

  const result = await client.getAllBlockChildren(blockId);
  return success({ results: result });
}

async function handleBlockAppend(client: NotionClient, args: string[]): Promise<CliResult> {
  const blockId = args[0];
  const jsonInput = args[1] || (await readStdin());

  if (!blockId) return error("Block ID required");
  if (!jsonInput) return error("JSON input required for children blocks");

  try {
    const input = JSON.parse(jsonInput);
    const children: BlockObjectRequest[] = Array.isArray(input) ? input : input.children;
    if (!children || !Array.isArray(children)) {
      return error("children array required in JSON input");
    }

    const result = await client.appendBlocks({
      blockId,
      children,
      after: input.after,
    });
    return success(result);
  } catch (e) {
    return error(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function handleBlockUpdate(client: NotionClient, args: string[]): Promise<CliResult> {
  const blockId = args[0];
  const jsonInput = args[1] || (await readStdin());

  if (!blockId) return error("Block ID required");
  if (!jsonInput) return error("JSON input required for block update");

  try {
    const input = JSON.parse(jsonInput);
    const result = await client.updateBlock({
      blockId,
      block: input,
    });
    return success(result);
  } catch (e) {
    return error(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function handleBlockDelete(client: NotionClient, args: string[]): Promise<CliResult> {
  const blockId = args[0];
  if (!blockId) return error("Block ID required");
  const result = await client.deleteBlock(blockId);
  return success(result);
}

async function handleDatabaseGet(client: NotionClient, args: string[]): Promise<CliResult> {
  const databaseId = args[0];
  if (!databaseId) return error("Database ID required");
  const result = await client.getDatabase(databaseId);
  return success(result);
}

async function handleDatabaseQuery(
  client: NotionClient,
  args: string[],
  options: CliOptions
): Promise<CliResult> {
  const databaseId = args[0];
  const jsonInput = args[1] || (await readStdin());

  if (!databaseId) return error("Database ID required");

  let filter, sorts;
  if (jsonInput) {
    try {
      const input = JSON.parse(jsonInput);
      filter = input.filter;
      sorts = input.sorts;
    } catch (e) {
      return error(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const result = await client.queryDatabase({
    databaseId,
    filter,
    sorts,
    pageSize: options.pageSize || 100,
    startCursor: options.cursor,
  });
  return success(result);
}

async function handleDatabaseQueryAll(client: NotionClient, args: string[]): Promise<CliResult> {
  const databaseId = args[0];
  const jsonInput = args[1] || (await readStdin());

  if (!databaseId) return error("Database ID required");

  let filter, sorts;
  if (jsonInput) {
    try {
      const input = JSON.parse(jsonInput);
      filter = input.filter;
      sorts = input.sorts;
    } catch (e) {
      return error(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const result = await client.queryAllDatabasePages({
    databaseId,
    filter,
    sorts,
  });
  return success({ results: result });
}

// ============ Utility Functions ============

async function readStdin(): Promise<string | null> {
  if (process.stdin.isTTY) return null;

  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const input = Buffer.concat(chunks).toString("utf-8").trim();
  return input || null;
}

function printHelp(): void {
  console.log(`
Notion CLI - Full JSON support for agent integration

USAGE:
  notion <command> [subcommand] [args] [options]

GLOBAL OPTIONS:
  --json, -j          Output full JSON response with success/error wrapper
  --page-size, -n     Number of results per page (default: 100)
  --cursor, -c        Pagination cursor for continued queries
  --recursive, -r     Fetch nested content (for page get)
  --depth, -d         Max depth for recursive fetch (default: 3)

COMMANDS:

  status                            Show connection status (no auth required)

  search [query]                    Search all pages and databases
  search pages [query]              Search only pages
  search databases [query]          Search only databases

  page get <page_id>                Get page with content
    -r, --recursive                 Include nested block children
    -d, --depth <n>                 Max recursion depth

  page create <json>                Create a new page
    JSON: { parentId, parentType: "database"|"page", properties?, children?, icon?, cover? }

  page update <page_id> <json>      Update page properties
    JSON: { properties?, archived?, icon?, cover? }

  page archive <page_id>            Archive (soft delete) a page
  page restore <page_id>            Restore an archived page

  block get <block_id>              Get a single block
  block children <block_id>         List all children of a block
  block append <block_id> <json>    Append children blocks
    JSON: { children: [...blocks], after?: "block_id" } or [...blocks]

  block update <block_id> <json>    Update a block
  block delete <block_id>           Delete (archive) a block

  database get <database_id>        Get database schema
  database query <database_id> [json]
                                    Query database with filter/sorts
    JSON: { filter?, sorts? }

  database query-all <database_id> [json]
                                    Query all pages (auto-paginate)

AUTHENTICATION:
  Token is resolved in this order:
    1. NOTION_API_KEY or NOTION_TOKEN environment variable
    2. Token stored by Marshall desktop app (via OAuth)

  To connect via Marshall:
    1. Open Marshall desktop app
    2. Go to Settings > Integrations > Connect Notion
    3. Authorize access to your workspace

EXAMPLES:
  # Check connection status
  notion status --json

  # Search for pages containing "meeting"
  notion search pages "meeting" --json

  # Get page content
  notion page get abc123 --recursive --depth 5 --json

  # Create a page in a database
  echo '{"parentId":"db-id","parentType":"database","properties":{"Name":{"title":[{"text":{"content":"New Page"}}]}}}' | notion page create --json

  # Query database with filter
  notion database query db-id '{"filter":{"property":"Status","select":{"equals":"Done"}}}' --json

  # Append content to a page
  notion block append page-id '[{"paragraph":{"rich_text":[{"text":{"content":"Hello world"}}]}}]' --json
`);
}

// ============ Main ============

function handleStatus(_options: CliOptions): CliResult {
  const storedToken = getStoredNotionToken();
  const envToken = process.env.NOTION_API_KEY || process.env.NOTION_TOKEN;

  const status = {
    connected: !!(storedToken || envToken),
    source: storedToken ? "marshall" : envToken ? "environment" : null,
    marshallStorePath: getMarshallIntegrationsPath(),
    marshall: storedToken
      ? {
          workspaceId: storedToken.workspaceId,
          workspaceName: storedToken.workspaceName,
          botId: storedToken.botId,
          ownerName: storedToken.ownerName,
          ownerEmail: storedToken.ownerEmail,
          connectedAt: storedToken.createdAt,
        }
      : null,
    environment: envToken ? { hasToken: true } : null,
  };

  return success(status);
}

async function main(): Promise<void> {
  const { command, subcommand, args, options } = parseArgs(process.argv.slice(2));

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    process.exit(0);
  }

  // Status command doesn't require authentication
  if (command === "status") {
    output(handleStatus(options), options);
    return;
  }

  let client: NotionClient;
  try {
    client = new NotionClient();
  } catch (e) {
    output(error(e instanceof Error ? e.message : String(e)), options);
    return;
  }

  try {
    let result: CliResult;

    switch (command) {
      case "search":
        if (subcommand === "pages") {
          result = await handleSearchPages(client, args, options);
        } else if (subcommand === "databases") {
          result = await handleSearchDatabases(client, args, options);
        } else {
          // subcommand might be the query itself
          result = await handleSearch(client, subcommand ? [subcommand, ...args] : args, options);
        }
        break;

      case "page":
        switch (subcommand) {
          case "get":
            result = await handlePageGet(client, args, options);
            break;
          case "create":
            result = await handlePageCreate(client, args);
            break;
          case "update":
            result = await handlePageUpdate(client, args);
            break;
          case "archive":
            result = await handlePageArchive(client, args);
            break;
          case "restore":
            result = await handlePageRestore(client, args);
            break;
          default:
            result = error(`Unknown page subcommand: ${subcommand}`);
        }
        break;

      case "block":
        switch (subcommand) {
          case "get":
            result = await handleBlockGet(client, args, options);
            break;
          case "children":
            result = await handleBlockChildren(client, args, options);
            break;
          case "append":
            result = await handleBlockAppend(client, args);
            break;
          case "update":
            result = await handleBlockUpdate(client, args);
            break;
          case "delete":
            result = await handleBlockDelete(client, args);
            break;
          default:
            result = error(`Unknown block subcommand: ${subcommand}`);
        }
        break;

      case "database":
      case "db":
        switch (subcommand) {
          case "get":
            result = await handleDatabaseGet(client, args);
            break;
          case "query":
            result = await handleDatabaseQuery(client, args, options);
            break;
          case "query-all":
            result = await handleDatabaseQueryAll(client, args);
            break;
          default:
            result = error(`Unknown database subcommand: ${subcommand}`);
        }
        break;

      default:
        result = error(`Unknown command: ${command}. Run 'notion help' for usage.`);
    }

    output(result, options);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    output(error(message), options);
  }
}

main();
