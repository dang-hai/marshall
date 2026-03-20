/* eslint-disable no-console */
/**
 * Example: Agent using Document Blocks during a call
 *
 * This demonstrates how an AI agent can interact with structured documents
 * using atomic operations without rewriting the entire output.
 */

import { loadDocument, createDocument, type Document } from "./document-blocks";

// ============================================================================
// Example 1: Parse existing template and update during call
// ============================================================================

const oneOnOneTemplate = `# 1:1 with Sarah

## Call Status

**In Progress**

---

## Agenda

- [ ] Review Q1 goals progress
- [ ] Discuss project X timeline
- [ ] Career development check-in
- [ ] Any blockers?

---

## Notes

---

## Action Items

- [ ] (placeholder)

---

## Decisions

`;

function example1_agentUpdatesDocument() {
  // Agent loads the document at call start
  const doc = loadDocument(oneOnOneTemplate);

  // As discussion happens, agent marks agenda items complete
  doc.checklist("agenda").check(0); // "Review Q1 goals progress" - discussed

  // Agent captures notes in real-time
  doc.section("notes").append("- Q1 goals 80% complete, on track");
  doc.section("notes").append("- Project X delayed 2 weeks due to API changes");

  // Agent adds action item when mentioned
  doc.checklist("action-items").add("Sarah: Send updated timeline by Friday");

  // Agent captures decision
  doc.section("decisions").append("- Push Project X deadline to April 15th");

  // Continue with agenda
  doc.checklist("agenda").check(1); // "Discuss project X timeline" - discussed

  // Get final markdown output
  console.log("=== Final Document ===");
  console.log(doc.toMarkdown());
}

// ============================================================================
// Example 2: Programmatic template creation with status tracking
// ============================================================================

function example2_createFromCode() {
  // Create document programmatically with full type safety
  const doc: Document = {
    title: "Sprint Planning",
    blocks: [
      {
        type: "status",
        id: "phase",
        label: "Phase",
        value: "Review",
        options: ["Review", "Estimation", "Commitment", "Done"],
      },
      {
        type: "checklist",
        id: "stories",
        title: "Stories to Discuss",
        items: [
          { text: "AUTH-123: Implement OAuth flow", checked: false },
          { text: "AUTH-124: Add remember me option", checked: false },
          { text: "AUTH-125: Password reset emails", checked: false },
        ],
      },
      {
        type: "section",
        id: "estimates",
        title: "Estimates",
        content: "",
      },
      {
        type: "section",
        id: "commitments",
        title: "Sprint Commitments",
        content: "",
      },
    ],
  };

  const api = createDocument(doc);

  // Agent tracks which story we're discussing
  api.checklist("stories").check(0);
  api.section("estimates").append("AUTH-123: 5 points (agreed)");

  // Move to next phase
  api.status("phase").set("Estimation");

  console.log(api.toMarkdown());
}

// ============================================================================
// Example 3: Agent decision tree for call guidance
// ============================================================================

interface AgentAction {
  type: "check" | "append" | "set_status";
  blockId: string;
  payload: unknown;
}

function _example3_agentDecisionHandler(
  doc: ReturnType<typeof loadDocument>,
  transcript: string
): AgentAction[] {
  const actions: AgentAction[] = [];

  // Example: Agent analyzes transcript and returns atomic updates
  // This would be replaced by actual LLM inference

  if (transcript.includes("let's move on")) {
    // Mark current item as done
    const agenda = doc.checklist("agenda");
    const unchecked = agenda.unchecked();
    if (unchecked.length > 0) {
      const items = agenda.items();
      const index = items.findIndex((i) => !i.checked);
      if (index !== -1) {
        actions.push({ type: "check", blockId: "agenda", payload: index });
      }
    }
  }

  if (transcript.includes("action item")) {
    actions.push({
      type: "append",
      blockId: "action-items",
      payload: "Captured from transcript...",
    });
  }

  return actions;
}

// ============================================================================
// Example 4: Typed API for LLM function calling
// ============================================================================

/**
 * These types can be used to generate a JSON schema for LLM function calling.
 * The agent can call these functions to update the document atomically.
 */

type DocumentFunction =
  | {
      name: "checklist_toggle";
      params: { block_id: string; item_index: number };
    }
  | {
      name: "checklist_add";
      params: { block_id: string; text: string };
    }
  | {
      name: "section_append";
      params: { block_id: string; content: string };
    }
  | {
      name: "section_set";
      params: { block_id: string; content: string };
    }
  | {
      name: "status_set";
      params: { block_id: string; value: string };
    };

function executeDocumentFunction(doc: ReturnType<typeof loadDocument>, fn: DocumentFunction): void {
  switch (fn.name) {
    case "checklist_toggle":
      doc.checklist(fn.params.block_id).toggle(fn.params.item_index);
      break;
    case "checklist_add":
      doc.checklist(fn.params.block_id).add(fn.params.text);
      break;
    case "section_append":
      doc.section(fn.params.block_id).append(fn.params.content);
      break;
    case "section_set":
      doc.section(fn.params.block_id).set(fn.params.content);
      break;
    case "status_set":
      doc.status(fn.params.block_id).set(fn.params.value);
      break;
  }
}

// Example LLM response containing function calls
const llmFunctionCalls: DocumentFunction[] = [
  { name: "checklist_toggle", params: { block_id: "agenda", item_index: 0 } },
  {
    name: "section_append",
    params: {
      block_id: "notes",
      content: "- Discussed Q1 performance metrics",
    },
  },
  {
    name: "checklist_add",
    params: {
      block_id: "action-items",
      text: "@john: Prepare Q2 forecast by EOW",
    },
  },
];

function example4_llmFunctionCalling() {
  const doc = loadDocument(oneOnOneTemplate);

  // Execute all function calls from LLM
  for (const fn of llmFunctionCalls) {
    executeDocumentFunction(doc, fn);
  }

  console.log(doc.toMarkdown());
}

// Run examples
if (import.meta.main) {
  console.log("\n=== Example 1: Agent Updates Document ===\n");
  example1_agentUpdatesDocument();

  console.log("\n=== Example 2: Programmatic Creation ===\n");
  example2_createFromCode();

  console.log("\n=== Example 4: LLM Function Calling ===\n");
  example4_llmFunctionCalling();
}
