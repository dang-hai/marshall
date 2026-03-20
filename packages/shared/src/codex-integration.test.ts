import { describe, expect, it } from "bun:test";
import {
  extractDocumentContext,
  buildDocumentPromptSection,
  applyDocumentOperations,
  buildAgentPrompt,
} from "./codex-document-integration";
import type { AgentOperation } from "./document-service";

const MEETING_TEMPLATE = `# Weekly 1:1

## Status

**Not Started**

## Agenda

- [ ] Review Q1 goals
- [ ] Discuss project timeline
- [ ] Any blockers?

## Notes

## Action Items

- [ ] (pending)
`;

describe("codex-document-integration", () => {
  describe("extractDocumentContext", () => {
    it("detects structured documents", () => {
      const result = extractDocumentContext(MEETING_TEMPLATE);
      expect(result.hasStructure).toBe(true);
      expect(result.blocks.length).toBeGreaterThan(0);
    });

    it("identifies checklist blocks with items", () => {
      const result = extractDocumentContext(MEETING_TEMPLATE);
      const agenda = result.blocks.find((b) => b.id === "agenda");

      expect(agenda).toBeDefined();
      expect(agenda?.type).toBe("checklist");
      expect(agenda?.items).toHaveLength(3);
      expect(agenda?.items?.[0]).toEqual({
        index: 0,
        text: "Review Q1 goals",
        checked: false,
      });
    });

    it("identifies section blocks", () => {
      const result = extractDocumentContext(MEETING_TEMPLATE);
      const notes = result.blocks.find((b) => b.id === "notes");

      expect(notes).toBeDefined();
      expect(notes?.type).toBe("section");
    });

    it("returns hasStructure=false for plain text", () => {
      const result = extractDocumentContext("Just some plain text notes.");
      expect(result.hasStructure).toBe(false);
    });
  });

  describe("buildDocumentPromptSection", () => {
    it("formats blocks for agent prompt", () => {
      const { section, hasStructure } = buildDocumentPromptSection(MEETING_TEMPLATE);

      expect(hasStructure).toBe(true);
      expect(section).toContain("## Document Blocks");
      expect(section).toContain('id: "agenda"');
      expect(section).toContain("[0] [ ] Review Q1 goals");
      expect(section).toContain("[1] [ ] Discuss project timeline");
    });

    it("shows checklist indices", () => {
      const { section } = buildDocumentPromptSection(MEETING_TEMPLATE);

      // Agent needs indices to reference items
      expect(section).toMatch(/\[0\].*Review Q1 goals/);
      expect(section).toMatch(/\[1\].*Discuss project timeline/);
      expect(section).toMatch(/\[2\].*Any blockers/);
    });
  });

  describe("applyDocumentOperations", () => {
    it("checks agenda items", () => {
      const ops: AgentOperation[] = [{ op: "checklist.check", blockId: "agenda", index: 0 }];

      const result = applyDocumentOperations(MEETING_TEMPLATE, ops);

      expect(result).toContain("- [x] Review Q1 goals");
      expect(result).toContain("- [ ] Discuss project timeline");
    });

    it("appends to sections", () => {
      const ops: AgentOperation[] = [
        { op: "section.append", blockId: "notes", content: "- Key insight from discussion" },
      ];

      const result = applyDocumentOperations(MEETING_TEMPLATE, ops);

      expect(result).toContain("- Key insight from discussion");
    });

    it("adds action items", () => {
      const ops: AgentOperation[] = [
        { op: "checklist.add", blockId: "action-items", text: "@alice: Follow up on API" },
      ];

      const result = applyDocumentOperations(MEETING_TEMPLATE, ops);

      expect(result).toContain("@alice: Follow up on API");
    });

    it("applies multiple operations", () => {
      const ops: AgentOperation[] = [
        { op: "checklist.check", blockId: "agenda", index: 0 },
        { op: "checklist.check", blockId: "agenda", index: 1 },
        { op: "section.append", blockId: "notes", content: "- Q1 on track" },
        { op: "section.append", blockId: "notes", content: "- Timeline pushed to April" },
        { op: "checklist.add", blockId: "action-items", text: "@bob: Send revised estimate" },
      ];

      const result = applyDocumentOperations(MEETING_TEMPLATE, ops);

      expect(result).toContain("- [x] Review Q1 goals");
      expect(result).toContain("- [x] Discuss project timeline");
      expect(result).toContain("- Q1 on track");
      expect(result).toContain("- Timeline pushed to April");
      expect(result).toContain("@bob: Send revised estimate");
    });
  });

  describe("buildAgentPrompt", () => {
    it("includes document operations instructions", () => {
      const prompt = buildAgentPrompt({
        noteTitle: "Weekly 1:1",
        noteBody: MEETING_TEMPLATE,
        transcriptExcerpt: "Alice: Let's review Q1 goals first.",
        existingItems: [],
        previousNudge: null,
        mode: "live",
      });

      expect(prompt).toContain("checklist.check");
      expect(prompt).toContain("section.append");
      expect(prompt).toContain("blockId");
    });

    it("includes transcript excerpt", () => {
      const prompt = buildAgentPrompt({
        noteTitle: "Weekly 1:1",
        noteBody: MEETING_TEMPLATE,
        transcriptExcerpt: "Alice: The Q1 goals are 80% complete.",
        existingItems: [],
        previousNudge: null,
        mode: "live",
      });

      expect(prompt).toContain("Q1 goals are 80% complete");
    });

    it("requests summary only in final mode", () => {
      const livePrompt = buildAgentPrompt({
        noteTitle: "Test",
        noteBody: MEETING_TEMPLATE,
        transcriptExcerpt: "",
        existingItems: [],
        previousNudge: null,
        mode: "live",
      });

      const finalPrompt = buildAgentPrompt({
        noteTitle: "Test",
        noteBody: MEETING_TEMPLATE,
        transcriptExcerpt: "",
        existingItems: [],
        previousNudge: null,
        mode: "final",
      });

      expect(livePrompt).toContain("summary`: null");
      expect(finalPrompt).toContain("2-3 sentence summary");
    });
  });
});
