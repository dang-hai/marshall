/**
 * Codex Document Integration
 *
 * Bridges the Codex monitor system with document blocks,
 * allowing the agent to update structured documents during calls.
 */

import { loadDocument, parseMarkdown } from "./document-blocks.js";
import type { AgentOperation } from "./document-service.js";

// ============================================================================
// Types for Codex Agent Output
// ============================================================================

/**
 * Extended agent result that includes document operations.
 */
export interface CodexDocumentResult {
  /** Ephemeral nudge for the user */
  nudge: {
    text: string;
    suggestedPhrase: string | null;
  } | null;

  /** Tracked items (action items, follow-ups) */
  items: Array<{
    text: string;
    status: "pending" | "done" | "attention";
  }>;

  /** Document block operations to apply */
  documentOps: AgentOperation[];

  /** Final summary (only in final mode) */
  summary: string | null;
}

/**
 * Schema for the Codex agent's structured output.
 */
export const CODEX_DOCUMENT_RESULT_SCHEMA = {
  type: "object",
  properties: {
    nudge: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          properties: {
            text: { type: "string" },
            suggestedPhrase: { anyOf: [{ type: "string" }, { type: "null" }] },
          },
          required: ["text", "suggestedPhrase"],
          additionalProperties: false,
        },
      ],
    },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          status: { type: "string", enum: ["pending", "done", "attention"] },
        },
        required: ["text", "status"],
        additionalProperties: false,
      },
    },
    documentOps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          op: {
            type: "string",
            enum: [
              "checklist.check",
              "checklist.uncheck",
              "checklist.add",
              "section.append",
              "section.set",
              "status.set",
            ],
          },
          blockId: { type: "string" },
          index: { type: "number" },
          text: { type: "string" },
          content: { type: "string" },
          value: { type: "string" },
        },
        required: ["op", "blockId"],
        additionalProperties: false,
      },
    },
    summary: { anyOf: [{ type: "string" }, { type: "null" }] },
  },
  required: ["nudge", "items", "documentOps", "summary"],
  additionalProperties: false,
} as const;

// ============================================================================
// Document Context for Agent Prompt
// ============================================================================

/**
 * Block summary for the agent prompt.
 */
interface BlockContext {
  id: string;
  type: "checklist" | "section" | "status";
  title: string;
  items?: Array<{ index: number; text: string; checked: boolean }>;
  content?: string;
  value?: string;
  options?: string[];
}

/**
 * Extract document context for the agent prompt.
 * This gives the agent a structured view of the document.
 */
export function extractDocumentContext(markdown: string): {
  hasStructure: boolean;
  blocks: BlockContext[];
  raw: string;
} {
  try {
    const doc = parseMarkdown(markdown);

    if (doc.blocks.length === 0) {
      return { hasStructure: false, blocks: [], raw: markdown };
    }

    const blocks: BlockContext[] = doc.blocks.map((block) => {
      switch (block.type) {
        case "checklist":
          return {
            id: block.id,
            type: block.type,
            title: block.title,
            items: block.items.map((item, index) => ({
              index,
              text: item.text,
              checked: item.checked,
            })),
          };
        case "section":
          return {
            id: block.id,
            type: block.type,
            title: block.title,
            content: block.content,
          };
        case "status":
          return {
            id: block.id,
            type: block.type,
            title: block.label,
            value: block.value,
            options: block.options,
          };
      }
    });

    return { hasStructure: true, blocks, raw: markdown };
  } catch {
    return { hasStructure: false, blocks: [], raw: markdown };
  }
}

/**
 * Build the document context section for the agent prompt.
 */
export function buildDocumentPromptSection(markdown: string): string {
  const { hasStructure, blocks } = extractDocumentContext(markdown);

  if (!hasStructure) {
    return [
      "## Meeting Notes (Unstructured)",
      markdown.trim().slice(0, 3000) || "(No notes provided)",
    ].join("\n");
  }

  const lines = ["## Document Blocks", ""];

  for (const block of blocks) {
    lines.push(`### ${block.title} (id: "${block.id}", type: ${block.type})`);

    if (block.type === "checklist" && block.items) {
      for (const item of block.items) {
        const check = item.checked ? "x" : " ";
        lines.push(`  [${item.index}] [${check}] ${item.text}`);
      }
    } else if (block.type === "section") {
      lines.push(block.content || "(empty)");
    } else if (block.type === "status") {
      lines.push(`  Current: ${block.value}`);
      if (block.options && block.options.length > 0) {
        lines.push(`  Options: ${block.options.join(", ")}`);
      }
    }

    lines.push("");
  }

  return lines.join("\n");
}

// ============================================================================
// Apply Agent Operations
// ============================================================================

/**
 * Apply document operations from the agent result.
 * Returns the updated markdown.
 */
export function applyDocumentOperations(markdown: string, operations: AgentOperation[]): string {
  if (operations.length === 0) {
    return markdown;
  }

  try {
    const api = loadDocument(markdown);

    for (const op of operations) {
      try {
        switch (op.op) {
          case "checklist.check":
            api.checklist(op.blockId).check(op.index);
            break;
          case "checklist.uncheck":
            api.checklist(op.blockId).uncheck(op.index);
            break;
          case "checklist.add":
            api.checklist(op.blockId).add(op.text);
            break;
          case "section.append":
            api.section(op.blockId).append(op.content);
            break;
          case "section.set":
            api.section(op.blockId).set(op.content);
            break;
          case "status.set":
            api.status(op.blockId).set(op.value);
            break;
        }
      } catch (error) {
        // Log but continue - don't fail the whole batch for one bad op
        console.warn(`Failed to apply operation ${op.op} on ${op.blockId}:`, error);
      }
    }

    return api.toMarkdown();
  } catch {
    // If parsing fails, return original
    return markdown;
  }
}

// ============================================================================
// Extended Patch Type
// ============================================================================

/**
 * Extended note patch that includes document operations.
 */
export interface CodexDocumentPatch {
  noteId: string;
  /** Document operations to apply */
  documentOps: AgentOperation[];
  /** Tracked items */
  items: Array<{
    id: string;
    text: string;
    status: "pending" | "done" | "attention";
    addedAt: string;
  }>;
  /** Final summary */
  summary: string | null;
  /** Whether this is the final analysis */
  final: boolean;
  /** When this patch was generated */
  generatedAt: string;
}

// ============================================================================
// Agent Prompt Instructions
// ============================================================================

/**
 * Instructions for the agent on how to use document operations.
 */
export const DOCUMENT_OPERATIONS_INSTRUCTIONS = `
## Document Operations

The meeting notes use structured document blocks. You can update them with these operations:

### Checklist Operations
- \`checklist.check\`: Mark item as done. Params: \`blockId\`, \`index\`
- \`checklist.uncheck\`: Mark item as not done. Params: \`blockId\`, \`index\`
- \`checklist.add\`: Add new item. Params: \`blockId\`, \`text\`

### Section Operations
- \`section.append\`: Add content to end. Params: \`blockId\`, \`content\`
- \`section.set\`: Replace content. Params: \`blockId\`, \`content\`

### Status Operations
- \`status.set\`: Change status value. Params: \`blockId\`, \`value\` (must be valid option)

### Guidelines
- Use \`checklist.check\` when a topic is clearly completed/discussed
- Use \`section.append\` to add notes incrementally
- Use \`checklist.add\` to add new action items discovered in conversation
- Reference items by their index (0-based) shown in brackets
- Only update blocks that have changed based on the conversation
`;

/**
 * Build the full agent prompt with document context.
 */
export function buildAgentPrompt(params: {
  noteTitle: string;
  noteBody: string;
  transcriptExcerpt: string;
  existingItems: Array<{ text: string; status: string }>;
  previousNudge: string | null;
  mode: "live" | "final";
}): string {
  const documentSection = buildDocumentPromptSection(params.noteBody);
  const { hasStructure } = extractDocumentContext(params.noteBody);

  const lines = [
    "You are Marshall's live call monitor.",
    "Read the call context and transcript, then return JSON matching the schema.",
    "",
    DOCUMENT_OPERATIONS_INSTRUCTIONS,
    "",
    `## Call: ${params.noteTitle}`,
    "",
    documentSection,
    "",
    "## Transcript Excerpt",
    params.transcriptExcerpt || "(Call just started, no transcript yet)",
    "",
  ];

  if (params.existingItems.length > 0) {
    lines.push("## Currently Tracked Items");
    for (const item of params.existingItems) {
      lines.push(`- [${item.status}] ${item.text}`);
    }
    lines.push("");
  }

  lines.push(
    "## Output Instructions",
    "",
    "Return JSON with:",
    "- `nudge`: Ephemeral tip (null unless there's something specific to say now)",
    "- `items`: Array of {text, status} for action items/follow-ups",
    hasStructure
      ? "- `documentOps`: Array of operations to update the document blocks"
      : "- `documentOps`: [] (no structured blocks to update)",
    params.mode === "final"
      ? "- `summary`: 2-3 sentence summary of the call"
      : "- `summary`: null (only provide in final mode)",
    "",
    "Keep nudge.text under 100 characters. Keep item text under 80 characters.",
    params.previousNudge ? `Previous nudge (avoid repeating): "${params.previousNudge}"` : ""
  );

  return lines.filter(Boolean).join("\n");
}
