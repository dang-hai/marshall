export { NotionClient, createNotionClient } from "./client.js";
export type {
  NotionClientConfig,
  SearchOptions,
  QueryDatabaseOptions,
  CreatePageOptions,
  UpdatePageOptions,
  AppendBlocksOptions,
  UpdateBlockOptions,
} from "./client.js";

export { blocks, properties } from "./blocks.js";

export { isFullPage, isFullBlock, isFullDatabase } from "./types.js";

export type {
  BlockObjectRequest,
  BlockObjectResponse,
  GetBlockResponse,
  ListBlockChildrenResponse,
  AppendBlockChildrenParameters,
  AppendBlockChildrenResponse,
  UpdateBlockParameters,
  UpdateBlockResponse,
  PageObjectResponse,
  GetPageResponse,
  CreatePageParameters,
  CreatePageResponse,
  UpdatePageParameters,
  UpdatePageResponse,
  GetDatabaseResponse,
  QueryDatabaseParameters,
  QueryDatabaseResponse,
  SearchParameters,
  SearchResponse,
  PropertyValueRequest,
  PropertyValueResponse,
  RichTextItemRequest,
  RichTextItemResponse,
} from "./types.js";
