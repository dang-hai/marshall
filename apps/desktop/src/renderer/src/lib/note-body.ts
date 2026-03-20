import type { CodexMonitorNotePatch } from "@marshall/shared";

export const PARAGRAPH_BLOCK_CLASS = "min-h-[1.85rem]";
export const HEADING_ONE_BLOCK_CLASS =
  "min-h-[2.5rem] font-serif text-[1.5rem] font-medium leading-tight tracking-[-0.01em]";
export const HEADING_TWO_BLOCK_CLASS =
  "min-h-[2.2rem] font-serif text-[1.25rem] font-medium leading-tight tracking-[-0.01em]";
export const BULLET_BLOCK_CLASS =
  "relative min-h-[1.85rem] pl-6 before:absolute before:left-0 before:top-0 before:text-foreground/65 before:content-['•']";
export const QUOTE_BLOCK_CLASS =
  "min-h-[1.85rem] border-l-2 border-border/80 pl-4 text-muted-foreground";
export const DIVIDER_BLOCK_CLASS = "my-4 border-0 border-t border-border/80";
export const INLINE_CODE_CLASS =
  "rounded bg-muted px-1 py-0.5 font-mono text-[0.875em] text-foreground";

export type MarkdownBlockType = "paragraph" | "heading-1" | "heading-2" | "bullet" | "quote";

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderInlineMarkdown(text: string) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, `<code class="${INLINE_CODE_CLASS}">$1</code>`)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/(^|[^_])_([^_]+)_(?!_)/g, "$1<em>$2</em>");
}

export function textToParagraphHtml(text: string) {
  const lines = text.split("\n");
  return lines
    .map(
      (line) =>
        `<div class="${PARAGRAPH_BLOCK_CLASS}">${renderInlineMarkdown(line) || "<br>"}</div>`
    )
    .join("");
}

export function extractPlainTextFromHtml(html: string) {
  if (typeof document === "undefined") {
    return html.replace(/<[^>]+>/g, " ");
  }

  const container = document.createElement("div");
  container.innerHTML = html;
  return container.innerText.replace(/\r\n/g, "\n");
}

export function normalizeEditorHtml(html: string) {
  return html.trim();
}

export function getBlockClassName(type: MarkdownBlockType) {
  switch (type) {
    case "heading-1":
      return HEADING_ONE_BLOCK_CLASS;
    case "heading-2":
      return HEADING_TWO_BLOCK_CLASS;
    case "bullet":
      return BULLET_BLOCK_CLASS;
    case "quote":
      return QUOTE_BLOCK_CLASS;
    default:
      return PARAGRAPH_BLOCK_CLASS;
  }
}

function normalizeChecklistLabel(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseBodyHtml(bodyHtml: string) {
  const parser = new DOMParser();
  return parser.parseFromString(`<body>${bodyHtml}</body>`, "text/html").body;
}

function setBlockText(element: HTMLElement, text: string) {
  element.innerHTML = renderInlineMarkdown(text) || "<br>";
}

function createBlock(document: Document, type: MarkdownBlockType, text: string) {
  const block = document.createElement("div");
  block.dataset.mdType = type;
  block.className = getBlockClassName(type);
  setBlockText(block, text);
  return block;
}

function replaceSection(
  body: HTMLElement,
  section: "followups" | "summary",
  nextBlocks: HTMLElement[]
) {
  const existing = Array.from(body.children).filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && child.dataset.marshallSection === section
  );

  if (existing.length > 0) {
    const [first, ...rest] = existing;
    if (nextBlocks.length === 0) {
      first.remove();
    } else {
      first.replaceWith(...nextBlocks);
    }
    rest.forEach((element) => element.remove());
    return;
  }

  if (nextBlocks.length === 0) {
    return;
  }

  body.append(...nextBlocks);
}

function markChecklistItems(body: HTMLElement, checkedPlanItems: string[]) {
  if (checkedPlanItems.length === 0) {
    return;
  }

  const matchedItems = new Set(checkedPlanItems.map(normalizeChecklistLabel));

  Array.from(body.children).forEach((child) => {
    if (!(child instanceof HTMLElement)) {
      return;
    }

    const text = child.innerText.replace(/\r\n/g, "\n").trim();
    const match = text.match(/^([-*])\s+\[( |x|X)\]\s+(.+)$/);
    if (!match) {
      return;
    }

    const label = normalizeChecklistLabel(match[3]);
    if (!matchedItems.has(label) || match[2].toLowerCase() === "x") {
      return;
    }

    setBlockText(child, `${match[1]} [x] ${match[3]}`);
  });
}

function buildFollowUpSection(document: Document, followUps: string[]) {
  if (followUps.length === 0) {
    return [];
  }

  const heading = createBlock(document, "heading-2", "Follow-up");
  heading.dataset.marshallSection = "followups";
  heading.dataset.marshallRole = "heading";

  const items = followUps.map((followUp) => {
    const item = createBlock(document, "bullet", followUp);
    item.dataset.marshallSection = "followups";
    item.dataset.marshallRole = "item";
    return item;
  });

  return [heading, ...items];
}

function buildSummarySection(document: Document, summary: string | null) {
  if (!summary?.trim()) {
    return [];
  }

  const heading = createBlock(document, "heading-2", "Call summary");
  heading.dataset.marshallSection = "summary";
  heading.dataset.marshallRole = "heading";

  const paragraphs = summary
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const paragraph = createBlock(document, "paragraph", part);
      paragraph.dataset.marshallSection = "summary";
      paragraph.dataset.marshallRole = "body";
      return paragraph;
    });

  return [heading, ...paragraphs];
}

function buildBlockHtml(
  type: MarkdownBlockType,
  text: string,
  dataAttributes?: Record<string, string>
) {
  const attributes = Object.entries(dataAttributes ?? {})
    .map(([key, value]) => ` ${key}="${value}"`)
    .join("");

  return `<div${attributes} class="${getBlockClassName(type)}">${
    renderInlineMarkdown(text) || "<br>"
  }</div>`;
}

function buildSectionHtml(section: "followups" | "summary", items: string[]) {
  if (section === "followups") {
    if (items.length === 0) {
      return "";
    }

    return [
      buildBlockHtml("heading-2", "Follow-up", {
        "data-marshall-section": "followups",
        "data-marshall-role": "heading",
      }),
      ...items.map((item) =>
        buildBlockHtml("bullet", item, {
          "data-marshall-section": "followups",
          "data-marshall-role": "item",
        })
      ),
    ].join("");
  }

  if (items.length === 0) {
    return "";
  }

  return [
    buildBlockHtml("heading-2", "Call summary", {
      "data-marshall-section": "summary",
      "data-marshall-role": "heading",
    }),
    ...items.map((item) =>
      buildBlockHtml("paragraph", item, {
        "data-marshall-section": "summary",
        "data-marshall-role": "body",
      })
    ),
  ].join("");
}

function applyCodexNotePatchWithoutDom(bodyHtml: string, patch: CodexMonitorNotePatch) {
  let nextHtml = bodyHtml;

  patch.checkedPlanItems.forEach((item) => {
    const escapedItem = escapeRegex(escapeHtml(item));
    const pattern = new RegExp(`([-*]\\s+\\[)( |x|X)(\\]\\s+${escapedItem})`, "g");
    nextHtml = nextHtml.replace(pattern, "$1x$3");
  });

  nextHtml = nextHtml.replace(
    /<div[^>]*data-marshall-section="followups"[^>]*>[\s\S]*?<\/div>/g,
    ""
  );
  nextHtml = nextHtml.replace(/<div[^>]*data-marshall-section="summary"[^>]*>[\s\S]*?<\/div>/g, "");

  const followUpsHtml = buildSectionHtml(
    "followups",
    patch.items.map((item) => item.text)
  );
  const summaryHtml = buildSectionHtml(
    "summary",
    patch.summary
      ? patch.summary
          .split(/\n+/)
          .map((part) => part.trim())
          .filter(Boolean)
      : []
  );

  return normalizeEditorHtml(`${nextHtml}${followUpsHtml}${summaryHtml}`);
}

export function applyCodexNotePatch(bodyHtml: string, patch: CodexMonitorNotePatch) {
  if (typeof DOMParser === "undefined") {
    return applyCodexNotePatchWithoutDom(bodyHtml, patch);
  }

  const body = parseBodyHtml(bodyHtml);

  markChecklistItems(body, patch.checkedPlanItems);
  replaceSection(
    body,
    "followups",
    buildFollowUpSection(
      body.ownerDocument,
      patch.items.map((item) => item.text)
    )
  );
  replaceSection(body, "summary", buildSummarySection(body.ownerDocument, patch.summary));

  return normalizeEditorHtml(body.innerHTML);
}
