/**
 * Marshall MCP Server
 *
 * Exposes tools for the Codex agent to access:
 * - Transcript (on-demand, searchable)
 * - Current note contents
 * - User's other notes
 * - Document operations
 */

import type { AgentOperation } from "./document-service.js";
import type { MeetingProposal, NoteRecord } from "./index.js";

/** Input for proposing a new meeting */
export interface ProposeMeetingInput {
  title: string;
  startAt: string; // ISO 8601 datetime
  endAt: string; // ISO 8601 datetime
  participants?: string[]; // email addresses
  location?: string;
  description?: string;
}

// ============================================================================
// Types
// ============================================================================

export interface MarshallMCPContext {
  /** Current user ID */
  userId: string;
  /** Current note being worked on */
  currentNote: {
    id: string;
    title: string;
    body: string;
  } | null;
  /** Current transcription state */
  transcription: {
    status: string;
    text: string;
    utterances: Array<{
      start: number;
      end: number;
      text: string;
      speaker?: string | null;
    }>;
  } | null;
  /** Callback to fetch notes from database */
  fetchNotes: (params: {
    userId: string;
    limit?: number;
    search?: string;
  }) => Promise<NoteRecord[]>;
  /** Callback to fetch a single note */
  fetchNote: (noteId: string) => Promise<NoteRecord | null>;
  /** Callback to apply document operations */
  applyOperations: (noteId: string, operations: AgentOperation[]) => Promise<void>;
  /** Callback to propose a meeting for user review */
  proposeMeeting: (input: ProposeMeetingInput) => Promise<MeetingProposal>;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: object;
}

export interface MCPToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

// ============================================================================
// Tool Definitions
// ============================================================================

export const MARSHALL_MCP_TOOLS: MCPTool[] = [
  {
    name: "get_transcript",
    description:
      "Get the call transcript. Can retrieve full transcript, recent portion, or search for specific content.",
    inputSchema: {
      type: "object",
      properties: {
        mode: {
          type: "string",
          enum: ["full", "recent", "search", "time_range"],
          description: "How to retrieve the transcript",
        },
        last_seconds: {
          type: "number",
          description: "For 'recent' mode: how many seconds of recent transcript to get",
        },
        query: {
          type: "string",
          description: "For 'search' mode: text to search for in transcript",
        },
        from_seconds: {
          type: "number",
          description: "For 'time_range' mode: start time in seconds",
        },
        to_seconds: {
          type: "number",
          description: "For 'time_range' mode: end time in seconds",
        },
      },
      required: ["mode"],
    },
  },
  {
    name: "get_current_note",
    description: "Get the current note being worked on, including its structured document blocks.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "list_notes",
    description: "List the user's recent notes. Can optionally search by title/content.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of notes to return (default: 10)",
        },
        search: {
          type: "string",
          description: "Optional search query to filter notes",
        },
      },
      required: [],
    },
  },
  {
    name: "get_note",
    description: "Get a specific note by ID.",
    inputSchema: {
      type: "object",
      properties: {
        note_id: {
          type: "string",
          description: "The ID of the note to retrieve",
        },
      },
      required: ["note_id"],
    },
  },
  {
    name: "update_document",
    description:
      "Apply operations to update the current note's document blocks. Use this to check off agenda items, add notes, capture action items, etc.",
    inputSchema: {
      type: "object",
      properties: {
        operations: {
          type: "array",
          description: "List of operations to apply",
          items: {
            type: "object",
            properties: {
              op: {
                type: "string",
                enum: [
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
                description: "ID of the block to update",
              },
              index: {
                type: "number",
                description: "Item index for checklist operations",
              },
              text: {
                type: "string",
                description: "Text for checklist.add",
              },
              content: {
                type: "string",
                description: "Content for section operations",
              },
              value: {
                type: "string",
                description: "Value for status.set",
              },
            },
            required: ["op", "blockId"],
          },
        },
      },
      required: ["operations"],
    },
  },
  {
    name: "propose_meeting",
    description:
      "Propose a Google Calendar meeting for the user to review. Creates a draft that the user can accept (schedule) or discard. Use this when a follow-up meeting is discussed during the call.",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Meeting title",
        },
        startAt: {
          type: "string",
          description: "Start time in ISO 8601 format (e.g., 2024-03-25T14:00:00Z)",
        },
        endAt: {
          type: "string",
          description: "End time in ISO 8601 format (e.g., 2024-03-25T15:00:00Z)",
        },
        participants: {
          type: "array",
          items: { type: "string" },
          description: "Email addresses of participants to invite",
        },
        location: {
          type: "string",
          description: "Meeting location (physical address or video call link)",
        },
        description: {
          type: "string",
          description: "Meeting description or agenda",
        },
      },
      required: ["title", "startAt", "endAt"],
    },
  },
];

// ============================================================================
// Tool Handlers
// ============================================================================

function formatUtterance(u: { start: number; end: number; text: string; speaker?: string | null }) {
  const timestamp = formatTimestamp(u.start);
  const speaker = u.speaker ? `[${u.speaker}]` : "";
  return `${timestamp} ${speaker} ${u.text}`.trim();
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export async function handleGetTranscript(
  context: MarshallMCPContext,
  params: {
    mode: "full" | "recent" | "search" | "time_range";
    last_seconds?: number;
    query?: string;
    from_seconds?: number;
    to_seconds?: number;
  }
): Promise<MCPToolResult> {
  if (!context.transcription) {
    return {
      content: [{ type: "text", text: "No active transcription." }],
    };
  }

  const { utterances, text, status } = context.transcription;

  switch (params.mode) {
    case "full": {
      if (utterances.length === 0) {
        return {
          content: [{ type: "text", text: text || "(No transcript yet)" }],
        };
      }
      const formatted = utterances.map(formatUtterance).join("\n");
      return {
        content: [
          {
            type: "text",
            text: `Transcript (${utterances.length} utterances, status: ${status}):\n\n${formatted}`,
          },
        ],
      };
    }

    case "recent": {
      const lastSeconds = params.last_seconds ?? 60;
      if (utterances.length === 0) {
        return {
          content: [{ type: "text", text: "(No transcript yet)" }],
        };
      }
      const maxTime = Math.max(...utterances.map((u) => u.end));
      const cutoff = maxTime - lastSeconds;
      const recent = utterances.filter((u) => u.start >= cutoff);
      if (recent.length === 0) {
        return {
          content: [{ type: "text", text: `(No utterances in last ${lastSeconds} seconds)` }],
        };
      }
      const formatted = recent.map(formatUtterance).join("\n");
      return {
        content: [{ type: "text", text: `Last ${lastSeconds}s:\n\n${formatted}` }],
      };
    }

    case "search": {
      const query = params.query?.toLowerCase();
      if (!query) {
        return {
          content: [{ type: "text", text: "No search query provided." }],
          isError: true,
        };
      }
      const matches = utterances.filter((u) => u.text.toLowerCase().includes(query));
      if (matches.length === 0) {
        return {
          content: [{ type: "text", text: `No matches for "${params.query}"` }],
        };
      }
      const formatted = matches.map(formatUtterance).join("\n");
      return {
        content: [
          {
            type: "text",
            text: `Found ${matches.length} matches for "${params.query}":\n\n${formatted}`,
          },
        ],
      };
    }

    case "time_range": {
      const from = params.from_seconds ?? 0;
      const to = params.to_seconds ?? Infinity;
      const inRange = utterances.filter((u) => u.start >= from && u.end <= to);
      if (inRange.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No utterances in range ${formatTimestamp(from)} - ${formatTimestamp(to)}`,
            },
          ],
        };
      }
      const formatted = inRange.map(formatUtterance).join("\n");
      return {
        content: [
          {
            type: "text",
            text: `${formatTimestamp(from)} - ${formatTimestamp(to)}:\n\n${formatted}`,
          },
        ],
      };
    }
  }
}

export async function handleGetCurrentNote(context: MarshallMCPContext): Promise<MCPToolResult> {
  if (!context.currentNote) {
    return {
      content: [{ type: "text", text: "No current note." }],
      isError: true,
    };
  }

  const { id, title, body } = context.currentNote;
  return {
    content: [
      {
        type: "text",
        text: `Note: ${title} (id: ${id})\n\n${body}`,
      },
    ],
  };
}

export async function handleListNotes(
  context: MarshallMCPContext,
  params: { limit?: number; search?: string }
): Promise<MCPToolResult> {
  const notes = await context.fetchNotes({
    userId: context.userId,
    limit: params.limit ?? 10,
    search: params.search,
  });

  if (notes.length === 0) {
    return {
      content: [{ type: "text", text: "No notes found." }],
    };
  }

  const formatted = notes
    .map((n) => `- ${n.title} (id: ${n.id}, updated: ${n.updatedAt})`)
    .join("\n");

  return {
    content: [{ type: "text", text: `Found ${notes.length} notes:\n\n${formatted}` }],
  };
}

export async function handleGetNote(
  context: MarshallMCPContext,
  params: { note_id: string }
): Promise<MCPToolResult> {
  const note = await context.fetchNote(params.note_id);

  if (!note) {
    return {
      content: [{ type: "text", text: `Note not found: ${params.note_id}` }],
      isError: true,
    };
  }

  return {
    content: [
      {
        type: "text",
        text: `Note: ${note.title} (id: ${note.id})\nUpdated: ${note.updatedAt}\n\n${note.body}`,
      },
    ],
  };
}

export async function handleUpdateDocument(
  context: MarshallMCPContext,
  params: { operations: AgentOperation[] }
): Promise<MCPToolResult> {
  if (!context.currentNote) {
    return {
      content: [{ type: "text", text: "No current note to update." }],
      isError: true,
    };
  }

  try {
    await context.applyOperations(context.currentNote.id, params.operations);
    return {
      content: [
        {
          type: "text",
          text: `Applied ${params.operations.length} operation(s) to "${context.currentNote.title}"`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Failed to apply operations: ${error instanceof Error ? error.message : "Unknown error"}`,
        },
      ],
      isError: true,
    };
  }
}

export async function handleProposeMeeting(
  context: MarshallMCPContext,
  params: ProposeMeetingInput
): Promise<MCPToolResult> {
  try {
    const proposal = await context.proposeMeeting(params);
    const participantList =
      proposal.participants.length > 0 ? `\nParticipants: ${proposal.participants.join(", ")}` : "";
    const locationInfo = proposal.location ? `\nLocation: ${proposal.location}` : "";
    const descriptionInfo = proposal.description ? `\nDescription: ${proposal.description}` : "";

    return {
      content: [
        {
          type: "text",
          text: `Meeting proposed: "${proposal.title}"
Time: ${proposal.startAt} to ${proposal.endAt}${participantList}${locationInfo}${descriptionInfo}

The user will be prompted to accept or discard this meeting.`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Failed to propose meeting: ${error instanceof Error ? error.message : "Unknown error"}`,
        },
      ],
      isError: true,
    };
  }
}

// ============================================================================
// Main Handler
// ============================================================================

export async function handleToolCall(
  context: MarshallMCPContext,
  toolName: string,
  params: Record<string, unknown>
): Promise<MCPToolResult> {
  switch (toolName) {
    case "get_transcript":
      return handleGetTranscript(context, params as Parameters<typeof handleGetTranscript>[1]);
    case "get_current_note":
      return handleGetCurrentNote(context);
    case "list_notes":
      return handleListNotes(context, params as Parameters<typeof handleListNotes>[1]);
    case "get_note":
      return handleGetNote(context, params as Parameters<typeof handleGetNote>[1]);
    case "update_document":
      return handleUpdateDocument(context, params as Parameters<typeof handleUpdateDocument>[1]);
    case "propose_meeting":
      return handleProposeMeeting(context, params as unknown as ProposeMeetingInput);
    default:
      return {
        content: [{ type: "text", text: `Unknown tool: ${toolName}` }],
        isError: true,
      };
  }
}

// ============================================================================
// Minimal Agent Prompt (tools do the heavy lifting)
// ============================================================================

export function buildMinimalAgentPrompt(params: {
  noteTitle: string;
  mode: "live" | "final";
}): string {
  return `You are Marshall, an AI assistant helping during a live call.

## Current Call: ${params.noteTitle}

## Your Tools
- \`get_transcript\`: Read the call transcript (full, recent, or search)
- \`get_current_note\`: See the current note and its structure
- \`list_notes\`: Browse the user's other notes for context
- \`get_note\`: Read a specific note
- \`update_document\`: Update the note (check items, add notes, etc.)
- \`propose_meeting\`: Propose a meeting for user to review and schedule. Use this when asked to schedule, create, or propose any meeting. You CAN create meeting proposals - the user will review and accept them.

## Your Job
1. Monitor the conversation by checking the transcript periodically
2. Update the document as topics are discussed:
   - Check off agenda items when completed
   - Add notes capturing key points
   - Add action items when mentioned
3. When a follow-up meeting is discussed, propose it with \`propose_meeting\`
4. ${params.mode === "final" ? "Provide a summary of the call" : "Stay attentive for anything the user should address"}

## Guidelines
- Be proactive but not overwhelming
- Only update when there's meaningful change
- Keep notes concise
- Use \`get_transcript\` with mode="recent" to check what was just said
- Use \`get_transcript\` with mode="search" to find specific topics

Start by checking the current note structure, then monitor the transcript.`;
}
