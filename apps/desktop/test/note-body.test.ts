import { describe, expect, test } from "bun:test";
import { applyCodexNotePatch } from "../src/renderer/src/lib/note-body";

describe("applyCodexNotePatch", () => {
  test("checks off matching markdown checklist items and appends generated sections", () => {
    const bodyHtml = [
      '<div class="min-h-[1.85rem]"># Kickoff</div>',
      '<div class="min-h-[1.85rem]">- [ ] Confirm launch owner</div>',
      '<div class="min-h-[1.85rem]">- [ ] Align on timeline</div>',
    ].join("");

    const nextHtml = applyCodexNotePatch(bodyHtml, {
      noteId: "note-1",
      checkedPlanItems: ["Confirm launch owner"],
      followUps: ["Send the revised launch timeline to the team."],
      summary: "The team confirmed the launch owner and agreed to send a revised timeline.",
      final: true,
      generatedAt: new Date().toISOString(),
    });

    expect(nextHtml).toContain("- [x] Confirm launch owner");
    expect(nextHtml).toContain("- [ ] Align on timeline");
    expect(nextHtml).toContain("Follow-up");
    expect(nextHtml).toContain("Send the revised launch timeline to the team.");
    expect(nextHtml).toContain("Call summary");
  });

  test("replaces existing generated sections instead of duplicating them", () => {
    const bodyHtml = [
      '<div class="min-h-[1.85rem]">- [x] Confirm launch owner</div>',
      '<div data-marshall-section="followups" data-marshall-role="heading" class="min-h-[1.85rem]">Follow-up</div>',
      '<div data-marshall-section="followups" data-marshall-role="item" class="min-h-[1.85rem]">Old task</div>',
      '<div data-marshall-section="summary" data-marshall-role="heading" class="min-h-[1.85rem]">Call summary</div>',
      '<div data-marshall-section="summary" data-marshall-role="body" class="min-h-[1.85rem]">Old summary</div>',
    ].join("");

    const nextHtml = applyCodexNotePatch(bodyHtml, {
      noteId: "note-1",
      checkedPlanItems: [],
      followUps: ["Book the legal review."],
      summary: "A legal review is still required before launch.",
      final: true,
      generatedAt: new Date().toISOString(),
    });

    expect(nextHtml).not.toContain("Old task");
    expect(nextHtml).not.toContain("Old summary");
    expect(nextHtml).toContain("Book the legal review.");
    expect(nextHtml).toContain("A legal review is still required before launch.");
  });
});
