/**
 * Document Building Blocks
 *
 * Markdown-based building blocks with typed APIs for agent interaction.
 * Designed for easy parsing/serialization and atomic updates.
 */

// ============================================================================
// Types
// ============================================================================

/** A checkable item in a checklist */
export interface ChecklistItem {
  text: string;
  checked: boolean;
}

/** A checklist block - ordered items with check state */
export interface ChecklistBlock {
  type: "checklist";
  id: string;
  title: string;
  items: ChecklistItem[];
}

/** A section block - named content container */
export interface SectionBlock {
  type: "section";
  id: string;
  title: string;
  content: string;
}

/** A status block - single value from predefined options */
export interface StatusBlock {
  type: "status";
  id: string;
  label: string;
  value: string;
  options: string[];
}

/** Union of all block types */
export type DocumentBlock = ChecklistBlock | SectionBlock | StatusBlock;

/** A document composed of blocks */
export interface Document {
  title: string;
  blocks: DocumentBlock[];
}

// ============================================================================
// Block APIs
// ============================================================================

export interface ChecklistAPI {
  /** Toggle item at index */
  toggle(index: number): void;
  /** Check item at index */
  check(index: number): void;
  /** Uncheck item at index */
  uncheck(index: number): void;
  /** Add item to end */
  add(text: string): void;
  /** Remove item at index */
  remove(index: number): void;
  /** Get all items */
  items(): readonly ChecklistItem[];
  /** Get checked items */
  checked(): readonly ChecklistItem[];
  /** Get unchecked items */
  unchecked(): readonly ChecklistItem[];
}

export interface SectionAPI {
  /** Get content */
  get(): string;
  /** Set content (replaces) */
  set(content: string): void;
  /** Append to content */
  append(content: string): void;
  /** Prepend to content */
  prepend(content: string): void;
  /** Clear content */
  clear(): void;
}

export interface StatusAPI {
  /** Get current value */
  get(): string;
  /** Set value (must be in options) */
  set(value: string): void;
  /** Get available options */
  options(): readonly string[];
  /** Check if value is valid option */
  isValid(value: string): boolean;
}

// ============================================================================
// Document API
// ============================================================================

export interface DocumentAPI {
  /** Access checklist by ID */
  checklist(id: string): ChecklistAPI;
  /** Access section by ID */
  section(id: string): SectionAPI;
  /** Access status by ID */
  status(id: string): StatusAPI;
  /** Get block by ID */
  block(id: string): DocumentBlock | undefined;
  /** Get all blocks */
  blocks(): readonly DocumentBlock[];
  /** Serialize to Markdown */
  toMarkdown(): string;
}

// ============================================================================
// Implementation
// ============================================================================

function createChecklistAPI(block: ChecklistBlock): ChecklistAPI {
  return {
    toggle(index) {
      if (index >= 0 && index < block.items.length) {
        block.items[index].checked = !block.items[index].checked;
      }
    },
    check(index) {
      if (index >= 0 && index < block.items.length) {
        block.items[index].checked = true;
      }
    },
    uncheck(index) {
      if (index >= 0 && index < block.items.length) {
        block.items[index].checked = false;
      }
    },
    add(text) {
      block.items.push({ text, checked: false });
    },
    remove(index) {
      if (index >= 0 && index < block.items.length) {
        block.items.splice(index, 1);
      }
    },
    items() {
      return block.items;
    },
    checked() {
      return block.items.filter((i) => i.checked);
    },
    unchecked() {
      return block.items.filter((i) => !i.checked);
    },
  };
}

function createSectionAPI(block: SectionBlock): SectionAPI {
  return {
    get() {
      return block.content;
    },
    set(content) {
      block.content = content;
    },
    append(content) {
      block.content = block.content ? `${block.content}\n${content}` : content;
    },
    prepend(content) {
      block.content = block.content ? `${content}\n${block.content}` : content;
    },
    clear() {
      block.content = "";
    },
  };
}

function createStatusAPI(block: StatusBlock): StatusAPI {
  return {
    get() {
      return block.value;
    },
    set(value) {
      if (block.options.includes(value)) {
        block.value = value;
      } else {
        throw new Error(`Invalid status value "${value}". Options: ${block.options.join(", ")}`);
      }
    },
    options() {
      return block.options;
    },
    isValid(value) {
      return block.options.includes(value);
    },
  };
}

// ============================================================================
// Markdown Serialization
// ============================================================================

function blockToMarkdown(block: DocumentBlock): string {
  switch (block.type) {
    case "checklist": {
      const items = block.items
        .map((item) => `- [${item.checked ? "x" : " "}] ${item.text}`)
        .join("\n");
      return `## ${block.title}\n\n${items}`;
    }
    case "section": {
      return `## ${block.title}\n\n${block.content}`;
    }
    case "status": {
      return `## ${block.label}\n\n**${block.value}**`;
    }
  }
}

export function documentToMarkdown(doc: Document): string {
  const blocks = doc.blocks.map(blockToMarkdown).join("\n\n---\n\n");
  return `# ${doc.title}\n\n${blocks}`;
}

// ============================================================================
// Markdown Parsing
// ============================================================================

const CHECKLIST_ITEM_RE = /^- \[([ x])\] (.+)$/;
const HEADING_RE = /^(#{1,6})\s+(.+)$/;

interface ParsedSection {
  level: number;
  title: string;
  content: string[];
}

function parseSections(markdown: string): ParsedSection[] {
  const lines = markdown.split("\n");
  const sections: ParsedSection[] = [];
  let current: ParsedSection | null = null;

  for (const line of lines) {
    const headingMatch = line.match(HEADING_RE);
    if (headingMatch) {
      if (current) sections.push(current);
      current = {
        level: headingMatch[1].length,
        title: headingMatch[2].trim(),
        content: [],
      };
    } else if (current) {
      current.content.push(line);
    }
  }
  if (current) sections.push(current);

  return sections;
}

function inferBlockType(content: string[]): "checklist" | "section" | "status" {
  const nonEmpty = content.filter((l) => l.trim() && l.trim() !== "---");
  if (nonEmpty.length === 0) return "section";

  // Check if all non-empty lines are checklist items
  const allChecklist = nonEmpty.every((l) => CHECKLIST_ITEM_RE.test(l.trim()));
  if (allChecklist && nonEmpty.length > 0) return "checklist";

  // Check if it's a single bold value (status)
  if (nonEmpty.length === 1 && /^\*\*(.+)\*\*$/.test(nonEmpty[0].trim())) {
    return "status";
  }

  return "section";
}

function parseChecklistItems(content: string[]): ChecklistItem[] {
  return content
    .map((line) => {
      const match = line.trim().match(CHECKLIST_ITEM_RE);
      if (match) {
        return { text: match[2], checked: match[1] === "x" };
      }
      return null;
    })
    .filter((item): item is ChecklistItem => item !== null);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function parseMarkdown(markdown: string): Document {
  const sections = parseSections(markdown);
  const blocks: DocumentBlock[] = [];

  // First section is the title (h1)
  const titleSection = sections.find((s) => s.level === 1);
  const title = titleSection?.title ?? "Untitled";

  // Process h2 sections as blocks
  for (const section of sections) {
    if (section.level !== 2) continue;

    const id = slugify(section.title);
    const blockType = inferBlockType(section.content);

    switch (blockType) {
      case "checklist":
        blocks.push({
          type: "checklist",
          id,
          title: section.title,
          items: parseChecklistItems(section.content),
        });
        break;
      case "status": {
        const match = section.content
          .find((l) => /^\*\*(.+)\*\*$/.test(l.trim()))
          ?.trim()
          .match(/^\*\*(.+)\*\*$/);
        blocks.push({
          type: "status",
          id,
          label: section.title,
          value: match?.[1] ?? "",
          options: [], // Options need to be provided separately
        });
        break;
      }
      case "section":
        blocks.push({
          type: "section",
          id,
          title: section.title,
          content: section.content
            .join("\n")
            .trim()
            .replace(/^---\n?|\n?---$/g, ""),
        });
        break;
    }
  }

  return { title, blocks };
}

// ============================================================================
// Document Factory
// ============================================================================

export function createDocument(doc: Document): DocumentAPI {
  const blockMap = new Map<string, DocumentBlock>();
  for (const block of doc.blocks) {
    blockMap.set(block.id, block);
  }

  return {
    checklist(id) {
      const block = blockMap.get(id);
      if (!block || block.type !== "checklist") {
        throw new Error(`Checklist "${id}" not found`);
      }
      return createChecklistAPI(block);
    },
    section(id) {
      const block = blockMap.get(id);
      if (!block || block.type !== "section") {
        throw new Error(`Section "${id}" not found`);
      }
      return createSectionAPI(block);
    },
    status(id) {
      const block = blockMap.get(id);
      if (!block || block.type !== "status") {
        throw new Error(`Status "${id}" not found`);
      }
      return createStatusAPI(block);
    },
    block(id) {
      return blockMap.get(id);
    },
    blocks() {
      return doc.blocks;
    },
    toMarkdown() {
      return documentToMarkdown(doc);
    },
  };
}

// ============================================================================
// Convenience: Parse markdown and create API
// ============================================================================

export function loadDocument(markdown: string): DocumentAPI {
  return createDocument(parseMarkdown(markdown));
}
