/**
 * Block builder utilities for creating Notion block objects.
 * These helpers make it easier to construct block content programmatically.
 */

import type { BlockObjectRequest } from "./types.js";

type RichTextInput =
  | string
  | {
      text: string;
      bold?: boolean;
      italic?: boolean;
      strikethrough?: boolean;
      underline?: boolean;
      code?: boolean;
      link?: string;
    };

function toRichText(input: RichTextInput | RichTextInput[]): Array<{
  type: "text";
  text: { content: string; link?: { url: string } };
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
  };
}> {
  const inputs = Array.isArray(input) ? input : [input];

  return inputs.map((item) => {
    if (typeof item === "string") {
      return {
        type: "text" as const,
        text: { content: item },
      };
    }

    return {
      type: "text" as const,
      text: {
        content: item.text,
        ...(item.link && { link: { url: item.link } }),
      },
      ...(item.bold || item.italic || item.strikethrough || item.underline || item.code
        ? {
            annotations: {
              bold: item.bold,
              italic: item.italic,
              strikethrough: item.strikethrough,
              underline: item.underline,
              code: item.code,
            },
          }
        : {}),
    };
  });
}

export const blocks = {
  /**
   * Create a paragraph block
   */
  paragraph(content: RichTextInput | RichTextInput[], color?: string): BlockObjectRequest {
    return {
      type: "paragraph",
      paragraph: {
        rich_text: toRichText(content),
        ...(color && { color }),
      },
    } as BlockObjectRequest;
  },

  /**
   * Create a heading 1 block
   */
  heading1(content: RichTextInput | RichTextInput[], toggleable = false): BlockObjectRequest {
    return {
      type: "heading_1",
      heading_1: {
        rich_text: toRichText(content),
        is_toggleable: toggleable,
      },
    } as BlockObjectRequest;
  },

  /**
   * Create a heading 2 block
   */
  heading2(content: RichTextInput | RichTextInput[], toggleable = false): BlockObjectRequest {
    return {
      type: "heading_2",
      heading_2: {
        rich_text: toRichText(content),
        is_toggleable: toggleable,
      },
    } as BlockObjectRequest;
  },

  /**
   * Create a heading 3 block
   */
  heading3(content: RichTextInput | RichTextInput[], toggleable = false): BlockObjectRequest {
    return {
      type: "heading_3",
      heading_3: {
        rich_text: toRichText(content),
        is_toggleable: toggleable,
      },
    } as BlockObjectRequest;
  },

  /**
   * Create a bulleted list item
   */
  bulletedListItem(
    content: RichTextInput | RichTextInput[],
    children?: BlockObjectRequest[]
  ): BlockObjectRequest {
    return {
      type: "bulleted_list_item",
      bulleted_list_item: {
        rich_text: toRichText(content),
        ...(children && { children }),
      },
    } as BlockObjectRequest;
  },

  /**
   * Create a numbered list item
   */
  numberedListItem(
    content: RichTextInput | RichTextInput[],
    children?: BlockObjectRequest[]
  ): BlockObjectRequest {
    return {
      type: "numbered_list_item",
      numbered_list_item: {
        rich_text: toRichText(content),
        ...(children && { children }),
      },
    } as BlockObjectRequest;
  },

  /**
   * Create a to-do item
   */
  toDo(
    content: RichTextInput | RichTextInput[],
    checked = false,
    children?: BlockObjectRequest[]
  ): BlockObjectRequest {
    return {
      type: "to_do",
      to_do: {
        rich_text: toRichText(content),
        checked,
        ...(children && { children }),
      },
    } as BlockObjectRequest;
  },

  /**
   * Create a toggle block
   */
  toggle(
    content: RichTextInput | RichTextInput[],
    children?: BlockObjectRequest[]
  ): BlockObjectRequest {
    return {
      type: "toggle",
      toggle: {
        rich_text: toRichText(content),
        ...(children && { children }),
      },
    } as BlockObjectRequest;
  },

  /**
   * Create a code block
   */
  code(content: string, language = "plain text", caption?: string): BlockObjectRequest {
    return {
      type: "code",
      code: {
        rich_text: [{ type: "text", text: { content } }],
        language,
        ...(caption && { caption: [{ type: "text", text: { content: caption } }] }),
      },
    } as BlockObjectRequest;
  },

  /**
   * Create a quote block
   */
  quote(
    content: RichTextInput | RichTextInput[],
    children?: BlockObjectRequest[]
  ): BlockObjectRequest {
    return {
      type: "quote",
      quote: {
        rich_text: toRichText(content),
        ...(children && { children }),
      },
    } as BlockObjectRequest;
  },

  /**
   * Create a callout block
   */
  callout(
    content: RichTextInput | RichTextInput[],
    icon?: string,
    children?: BlockObjectRequest[]
  ): BlockObjectRequest {
    return {
      type: "callout",
      callout: {
        rich_text: toRichText(content),
        ...(icon && { icon: { type: "emoji", emoji: icon } }),
        ...(children && { children }),
      },
    } as BlockObjectRequest;
  },

  /**
   * Create a divider block
   */
  divider(): BlockObjectRequest {
    return {
      type: "divider",
      divider: {},
    } as BlockObjectRequest;
  },

  /**
   * Create a table of contents block
   */
  tableOfContents(): BlockObjectRequest {
    return {
      type: "table_of_contents",
      table_of_contents: {},
    } as BlockObjectRequest;
  },

  /**
   * Create a bookmark block
   */
  bookmark(url: string, caption?: string): BlockObjectRequest {
    return {
      type: "bookmark",
      bookmark: {
        url,
        ...(caption && { caption: [{ type: "text", text: { content: caption } }] }),
      },
    } as BlockObjectRequest;
  },

  /**
   * Create an embed block
   */
  embed(url: string, caption?: string): BlockObjectRequest {
    return {
      type: "embed",
      embed: {
        url,
        ...(caption && { caption: [{ type: "text", text: { content: caption } }] }),
      },
    } as BlockObjectRequest;
  },

  /**
   * Create an image block
   */
  image(url: string, caption?: string): BlockObjectRequest {
    return {
      type: "image",
      image: {
        type: "external",
        external: { url },
        ...(caption && { caption: [{ type: "text", text: { content: caption } }] }),
      },
    } as BlockObjectRequest;
  },

  /**
   * Create a video block
   */
  video(url: string, caption?: string): BlockObjectRequest {
    return {
      type: "video",
      video: {
        type: "external",
        external: { url },
        ...(caption && { caption: [{ type: "text", text: { content: caption } }] }),
      },
    } as BlockObjectRequest;
  },

  /**
   * Create a file block
   */
  file(url: string, name?: string, caption?: string): BlockObjectRequest {
    return {
      type: "file",
      file: {
        type: "external",
        external: { url },
        ...(name && { name }),
        ...(caption && { caption: [{ type: "text", text: { content: caption } }] }),
      },
    } as BlockObjectRequest;
  },

  /**
   * Create a PDF block
   */
  pdf(url: string, caption?: string): BlockObjectRequest {
    return {
      type: "pdf",
      pdf: {
        type: "external",
        external: { url },
        ...(caption && { caption: [{ type: "text", text: { content: caption } }] }),
      },
    } as BlockObjectRequest;
  },

  /**
   * Create an equation block
   */
  equation(expression: string): BlockObjectRequest {
    return {
      type: "equation",
      equation: {
        expression,
      },
    } as BlockObjectRequest;
  },

  /**
   * Create a synced block (original)
   */
  syncedBlock(children: BlockObjectRequest[]): BlockObjectRequest {
    return {
      type: "synced_block",
      synced_block: {
        synced_from: null,
        children,
      },
    } as BlockObjectRequest;
  },

  /**
   * Create a synced block reference
   */
  syncedBlockReference(blockId: string): BlockObjectRequest {
    return {
      type: "synced_block",
      synced_block: {
        synced_from: { block_id: blockId },
      },
    } as BlockObjectRequest;
  },

  /**
   * Create a column list with columns
   */
  columnList(columns: BlockObjectRequest[][]): BlockObjectRequest {
    return {
      type: "column_list",
      column_list: {
        children: columns.map((children) => ({
          type: "column",
          column: { children },
        })),
      },
    } as BlockObjectRequest;
  },

  /**
   * Create a table
   */
  table(
    rows: string[][],
    options: { hasColumnHeader?: boolean; hasRowHeader?: boolean } = {}
  ): BlockObjectRequest {
    const width = rows[0]?.length || 0;

    return {
      type: "table",
      table: {
        table_width: width,
        has_column_header: options.hasColumnHeader ?? false,
        has_row_header: options.hasRowHeader ?? false,
        children: rows.map((cells) => ({
          type: "table_row",
          table_row: {
            cells: cells.map((cell) => [{ type: "text", text: { content: cell } }]),
          },
        })),
      },
    } as BlockObjectRequest;
  },
};

/**
 * Property builders for creating Notion page properties
 */
export const properties = {
  /**
   * Create a title property
   */
  title(content: string): { title: Array<{ text: { content: string } }> } {
    return {
      title: [{ text: { content } }],
    };
  },

  /**
   * Create a rich text property
   */
  richText(content: string): { rich_text: Array<{ text: { content: string } }> } {
    return {
      rich_text: [{ text: { content } }],
    };
  },

  /**
   * Create a number property
   */
  number(value: number): { number: number } {
    return { number: value };
  },

  /**
   * Create a select property
   */
  select(name: string): { select: { name: string } } {
    return { select: { name } };
  },

  /**
   * Create a multi-select property
   */
  multiSelect(names: string[]): { multi_select: Array<{ name: string }> } {
    return { multi_select: names.map((name) => ({ name })) };
  },

  /**
   * Create a date property
   */
  date(start: string, end?: string): { date: { start: string; end?: string } } {
    return { date: { start, ...(end && { end }) } };
  },

  /**
   * Create a checkbox property
   */
  checkbox(checked: boolean): { checkbox: boolean } {
    return { checkbox: checked };
  },

  /**
   * Create a URL property
   */
  url(url: string): { url: string } {
    return { url };
  },

  /**
   * Create an email property
   */
  email(email: string): { email: string } {
    return { email };
  },

  /**
   * Create a phone property
   */
  phone(phone: string): { phone_number: string } {
    return { phone_number: phone };
  },

  /**
   * Create a relation property
   */
  relation(pageIds: string[]): { relation: Array<{ id: string }> } {
    return { relation: pageIds.map((id) => ({ id })) };
  },

  /**
   * Create a people property
   */
  people(userIds: string[]): { people: Array<{ id: string }> } {
    return { people: userIds.map((id) => ({ id })) };
  },

  /**
   * Create a status property
   */
  status(name: string): { status: { name: string } } {
    return { status: { name } };
  },
};
