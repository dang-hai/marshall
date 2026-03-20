#!/usr/bin/env bun
/* eslint-disable no-console */
/**
 * Document Blocks CLI
 *
 * Simple CLI for agents to interact with markdown documents atomically.
 *
 * Usage:
 *   doc <file> list                           # List all blocks
 *   doc <file> read <block-id>                # Read block content
 *   doc <file> checklist <id> toggle <index>  # Toggle checklist item
 *   doc <file> checklist <id> check <index>   # Check item
 *   doc <file> checklist <id> uncheck <index> # Uncheck item
 *   doc <file> checklist <id> add <text>      # Add item
 *   doc <file> section <id> get               # Get section content
 *   doc <file> section <id> set <content>     # Set section content
 *   doc <file> section <id> append <content>  # Append to section
 *   doc <file> status <id> get                # Get status value
 *   doc <file> status <id> set <value>        # Set status value
 *
 * Options:
 *   --json    Output as JSON
 *   --quiet   Suppress success messages
 */

import { readFileSync, writeFileSync } from "fs";
import { loadDocument, type DocumentBlock } from "./document-blocks";

const args = process.argv.slice(2);
const jsonOutput = args.includes("--json");
const quiet = args.includes("--quiet");
const filteredArgs = args.filter((a) => !a.startsWith("--"));

function output(data: unknown): void {
  if (jsonOutput) {
    console.log(JSON.stringify(data, null, 2));
  } else if (typeof data === "string") {
    console.log(data);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

function success(message: string): void {
  if (!quiet) {
    if (jsonOutput) {
      console.log(JSON.stringify({ success: true, message }));
    } else {
      console.log(`✓ ${message}`);
    }
  }
}

function error(message: string): never {
  if (jsonOutput) {
    console.error(JSON.stringify({ success: false, error: message }));
  } else {
    console.error(`Error: ${message}`);
  }
  process.exit(1);
}

function usage(): never {
  console.log(`
Document Blocks CLI

Usage:
  doc <file> list                           List all blocks with IDs
  doc <file> read <block-id>                Read block content
  doc <file> checklist <id> toggle <index>  Toggle checklist item
  doc <file> checklist <id> check <index>   Check item
  doc <file> checklist <id> uncheck <index> Uncheck item
  doc <file> checklist <id> add <text>      Add new item
  doc <file> checklist <id> remove <index>  Remove item
  doc <file> section <id> get               Get section content
  doc <file> section <id> set <content>     Replace section content
  doc <file> section <id> append <content>  Append to section
  doc <file> section <id> prepend <content> Prepend to section
  doc <file> section <id> clear             Clear section
  doc <file> status <id> get                Get current status
  doc <file> status <id> set <value>        Set status value
  doc <file> status <id> options            List valid options
  doc <file> markdown                       Output full markdown

Options:
  --json    Output as JSON
  --quiet   Suppress success messages

Examples:
  doc meeting.md list
  doc meeting.md checklist agenda toggle 0
  doc meeting.md section notes append "- Key decision made"
  doc meeting.md status phase set "In Progress"
`);
  process.exit(0);
}

function blockSummary(block: DocumentBlock): object {
  switch (block.type) {
    case "checklist":
      return {
        id: block.id,
        type: block.type,
        title: block.title,
        items: block.items.length,
        checked: block.items.filter((i) => i.checked).length,
      };
    case "section":
      return {
        id: block.id,
        type: block.type,
        title: block.title,
        length: block.content.length,
      };
    case "status":
      return {
        id: block.id,
        type: block.type,
        label: block.label,
        value: block.value,
        options: block.options,
      };
  }
}

// Parse arguments
if (filteredArgs.length < 2) {
  usage();
}

const [filePath, command, ...rest] = filteredArgs;

// Read file
let markdown: string;
try {
  markdown = readFileSync(filePath, "utf-8");
} catch {
  error(`Cannot read file: ${filePath}`);
}

const doc = loadDocument(markdown);

// Execute command
switch (command) {
  case "list": {
    const blocks = doc.blocks().map(blockSummary);
    output(blocks);
    break;
  }

  case "read": {
    const blockId = rest[0];
    if (!blockId) error("Missing block ID");

    const block = doc.block(blockId);
    if (!block) error(`Block "${blockId}" not found`);

    output(block);
    break;
  }

  case "markdown": {
    output(doc.toMarkdown());
    break;
  }

  case "checklist": {
    const [blockId, action, ...actionArgs] = rest;
    if (!blockId) error("Missing block ID");
    if (!action) error("Missing action (toggle|check|uncheck|add|remove)");

    const checklist = doc.checklist(blockId);

    switch (action) {
      case "toggle": {
        const index = parseInt(actionArgs[0], 10);
        if (isNaN(index)) error("Invalid index");
        checklist.toggle(index);
        writeFileSync(filePath, doc.toMarkdown());
        success(`Toggled item ${index} in "${blockId}"`);
        break;
      }
      case "check": {
        const index = parseInt(actionArgs[0], 10);
        if (isNaN(index)) error("Invalid index");
        checklist.check(index);
        writeFileSync(filePath, doc.toMarkdown());
        success(`Checked item ${index} in "${blockId}"`);
        break;
      }
      case "uncheck": {
        const index = parseInt(actionArgs[0], 10);
        if (isNaN(index)) error("Invalid index");
        checklist.uncheck(index);
        writeFileSync(filePath, doc.toMarkdown());
        success(`Unchecked item ${index} in "${blockId}"`);
        break;
      }
      case "add": {
        const text = actionArgs.join(" ");
        if (!text) error("Missing item text");
        checklist.add(text);
        writeFileSync(filePath, doc.toMarkdown());
        success(`Added item to "${blockId}"`);
        break;
      }
      case "remove": {
        const index = parseInt(actionArgs[0], 10);
        if (isNaN(index)) error("Invalid index");
        checklist.remove(index);
        writeFileSync(filePath, doc.toMarkdown());
        success(`Removed item ${index} from "${blockId}"`);
        break;
      }
      case "items": {
        output(checklist.items());
        break;
      }
      default:
        error(`Unknown checklist action: ${action}`);
    }
    break;
  }

  case "section": {
    const [blockId, action, ...actionArgs] = rest;
    if (!blockId) error("Missing block ID");
    if (!action) error("Missing action (get|set|append|prepend|clear)");

    const section = doc.section(blockId);

    switch (action) {
      case "get": {
        output(section.get());
        break;
      }
      case "set": {
        const content = actionArgs.join(" ");
        section.set(content);
        writeFileSync(filePath, doc.toMarkdown());
        success(`Set content of "${blockId}"`);
        break;
      }
      case "append": {
        const content = actionArgs.join(" ");
        if (!content) error("Missing content");
        section.append(content);
        writeFileSync(filePath, doc.toMarkdown());
        success(`Appended to "${blockId}"`);
        break;
      }
      case "prepend": {
        const content = actionArgs.join(" ");
        if (!content) error("Missing content");
        section.prepend(content);
        writeFileSync(filePath, doc.toMarkdown());
        success(`Prepended to "${blockId}"`);
        break;
      }
      case "clear": {
        section.clear();
        writeFileSync(filePath, doc.toMarkdown());
        success(`Cleared "${blockId}"`);
        break;
      }
      default:
        error(`Unknown section action: ${action}`);
    }
    break;
  }

  case "status": {
    const [blockId, action, ...actionArgs] = rest;
    if (!blockId) error("Missing block ID");
    if (!action) error("Missing action (get|set|options)");

    const status = doc.status(blockId);

    switch (action) {
      case "get": {
        output(status.get());
        break;
      }
      case "set": {
        const value = actionArgs.join(" ");
        if (!value) error("Missing value");
        status.set(value);
        writeFileSync(filePath, doc.toMarkdown());
        success(`Set "${blockId}" to "${value}"`);
        break;
      }
      case "options": {
        output(status.options());
        break;
      }
      default:
        error(`Unknown status action: ${action}`);
    }
    break;
  }

  default:
    error(`Unknown command: ${command}`);
}
