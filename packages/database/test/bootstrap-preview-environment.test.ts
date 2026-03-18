import { describe, expect, it } from "bun:test";
import {
  pickPreviewWorkflowRun,
  planPreviewBootstrap,
} from "../../../scripts/bootstrap-preview-environment.mjs";

describe("planPreviewBootstrap", () => {
  it("skips preview PR automation on protected branches", () => {
    expect(
      planPreviewBootstrap({
        gitBranch: "main",
        pullRequest: null,
        aheadCount: 0,
        worktreeClean: true,
      })
    ).toEqual({
      shouldCreateBootstrapCommit: false,
      shouldCreatePullRequest: false,
      shouldReopenPullRequest: false,
    });
  });

  it("creates an empty bootstrap commit when the branch has no commits ahead", () => {
    expect(
      planPreviewBootstrap({
        gitBranch: "feature/preview-db",
        pullRequest: null,
        aheadCount: 0,
        worktreeClean: true,
      })
    ).toEqual({
      shouldCreateBootstrapCommit: true,
      shouldCreatePullRequest: true,
      shouldReopenPullRequest: false,
    });
  });

  it("fails on a dirty worktree when an empty bootstrap commit would be needed", () => {
    expect(() =>
      planPreviewBootstrap({
        gitBranch: "feature/preview-db",
        pullRequest: null,
        aheadCount: 0,
        worktreeClean: false,
      })
    ).toThrow(/dirty worktree/);
  });

  it("reopens a closed PR instead of creating a new one", () => {
    expect(
      planPreviewBootstrap({
        gitBranch: "feature/preview-db",
        pullRequest: {
          number: 12,
          state: "CLOSED",
        },
        aheadCount: 1,
        worktreeClean: false,
      })
    ).toEqual({
      shouldCreateBootstrapCommit: false,
      shouldCreatePullRequest: false,
      shouldReopenPullRequest: true,
    });
  });
});

describe("pickPreviewWorkflowRun", () => {
  it("selects the latest preview workflow run", () => {
    expect(
      pickPreviewWorkflowRun([
        {
          databaseId: 10,
          name: "Neon Preview Branches",
        },
        {
          databaseId: 12,
          name: "Build and Release",
        },
        {
          databaseId: 14,
          name: "Neon Preview Branches",
        },
      ])
    ).toEqual({
      databaseId: 14,
      name: "Neon Preview Branches",
    });
  });
});
