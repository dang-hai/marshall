import { describe, expect, it } from "bun:test";
import { blocks, properties } from "../src/notion/blocks.js";

describe("blocks", () => {
  describe("paragraph", () => {
    it("creates a paragraph with string content", () => {
      const block = blocks.paragraph("Hello world");
      expect(block).toEqual({
        type: "paragraph",
        paragraph: {
          rich_text: [{ type: "text", text: { content: "Hello world" } }],
        },
      });
    });

    it("creates a paragraph with rich text formatting", () => {
      const block = blocks.paragraph({ text: "Bold text", bold: true });
      expect(block).toEqual({
        type: "paragraph",
        paragraph: {
          rich_text: [
            {
              type: "text",
              text: { content: "Bold text" },
              annotations: { bold: true },
            },
          ],
        },
      });
    });

    it("creates a paragraph with multiple text segments", () => {
      const block = blocks.paragraph(["Normal ", { text: "bold", bold: true }, " text"]);
      expect(block.type).toBe("paragraph");
      const paragraph = block as { paragraph: { rich_text: unknown[] } };
      expect(paragraph.paragraph.rich_text).toHaveLength(3);
    });

    it("creates a paragraph with color", () => {
      const block = blocks.paragraph("Colored", "red");
      const paragraph = block as { paragraph: { color: string } };
      expect(paragraph.paragraph.color).toBe("red");
    });
  });

  describe("headings", () => {
    it("creates heading 1", () => {
      const block = blocks.heading1("Title");
      expect(block).toEqual({
        type: "heading_1",
        heading_1: {
          rich_text: [{ type: "text", text: { content: "Title" } }],
          is_toggleable: false,
        },
      });
    });

    it("creates toggleable heading 2", () => {
      const block = blocks.heading2("Toggle Title", true);
      const heading = block as { heading_2: { is_toggleable: boolean } };
      expect(heading.heading_2.is_toggleable).toBe(true);
    });

    it("creates heading 3", () => {
      const block = blocks.heading3("Small Title");
      expect(block.type).toBe("heading_3");
    });
  });

  describe("list items", () => {
    it("creates bulleted list item", () => {
      const block = blocks.bulletedListItem("Item 1");
      expect(block.type).toBe("bulleted_list_item");
    });

    it("creates numbered list item", () => {
      const block = blocks.numberedListItem("Step 1");
      expect(block.type).toBe("numbered_list_item");
    });

    it("creates bulleted list item with children", () => {
      const block = blocks.bulletedListItem("Parent", [blocks.bulletedListItem("Child")]);
      const item = block as { bulleted_list_item: { children: unknown[] } };
      expect(item.bulleted_list_item.children).toHaveLength(1);
    });
  });

  describe("to-do", () => {
    it("creates unchecked to-do", () => {
      const block = blocks.toDo("Task");
      const todo = block as { to_do: { checked: boolean } };
      expect(todo.to_do.checked).toBe(false);
    });

    it("creates checked to-do", () => {
      const block = blocks.toDo("Done task", true);
      const todo = block as { to_do: { checked: boolean } };
      expect(todo.to_do.checked).toBe(true);
    });
  });

  describe("code", () => {
    it("creates code block with language", () => {
      const block = blocks.code("const x = 1;", "typescript");
      expect(block).toEqual({
        type: "code",
        code: {
          rich_text: [{ type: "text", text: { content: "const x = 1;" } }],
          language: "typescript",
        },
      });
    });

    it("creates code block with caption", () => {
      const block = blocks.code("code", "javascript", "Example");
      const code = block as { code: { caption: unknown[] } };
      expect(code.code.caption).toBeDefined();
    });
  });

  describe("quote and callout", () => {
    it("creates quote block", () => {
      const block = blocks.quote("Famous quote");
      expect(block.type).toBe("quote");
    });

    it("creates callout with emoji", () => {
      const block = blocks.callout("Warning!", "⚠️");
      const callout = block as { callout: { icon: { emoji: string } } };
      expect(callout.callout.icon.emoji).toBe("⚠️");
    });
  });

  describe("media blocks", () => {
    it("creates bookmark", () => {
      const block = blocks.bookmark("https://example.com", "Example site");
      const bookmark = block as { bookmark: { url: string } };
      expect(bookmark.bookmark.url).toBe("https://example.com");
    });

    it("creates image", () => {
      const block = blocks.image("https://example.com/img.png");
      const image = block as { image: { external: { url: string } } };
      expect(image.image.external.url).toBe("https://example.com/img.png");
    });

    it("creates embed", () => {
      const block = blocks.embed("https://youtube.com/watch?v=123");
      expect(block.type).toBe("embed");
    });
  });

  describe("structural blocks", () => {
    it("creates divider", () => {
      const block = blocks.divider();
      expect(block).toEqual({ type: "divider", divider: {} });
    });

    it("creates table of contents", () => {
      const block = blocks.tableOfContents();
      expect(block.type).toBe("table_of_contents");
    });

    it("creates toggle", () => {
      const block = blocks.toggle("Click to expand", [blocks.paragraph("Hidden content")]);
      expect(block.type).toBe("toggle");
    });
  });

  describe("table", () => {
    it("creates table with rows", () => {
      const block = blocks.table([
        ["Header 1", "Header 2"],
        ["Cell 1", "Cell 2"],
      ]);
      const table = block as { table: { table_width: number; children: unknown[] } };
      expect(table.table.table_width).toBe(2);
      expect(table.table.children).toHaveLength(2);
    });

    it("creates table with headers", () => {
      const block = blocks.table([["A", "B"]], { hasColumnHeader: true, hasRowHeader: true });
      const table = block as { table: { has_column_header: boolean; has_row_header: boolean } };
      expect(table.table.has_column_header).toBe(true);
      expect(table.table.has_row_header).toBe(true);
    });
  });

  describe("column list", () => {
    it("creates column list with multiple columns", () => {
      const block = blocks.columnList([
        [blocks.paragraph("Column 1")],
        [blocks.paragraph("Column 2")],
      ]);
      const columnList = block as { column_list: { children: unknown[] } };
      expect(columnList.column_list.children).toHaveLength(2);
    });
  });

  describe("synced blocks", () => {
    it("creates original synced block", () => {
      const block = blocks.syncedBlock([blocks.paragraph("Synced content")]);
      const synced = block as { synced_block: { synced_from: null } };
      expect(synced.synced_block.synced_from).toBeNull();
    });

    it("creates synced block reference", () => {
      const block = blocks.syncedBlockReference("block-id-123");
      const synced = block as { synced_block: { synced_from: { block_id: string } } };
      expect(synced.synced_block.synced_from.block_id).toBe("block-id-123");
    });
  });

  describe("equation", () => {
    it("creates equation block", () => {
      const block = blocks.equation("E = mc^2");
      const equation = block as { equation: { expression: string } };
      expect(equation.equation.expression).toBe("E = mc^2");
    });
  });
});

describe("properties", () => {
  it("creates title property", () => {
    const prop = properties.title("Page Title");
    expect(prop).toEqual({
      title: [{ text: { content: "Page Title" } }],
    });
  });

  it("creates rich text property", () => {
    const prop = properties.richText("Some text");
    expect(prop).toEqual({
      rich_text: [{ text: { content: "Some text" } }],
    });
  });

  it("creates number property", () => {
    const prop = properties.number(42);
    expect(prop).toEqual({ number: 42 });
  });

  it("creates select property", () => {
    const prop = properties.select("Option A");
    expect(prop).toEqual({ select: { name: "Option A" } });
  });

  it("creates multi-select property", () => {
    const prop = properties.multiSelect(["Tag1", "Tag2"]);
    expect(prop).toEqual({
      multi_select: [{ name: "Tag1" }, { name: "Tag2" }],
    });
  });

  it("creates date property", () => {
    const prop = properties.date("2024-01-01");
    expect(prop).toEqual({ date: { start: "2024-01-01" } });
  });

  it("creates date range property", () => {
    const prop = properties.date("2024-01-01", "2024-01-31");
    expect(prop).toEqual({ date: { start: "2024-01-01", end: "2024-01-31" } });
  });

  it("creates checkbox property", () => {
    expect(properties.checkbox(true)).toEqual({ checkbox: true });
    expect(properties.checkbox(false)).toEqual({ checkbox: false });
  });

  it("creates url property", () => {
    const prop = properties.url("https://example.com");
    expect(prop).toEqual({ url: "https://example.com" });
  });

  it("creates email property", () => {
    const prop = properties.email("test@example.com");
    expect(prop).toEqual({ email: "test@example.com" });
  });

  it("creates phone property", () => {
    const prop = properties.phone("+1234567890");
    expect(prop).toEqual({ phone_number: "+1234567890" });
  });

  it("creates relation property", () => {
    const prop = properties.relation(["page-1", "page-2"]);
    expect(prop).toEqual({
      relation: [{ id: "page-1" }, { id: "page-2" }],
    });
  });

  it("creates people property", () => {
    const prop = properties.people(["user-1"]);
    expect(prop).toEqual({
      people: [{ id: "user-1" }],
    });
  });

  it("creates status property", () => {
    const prop = properties.status("In Progress");
    expect(prop).toEqual({ status: { name: "In Progress" } });
  });
});
