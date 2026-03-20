import { describe, expect, it } from "bun:test";
import { createDocument, loadDocument, parseMarkdown, type Document } from "./document-blocks";

const MEETING_TEMPLATE = `# Weekly Standup

## Status

**Not Started**

---

## Agenda

- [ ] Review last week's action items
- [ ] Team updates
- [ ] Blockers discussion
- [ ] Next week planning

---

## Notes

---

## Action Items

- [ ] @alice: Follow up on deployment
- [ ] @bob: Update documentation
`;

describe("document-blocks", () => {
  describe("parseMarkdown", () => {
    it("parses document title", () => {
      const doc = parseMarkdown(MEETING_TEMPLATE);
      expect(doc.title).toBe("Weekly Standup");
    });

    it("parses checklist blocks", () => {
      const doc = parseMarkdown(MEETING_TEMPLATE);
      const agenda = doc.blocks.find((b) => b.id === "agenda");

      expect(agenda?.type).toBe("checklist");
      if (agenda?.type === "checklist") {
        expect(agenda.items).toHaveLength(4);
        expect(agenda.items[0]).toEqual({
          text: "Review last week's action items",
          checked: false,
        });
      }
    });

    it("parses section blocks", () => {
      const doc = parseMarkdown(MEETING_TEMPLATE);
      const notes = doc.blocks.find((b) => b.id === "notes");

      expect(notes?.type).toBe("section");
      if (notes?.type === "section") {
        expect(notes.content).toBe("");
      }
    });

    it("parses status blocks", () => {
      const doc = parseMarkdown(MEETING_TEMPLATE);
      const status = doc.blocks.find((b) => b.id === "status");

      expect(status?.type).toBe("status");
      if (status?.type === "status") {
        expect(status.value).toBe("Not Started");
      }
    });
  });

  describe("ChecklistAPI", () => {
    it("toggles items", () => {
      const doc = loadDocument(MEETING_TEMPLATE);
      const agenda = doc.checklist("agenda");

      expect(agenda.items()[0].checked).toBe(false);
      agenda.toggle(0);
      expect(agenda.items()[0].checked).toBe(true);
      agenda.toggle(0);
      expect(agenda.items()[0].checked).toBe(false);
    });

    it("checks and unchecks items", () => {
      const doc = loadDocument(MEETING_TEMPLATE);
      const agenda = doc.checklist("agenda");

      agenda.check(0);
      expect(agenda.items()[0].checked).toBe(true);
      agenda.uncheck(0);
      expect(agenda.items()[0].checked).toBe(false);
    });

    it("adds items", () => {
      const doc = loadDocument(MEETING_TEMPLATE);
      const agenda = doc.checklist("agenda");

      const initialCount = agenda.items().length;
      agenda.add("New item");
      expect(agenda.items()).toHaveLength(initialCount + 1);
      expect(agenda.items()[initialCount]).toEqual({
        text: "New item",
        checked: false,
      });
    });

    it("removes items", () => {
      const doc = loadDocument(MEETING_TEMPLATE);
      const agenda = doc.checklist("agenda");

      const initialCount = agenda.items().length;
      agenda.remove(0);
      expect(agenda.items()).toHaveLength(initialCount - 1);
    });

    it("filters checked/unchecked items", () => {
      const doc = loadDocument(MEETING_TEMPLATE);
      const agenda = doc.checklist("agenda");

      agenda.check(0);
      agenda.check(2);

      expect(agenda.checked()).toHaveLength(2);
      expect(agenda.unchecked()).toHaveLength(2);
    });
  });

  describe("SectionAPI", () => {
    it("gets and sets content", () => {
      const doc = loadDocument(MEETING_TEMPLATE);
      const notes = doc.section("notes");

      expect(notes.get()).toBe("");
      notes.set("First note");
      expect(notes.get()).toBe("First note");
    });

    it("appends content", () => {
      const doc = loadDocument(MEETING_TEMPLATE);
      const notes = doc.section("notes");

      notes.set("Line 1");
      notes.append("Line 2");
      expect(notes.get()).toBe("Line 1\nLine 2");
    });

    it("prepends content", () => {
      const doc = loadDocument(MEETING_TEMPLATE);
      const notes = doc.section("notes");

      notes.set("Line 2");
      notes.prepend("Line 1");
      expect(notes.get()).toBe("Line 1\nLine 2");
    });

    it("clears content", () => {
      const doc = loadDocument(MEETING_TEMPLATE);
      const notes = doc.section("notes");

      notes.set("Some content");
      notes.clear();
      expect(notes.get()).toBe("");
    });
  });

  describe("StatusAPI", () => {
    it("gets and sets value", () => {
      const doc: Document = {
        title: "Test",
        blocks: [
          {
            type: "status",
            id: "phase",
            label: "Phase",
            value: "planning",
            options: ["planning", "in-progress", "review", "done"],
          },
        ],
      };
      const api = createDocument(doc);
      const phase = api.status("phase");

      expect(phase.get()).toBe("planning");
      phase.set("in-progress");
      expect(phase.get()).toBe("in-progress");
    });

    it("throws on invalid value", () => {
      const doc: Document = {
        title: "Test",
        blocks: [
          {
            type: "status",
            id: "phase",
            label: "Phase",
            value: "planning",
            options: ["planning", "done"],
          },
        ],
      };
      const api = createDocument(doc);
      const phase = api.status("phase");

      expect(() => phase.set("invalid")).toThrow();
    });

    it("validates options", () => {
      const doc: Document = {
        title: "Test",
        blocks: [
          {
            type: "status",
            id: "phase",
            label: "Phase",
            value: "planning",
            options: ["planning", "done"],
          },
        ],
      };
      const api = createDocument(doc);
      const phase = api.status("phase");

      expect(phase.isValid("planning")).toBe(true);
      expect(phase.isValid("invalid")).toBe(false);
    });
  });

  describe("toMarkdown", () => {
    it("round-trips through parse and serialize", () => {
      const doc = loadDocument(MEETING_TEMPLATE);

      // Make some changes
      doc.checklist("agenda").check(0);
      doc.section("notes").set("- Discussed deployment timeline");

      const output = doc.toMarkdown();

      // Verify changes persist
      expect(output).toContain("- [x] Review last week's action items");
      expect(output).toContain("- Discussed deployment timeline");
    });

    it("preserves document structure", () => {
      const doc: Document = {
        title: "Test Doc",
        blocks: [
          {
            type: "checklist",
            id: "tasks",
            title: "Tasks",
            items: [
              { text: "Task 1", checked: true },
              { text: "Task 2", checked: false },
            ],
          },
          {
            type: "section",
            id: "notes",
            title: "Notes",
            content: "Some notes here",
          },
        ],
      };

      const api = createDocument(doc);
      const md = api.toMarkdown();

      expect(md).toContain("# Test Doc");
      expect(md).toContain("## Tasks");
      expect(md).toContain("- [x] Task 1");
      expect(md).toContain("- [ ] Task 2");
      expect(md).toContain("## Notes");
      expect(md).toContain("Some notes here");
    });
  });

  describe("error handling", () => {
    it("throws when accessing non-existent block", () => {
      const doc = loadDocument(MEETING_TEMPLATE);

      expect(() => doc.checklist("nonexistent")).toThrow();
      expect(() => doc.section("nonexistent")).toThrow();
      expect(() => doc.status("nonexistent")).toThrow();
    });

    it("throws when accessing block with wrong type", () => {
      const doc = loadDocument(MEETING_TEMPLATE);

      expect(() => doc.checklist("notes")).toThrow(); // notes is a section
      expect(() => doc.section("agenda")).toThrow(); // agenda is a checklist
    });
  });
});
