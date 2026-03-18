import { describe, expect, it } from "bun:test";
import {
  getNeonBranchNameForGitBranch,
  parseEnvFile,
  resolveDatabaseUrlSync,
  selectDatabaseUrl,
  toNeonPreviewBranchName,
} from "../../../scripts/neon-branch-utils.mjs";

describe("toNeonPreviewBranchName", () => {
  it("creates a deterministic preview branch name", () => {
    const branchName = toNeonPreviewBranchName("feature/Add Auth");

    expect(branchName).toMatch(/^git-feature-add-auth-[0-9a-f]{8}$/);
    expect(branchName.length).toBeLessThanOrEqual(63);
    expect(branchName).toBe(toNeonPreviewBranchName("feature/Add Auth"));
  });

  it("falls back to a safe branch slug", () => {
    const branchName = toNeonPreviewBranchName("////");
    expect(branchName).toMatch(/^git-branch-[0-9a-f]{8}$/);
  });
});

describe("getNeonBranchNameForGitBranch", () => {
  it("keeps protected branches unchanged", () => {
    expect(getNeonBranchNameForGitBranch("main")).toBe("main");
    expect(getNeonBranchNameForGitBranch("release")).toBe("release");
  });
});

describe("selectDatabaseUrl", () => {
  it("uses the branch database for feature branches instead of the loaded shared URL", () => {
    const databaseUrl = selectDatabaseUrl({
      gitBranch: "feature/db-preview",
      loadedDatabaseUrl: "postgres://production",
      neonProjectId: "calm-scene-04566116",
      getBranchUrl: ({ branchName, projectId }) => `postgres://${projectId}/${branchName}`,
    });

    expect(databaseUrl).toBe(
      `postgres://calm-scene-04566116/${getNeonBranchNameForGitBranch("feature/db-preview")}`
    );
  });

  it("preserves an explicitly provided DATABASE_URL override", () => {
    const databaseUrl = selectDatabaseUrl({
      gitBranch: "feature/db-preview",
      externalDatabaseUrl: "postgres://explicit",
      loadedDatabaseUrl: "postgres://production",
      neonProjectId: "calm-scene-04566116",
      getBranchUrl: () => "postgres://branch",
    });

    expect(databaseUrl).toBe("postgres://explicit");
  });

  it("uses the loaded DATABASE_URL for protected branches", () => {
    const databaseUrl = selectDatabaseUrl({
      gitBranch: "main",
      loadedDatabaseUrl: "postgres://production",
      neonProjectId: "calm-scene-04566116",
      getBranchUrl: () => "postgres://main-branch",
    });

    expect(databaseUrl).toBe("postgres://production");
  });

  it("can force a protected branch to resolve from Neon instead of the loaded env", () => {
    const databaseUrl = selectDatabaseUrl({
      gitBranch: "main",
      loadedDatabaseUrl: "postgres://production",
      neonProjectId: "calm-scene-04566116",
      preferBranchUrl: true,
      getBranchUrl: () => "postgres://main-preview",
    });

    expect(databaseUrl).toBe("postgres://main-preview");
  });

  it("fails closed on feature branches without a Neon project id", () => {
    expect(() =>
      selectDatabaseUrl({
        gitBranch: "feature/db-preview",
        loadedDatabaseUrl: "postgres://production",
        getBranchUrl: () => "postgres://branch",
      })
    ).toThrow(/must use a Neon preview branch/);
  });
});

describe("parseEnvFile", () => {
  it("parses simple env files and ignores comments", () => {
    expect(
      parseEnvFile(`
# comment
DATABASE_URL=postgres://example
NEON_PROJECT_ID=project-123
`)
    ).toEqual({
      DATABASE_URL: "postgres://example",
      NEON_PROJECT_ID: "project-123",
    });
  });
});

describe("resolveDatabaseUrlSync", () => {
  it("returns an explicit DATABASE_URL without touching git state", () => {
    const databaseUrl = resolveDatabaseUrlSync({
      env: {
        DATABASE_URL: "postgres://explicit",
      },
      run: () => {
        throw new Error("git should not be called");
      },
    });

    expect(databaseUrl).toBe("postgres://explicit");
  });

  it("ignores an explicit DATABASE_URL when branch resolution is forced", () => {
    const databaseUrl = resolveDatabaseUrlSync({
      env: {
        DATABASE_URL: "postgres://production",
        NEON_FORCE_BRANCH_URL: "1",
        NEON_PROJECT_ID: "calm-scene-04566116",
      },
      run: (command, args) => {
        if (command === "git" && args[0] === "rev-parse") {
          return "/tmp/marshall";
        }

        if (command === "git" && args[0] === "branch") {
          return "setup-a-new-neon-project-called-marshall";
        }

        throw new Error(`unexpected command: ${command} ${args.join(" ")}`);
      },
      getBranchUrl: ({ branchName, projectId }) => `postgres://${projectId}/${branchName}`,
    });

    expect(databaseUrl).toBe(
      `postgres://calm-scene-04566116/${getNeonBranchNameForGitBranch("setup-a-new-neon-project-called-marshall")}`
    );
  });
});
