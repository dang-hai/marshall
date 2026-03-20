/**
 * Notion API types for REST API integration.
 * These types mirror the Notion API response/request structures.
 */

// ============ Rich Text ============

export interface RichTextItemRequest {
  type: "text";
  text: {
    content: string;
    link?: { url: string } | null;
  };
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
    color?: string;
  };
}

export interface RichTextItemResponse {
  type: "text";
  text: {
    content: string;
    link: { url: string } | null;
  };
  annotations: {
    bold: boolean;
    italic: boolean;
    strikethrough: boolean;
    underline: boolean;
    code: boolean;
    color: string;
  };
  plain_text: string;
  href: string | null;
}

// ============ Blocks ============

export interface BlockObjectRequest {
  type: string;
  [key: string]: unknown;
}

export interface BlockObjectResponse {
  object: "block";
  id: string;
  parent:
    | { type: "page_id"; page_id: string }
    | { type: "block_id"; block_id: string }
    | { type: "database_id"; database_id: string }
    | { type: "workspace"; workspace: true };
  type: string;
  created_time: string;
  created_by: { object: "user"; id: string };
  last_edited_time: string;
  last_edited_by: { object: "user"; id: string };
  has_children: boolean;
  archived: boolean;
  in_trash: boolean;
  [key: string]: unknown;
}

export interface PartialBlockObjectResponse {
  object: "block";
  id: string;
}

export type GetBlockResponse = BlockObjectResponse | PartialBlockObjectResponse;

export interface ListBlockChildrenResponse {
  object: "list";
  results: GetBlockResponse[];
  next_cursor: string | null;
  has_more: boolean;
  type: "block";
  block: Record<string, never>;
}

export interface AppendBlockChildrenParameters {
  block_id: string;
  children: BlockObjectRequest[];
  after?: string;
}

export interface AppendBlockChildrenResponse {
  object: "list";
  results: BlockObjectResponse[];
  next_cursor: string | null;
  has_more: boolean;
  type: "block";
  block: Record<string, never>;
}

export interface UpdateBlockParameters {
  block_id: string;
  archived?: boolean;
  [key: string]: unknown;
}

export type UpdateBlockResponse = BlockObjectResponse;

// ============ Pages ============

export interface PageObjectResponse {
  object: "page";
  id: string;
  created_time: string;
  created_by: { object: "user"; id: string };
  last_edited_time: string;
  last_edited_by: { object: "user"; id: string };
  cover:
    | { type: "external"; external: { url: string } }
    | { type: "file"; file: { url: string; expiry_time: string } }
    | null;
  icon:
    | { type: "emoji"; emoji: string }
    | { type: "external"; external: { url: string } }
    | { type: "file"; file: { url: string; expiry_time: string } }
    | null;
  parent:
    | { type: "database_id"; database_id: string }
    | { type: "page_id"; page_id: string }
    | { type: "block_id"; block_id: string }
    | { type: "workspace"; workspace: true };
  archived: boolean;
  in_trash: boolean;
  properties: Record<string, PropertyValueResponse>;
  url: string;
  public_url: string | null;
}

export interface PartialPageObjectResponse {
  object: "page";
  id: string;
}

export type GetPageResponse = PageObjectResponse | PartialPageObjectResponse;

export interface CreatePageParameters {
  parent: { database_id: string } | { page_id: string };
  properties: Record<string, PropertyValueRequest>;
  children?: BlockObjectRequest[];
  icon?: { type: "emoji"; emoji: string } | { type: "external"; external: { url: string } };
  cover?: { type: "external"; external: { url: string } };
}

export type CreatePageResponse = PageObjectResponse;

export interface UpdatePageParameters {
  page_id: string;
  properties?: Record<string, PropertyValueRequest>;
  archived?: boolean;
  icon?: { type: "emoji"; emoji: string } | { type: "external"; external: { url: string } } | null;
  cover?: { type: "external"; external: { url: string } } | null;
}

export type UpdatePageResponse = PageObjectResponse;

// ============ Property Values ============

export type PropertyValueRequest =
  | { title: Array<{ text: { content: string } }> }
  | { rich_text: Array<{ text: { content: string } }> }
  | { number: number }
  | { select: { name: string } | { id: string } }
  | { multi_select: Array<{ name: string } | { id: string }> }
  | { date: { start: string; end?: string | null; time_zone?: string | null } }
  | { checkbox: boolean }
  | { url: string }
  | { email: string }
  | { phone_number: string }
  | { relation: Array<{ id: string }> }
  | { people: Array<{ id: string }> }
  | { status: { name: string } | { id: string } }
  | Record<string, unknown>;

export interface PropertyValueResponse {
  id: string;
  type: string;
  title?: RichTextItemResponse[];
  rich_text?: RichTextItemResponse[];
  number?: number | null;
  select?: { id: string; name: string; color: string } | null;
  multi_select?: Array<{ id: string; name: string; color: string }>;
  date?: { start: string; end: string | null; time_zone: string | null } | null;
  checkbox?: boolean;
  url?: string | null;
  email?: string | null;
  phone_number?: string | null;
  created_time?: string;
  created_by?: { object: "user"; id: string };
  last_edited_time?: string;
  last_edited_by?: { object: "user"; id: string };
  formula?: unknown;
  rollup?: unknown;
  relation?: Array<{ id: string }>;
  people?: Array<{ object: "user"; id: string }>;
  files?: unknown[];
  status?: { id: string; name: string; color: string } | null;
  [key: string]: unknown;
}

// ============ Databases ============

export interface DatabaseObjectResponse {
  object: "database";
  id: string;
  created_time: string;
  created_by: { object: "user"; id: string };
  last_edited_time: string;
  last_edited_by: { object: "user"; id: string };
  title: RichTextItemResponse[];
  description: RichTextItemResponse[];
  icon:
    | { type: "emoji"; emoji: string }
    | { type: "external"; external: { url: string } }
    | { type: "file"; file: { url: string; expiry_time: string } }
    | null;
  cover:
    | { type: "external"; external: { url: string } }
    | { type: "file"; file: { url: string; expiry_time: string } }
    | null;
  properties: Record<string, DatabasePropertyConfigResponse>;
  parent:
    | { type: "page_id"; page_id: string }
    | { type: "block_id"; block_id: string }
    | { type: "workspace"; workspace: true };
  url: string;
  public_url: string | null;
  archived: boolean;
  in_trash: boolean;
  is_inline: boolean;
}

export interface PartialDatabaseObjectResponse {
  object: "database";
  id: string;
}

export type GetDatabaseResponse = DatabaseObjectResponse | PartialDatabaseObjectResponse;

export interface DatabasePropertyConfigResponse {
  id: string;
  name: string;
  type: string;
  [key: string]: unknown;
}

export interface QueryDatabaseParameters {
  database_id: string;
  filter?: unknown;
  sorts?: unknown;
  start_cursor?: string;
  page_size?: number;
}

export interface QueryDatabaseResponse {
  object: "list";
  results: GetPageResponse[];
  next_cursor: string | null;
  has_more: boolean;
  type: "page_or_database";
  page_or_database: Record<string, never>;
}

// ============ Search ============

export interface SearchParameters {
  query?: string;
  filter?: {
    property: "object";
    value: "page" | "database";
  };
  sort?: {
    direction: "ascending" | "descending";
    timestamp: "last_edited_time";
  };
  start_cursor?: string;
  page_size?: number;
}

export interface SearchResponse {
  object: "list";
  results: Array<
    | PageObjectResponse
    | DatabaseObjectResponse
    | PartialPageObjectResponse
    | PartialDatabaseObjectResponse
  >;
  next_cursor: string | null;
  has_more: boolean;
  type: "page_or_database";
  page_or_database: Record<string, never>;
}

// ============ Type Guards ============

export function isFullPage(response: GetPageResponse): response is PageObjectResponse {
  return "properties" in response;
}

export function isFullBlock(response: GetBlockResponse): response is BlockObjectResponse {
  return "type" in response && "has_children" in response;
}

export function isFullDatabase(response: GetDatabaseResponse): response is DatabaseObjectResponse {
  return "title" in response && "properties" in response;
}
