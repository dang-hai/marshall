import { describe, expect, test } from "bun:test";
import {
  buildChangelogSection,
  bumpVersion,
  determineReleaseType,
  parseSemanticCommit,
} from "../../../scripts/prepare-release.mjs";

describe("prepare release versioning", () => {
  test("bumps patch versions", () => {
    expect(bumpVersion("0.0.1", "patch")).toBe("0.0.2");
  });

  test("bumps minor versions", () => {
    expect(bumpVersion("1.4.9", "minor")).toBe("1.5.0");
  });

  test("bumps major versions", () => {
    expect(bumpVersion("2.9.9", "major")).toBe("3.0.0");
  });

  test("parses scoped conventional commits", () => {
    expect(parseSemanticCommit("feat(marketing): add release workflow", "", "abc1234")).toEqual({
      type: "feat",
      description: "add release workflow",
      scope: "marketing",
      isBreaking: false,
      hash: "abc1234",
    });
  });

  test("detects breaking changes from bang syntax", () => {
    expect(parseSemanticCommit("feat(api)!: remove legacy route")).toMatchObject({
      type: "feat",
      isBreaking: true,
    });
  });

  test("uses the highest semantic bump in a commit set", () => {
    const commits = [
      parseSemanticCommit("fix(marketing): repair CTA focus"),
      parseSemanticCommit("feat(marketing): add homepage animation"),
    ];

    expect(determineReleaseType(commits)).toBe("minor");
  });

  test("generates grouped changelog sections", () => {
    const changelog = buildChangelogSection(
      "1.2.0",
      [
        parseSemanticCommit("feat(marketing): add release workflow", "", "abc1234"),
        parseSemanticCommit("fix(marketing): repair deploy trigger", "", "def5678"),
      ],
      "2026-03-18"
    );

    expect(changelog).toContain("## 1.2.0 - 2026-03-18");
    expect(changelog).toContain("### Features");
    expect(changelog).toContain("- **marketing:** add release workflow (abc1234)");
    expect(changelog).toContain("### Fixes");
    expect(changelog).toContain("- **marketing:** repair deploy trigger (def5678)");
  });
});
