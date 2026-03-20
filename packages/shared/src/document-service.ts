/**
 * Document Service
 *
 * High-level service for agents to interact with notes using document blocks.
 * Wraps the document blocks API and provides database integration.
 */

import { loadDocument, type DocumentAPI } from "./document-blocks.js";

/**
 * Callback to persist the updated markdown.
 * Implement this to save to your database.
 */
export type SaveCallback = (markdown: string) => Promise<void>;

/**
 * Document session for a single note.
 * Tracks changes and batches saves.
 */
export interface DocumentSession {
  /** Document API for block operations */
  api: DocumentAPI;

  /** Save changes to database */
  save(): Promise<void>;

  /** Get current markdown without saving */
  getMarkdown(): string;

  /** Check if there are unsaved changes */
  isDirty(): boolean;
}

/**
 * Create a document session from markdown content.
 */
export function createSession(markdown: string, onSave: SaveCallback): DocumentSession {
  const api = loadDocument(markdown);
  let lastSaved = markdown;

  return {
    api,

    async save() {
      const current = api.toMarkdown();
      if (current !== lastSaved) {
        await onSave(current);
        lastSaved = current;
      }
    },

    getMarkdown() {
      return api.toMarkdown();
    },

    isDirty() {
      return api.toMarkdown() !== lastSaved;
    },
  };
}

/**
 * Agent-friendly operation types.
 * These map to LLM function calling schemas.
 */
export type AgentOperation =
  | { op: "checklist.toggle"; blockId: string; index: number }
  | { op: "checklist.check"; blockId: string; index: number }
  | { op: "checklist.uncheck"; blockId: string; index: number }
  | { op: "checklist.add"; blockId: string; text: string }
  | { op: "checklist.remove"; blockId: string; index: number }
  | { op: "section.set"; blockId: string; content: string }
  | { op: "section.append"; blockId: string; content: string }
  | { op: "section.prepend"; blockId: string; content: string }
  | { op: "section.clear"; blockId: string }
  | { op: "status.set"; blockId: string; value: string };

/**
 * Execute an agent operation on a document.
 */
export function executeOperation(api: DocumentAPI, operation: AgentOperation): void {
  switch (operation.op) {
    case "checklist.toggle":
      api.checklist(operation.blockId).toggle(operation.index);
      break;
    case "checklist.check":
      api.checklist(operation.blockId).check(operation.index);
      break;
    case "checklist.uncheck":
      api.checklist(operation.blockId).uncheck(operation.index);
      break;
    case "checklist.add":
      api.checklist(operation.blockId).add(operation.text);
      break;
    case "checklist.remove":
      api.checklist(operation.blockId).remove(operation.index);
      break;
    case "section.set":
      api.section(operation.blockId).set(operation.content);
      break;
    case "section.append":
      api.section(operation.blockId).append(operation.content);
      break;
    case "section.prepend":
      api.section(operation.blockId).prepend(operation.content);
      break;
    case "section.clear":
      api.section(operation.blockId).clear();
      break;
    case "status.set":
      api.status(operation.blockId).set(operation.value);
      break;
  }
}

/**
 * Execute multiple operations in sequence.
 */
export function executeOperations(api: DocumentAPI, operations: AgentOperation[]): void {
  for (const op of operations) {
    executeOperation(api, op);
  }
}

/**
 * Generate a summary of a document's current state.
 * Useful for giving the agent context about what's been discussed.
 */
export interface DocumentSummary {
  title: string;
  blocks: BlockSummary[];
  progress: {
    totalItems: number;
    checkedItems: number;
    percentage: number;
  };
}

export interface BlockSummary {
  id: string;
  type: "checklist" | "section" | "status";
  title: string;
  preview: string;
}

export function summarizeDocument(api: DocumentAPI): DocumentSummary {
  const blocks = api.blocks();
  let totalItems = 0;
  let checkedItems = 0;

  const blockSummaries: BlockSummary[] = blocks.map((block) => {
    switch (block.type) {
      case "checklist": {
        totalItems += block.items.length;
        checkedItems += block.items.filter((i) => i.checked).length;
        const unchecked = block.items.filter((i) => !i.checked);
        const preview =
          unchecked.length > 0 ? `${unchecked.length} remaining: ${unchecked[0].text}` : "All done";
        return { id: block.id, type: block.type, title: block.title, preview };
      }
      case "section": {
        const lines = block.content.split("\n").filter((l) => l.trim());
        const preview = lines.length > 0 ? `${lines.length} items` : "Empty";
        return { id: block.id, type: block.type, title: block.title, preview };
      }
      case "status": {
        return {
          id: block.id,
          type: block.type,
          title: block.label,
          preview: block.value,
        };
      }
    }
  });

  // Extract title from first h1 in markdown
  const markdown = api.toMarkdown();
  const titleMatch = markdown.match(/^# (.+)$/m);
  const title = titleMatch?.[1] ?? "Untitled";

  return {
    title,
    blocks: blockSummaries,
    progress: {
      totalItems,
      checkedItems,
      percentage: totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 100,
    },
  };
}

/**
 * JSON Schema for agent function calling.
 * Can be used with Claude's tool_use feature.
 */
export const AGENT_TOOLS_SCHEMA = {
  name: "update_document",
  description:
    "Update a structured meeting document. Use this to check off agenda items, add notes, capture action items, and track meeting status.",
  input_schema: {
    type: "object",
    properties: {
      operations: {
        type: "array",
        description: "List of operations to perform",
        items: {
          type: "object",
          properties: {
            op: {
              type: "string",
              enum: [
                "checklist.toggle",
                "checklist.check",
                "checklist.uncheck",
                "checklist.add",
                "checklist.remove",
                "section.set",
                "section.append",
                "section.prepend",
                "section.clear",
                "status.set",
              ],
              description: "The operation to perform",
            },
            blockId: {
              type: "string",
              description: "ID of the block to update (e.g., 'agenda', 'notes', 'action-items')",
            },
            index: {
              type: "number",
              description: "Item index for checklist operations",
            },
            text: {
              type: "string",
              description: "Text content for add operations",
            },
            content: {
              type: "string",
              description: "Content for section operations",
            },
            value: {
              type: "string",
              description: "Value for status operations",
            },
          },
          required: ["op", "blockId"],
        },
      },
    },
    required: ["operations"],
  },
} as const;
