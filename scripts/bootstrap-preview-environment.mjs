import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  getCurrentGitBranch,
  getNeonBranchNameForGitBranch,
  getWorkspaceRoot,
  isProtectedGitBranch,
  readLocalNeonProjectId,
  resolveDatabaseUrlSync,
} from "./neon-branch-utils.mjs";

const PREVIEW_WORKFLOW_NAME = "Neon Preview Branches";
const BOOTSTRAP_COMMIT_MESSAGE = "chore: initialize preview environment";
const BOOTSTRAP_PR_BODY = `## Summary
- initialize the Neon preview database for this branch

## Notes
- created automatically by scripts/setup.sh
`;

function run(command, args, options = {}) {
  const output = execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });

  return typeof output === "string" ? output.trim() : "";
}

function runJson(command, args, options = {}) {
  const output = run(command, args, options);
  return output ? JSON.parse(output) : null;
}

function runSideEffect(command, args, options = {}) {
  execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "ignore", "inherit"],
    ...options,
  });
}

function commandExists(command, { cwd = process.cwd() } = {}) {
  try {
    run("which", [command], { cwd });
    return true;
  } catch {
    return false;
  }
}

function sleep(ms) {
  return new Promise((resolveSleep) => {
    globalThis.setTimeout(resolveSleep, ms);
  });
}

function getWorktreeStatus({ cwd = process.cwd() } = {}) {
  return run("git", ["status", "--short"], { cwd });
}

function getDefaultBaseBranch({ cwd = process.cwd(), env = process.env } = {}) {
  const repo = runJson("gh", ["repo", "view", "--json", "defaultBranchRef"], { cwd, env });
  return repo.defaultBranchRef.name;
}

function getExistingPullRequest({ gitBranch, cwd = process.cwd(), env = process.env } = {}) {
  const prs = runJson(
    "gh",
    [
      "pr",
      "list",
      "--head",
      gitBranch,
      "--state",
      "all",
      "--json",
      "number,state,isDraft,url,headRefName,baseRefName",
    ],
    { cwd, env }
  );

  return prs[0] ?? null;
}

export function planPreviewBootstrap({ gitBranch, pullRequest, aheadCount, worktreeClean } = {}) {
  if (isProtectedGitBranch(gitBranch)) {
    return {
      shouldCreateBootstrapCommit: false,
      shouldCreatePullRequest: false,
      shouldReopenPullRequest: false,
    };
  }

  if (pullRequest?.state === "OPEN") {
    return {
      shouldCreateBootstrapCommit: false,
      shouldCreatePullRequest: false,
      shouldReopenPullRequest: false,
    };
  }

  if (pullRequest?.state === "CLOSED") {
    return {
      shouldCreateBootstrapCommit: false,
      shouldCreatePullRequest: false,
      shouldReopenPullRequest: true,
    };
  }

  if (pullRequest?.state === "MERGED") {
    throw new Error(
      `Branch "${gitBranch}" already has a merged PR. Create a new branch for a fresh preview environment.`
    );
  }

  if (aheadCount === 0 && !worktreeClean) {
    throw new Error(
      `Cannot auto-create the preview PR for "${gitBranch}" from a dirty worktree with no commits ahead of the base branch. Commit or stash changes first.`
    );
  }

  return {
    shouldCreateBootstrapCommit: aheadCount === 0,
    shouldCreatePullRequest: true,
    shouldReopenPullRequest: false,
  };
}

export function pickPreviewWorkflowRun(runs) {
  return [...runs]
    .filter((runItem) => runItem.name === PREVIEW_WORKFLOW_NAME)
    .sort((left, right) => right.databaseId - left.databaseId)[0];
}

function ensureCommand(command, message, { cwd = process.cwd() } = {}) {
  if (!commandExists(command, { cwd })) {
    throw new Error(message);
  }
}

function ensureBranchPushed({ cwd = process.cwd(), env = process.env } = {}) {
  runSideEffect("git", ["push", "-u", "origin", "HEAD"], { cwd, env });
}

function ensureBootstrapCommit({ cwd = process.cwd(), env = process.env } = {}) {
  runSideEffect("git", ["commit", "--allow-empty", "-m", BOOTSTRAP_COMMIT_MESSAGE], {
    cwd,
    env,
  });
}

function createDraftPullRequest({
  gitBranch,
  baseBranch,
  cwd = process.cwd(),
  env = process.env,
} = {}) {
  runSideEffect(
    "gh",
    [
      "pr",
      "create",
      "--draft",
      "--base",
      baseBranch,
      "--head",
      gitBranch,
      "--title",
      gitBranch,
      "--body",
      BOOTSTRAP_PR_BODY,
    ],
    { cwd, env }
  );
}

function reopenPullRequest({ pullRequestNumber, cwd = process.cwd(), env = process.env } = {}) {
  runSideEffect("gh", ["pr", "reopen", String(pullRequestNumber)], { cwd, env });
}

async function waitForWorkflowRun({
  gitBranch,
  cwd = process.cwd(),
  env = process.env,
  timeoutMs = 180000,
} = {}) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const runs = runJson(
      "gh",
      [
        "run",
        "list",
        "--workflow",
        PREVIEW_WORKFLOW_NAME,
        "--branch",
        gitBranch,
        "--limit",
        "10",
        "--json",
        "databaseId,name,status,conclusion,url",
      ],
      { cwd, env }
    );
    const previewRun = pickPreviewWorkflowRun(runs);
    if (previewRun) {
      if (previewRun.status !== "completed") {
        runSideEffect("gh", ["run", "watch", String(previewRun.databaseId), "--exit-status"], {
          cwd,
          env,
        });
      } else if (previewRun.conclusion !== "success") {
        throw new Error(
          `The "${PREVIEW_WORKFLOW_NAME}" workflow failed for branch "${gitBranch}". Inspect ${previewRun.url}.`
        );
      }

      return previewRun;
    }

    await sleep(3000);
  }

  throw new Error(
    `Timed out waiting for the "${PREVIEW_WORKFLOW_NAME}" workflow run for branch "${gitBranch}".`
  );
}

async function waitForNeonBranchReady({
  neonBranchName,
  projectId,
  cwd = process.cwd(),
  env = process.env,
  timeoutMs = 180000,
} = {}) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const branch = runJson(
        "neon",
        ["branches", "get", neonBranchName, "--project-id", projectId, "--output", "json"],
        { cwd, env }
      );
      if (branch.current_state === "ready") {
        return branch;
      }
    } catch {
      // The workflow may still be provisioning the branch. Keep polling.
    }

    await sleep(3000);
  }

  throw new Error(
    `Timed out waiting for Neon branch "${neonBranchName}" in project "${projectId}" to become ready.`
  );
}

function ensureLocalNeonContext({ workspaceRoot, projectId } = {}) {
  const contextPath = resolve(workspaceRoot, ".neon");
  const nextContent = `${JSON.stringify({ projectId }, null, 2)}\n`;

  if (existsSync(contextPath)) {
    const currentProjectId = readLocalNeonProjectId(workspaceRoot);
    if (currentProjectId === projectId) {
      return;
    }
  }

  writeFileSync(contextPath, nextContent);
}

function getNeonProjectId({ workspaceRoot, cwd = process.cwd(), env = process.env } = {}) {
  const localProjectId = env.NEON_PROJECT_ID || readLocalNeonProjectId(workspaceRoot);
  if (localProjectId && localProjectId !== "your-neon-project-id") {
    env.NEON_PROJECT_ID = localProjectId;
    return localProjectId;
  }

  const variableProjectId = run("gh", ["variable", "get", "NEON_PROJECT_ID"], { cwd, env });
  if (!variableProjectId) {
    throw new Error(
      "Unable to resolve NEON_PROJECT_ID locally or from GitHub repository variables."
    );
  }

  env.NEON_PROJECT_ID = variableProjectId;
  ensureLocalNeonContext({ workspaceRoot, projectId: variableProjectId });
  return variableProjectId;
}

async function ensurePreviewPullRequest({
  gitBranch,
  workspaceRoot,
  cwd = process.cwd(),
  env = process.env,
} = {}) {
  if (isProtectedGitBranch(gitBranch)) {
    return null;
  }

  ensureCommand("gh", "gh is required to create the preview PR automatically.", { cwd });
  ensureCommand("neon", "neon is required to wait for the preview database.", { cwd });

  const baseBranch = getDefaultBaseBranch({ cwd, env });
  runSideEffect("git", ["fetch", "origin", baseBranch], { cwd, env });

  const aheadCount = Number(
    run("git", ["rev-list", "--count", `origin/${baseBranch}..HEAD`], { cwd, env })
  );
  const worktreeClean = getWorktreeStatus({ cwd }) === "";
  const pullRequest = getExistingPullRequest({ gitBranch, cwd, env });
  const plan = planPreviewBootstrap({
    gitBranch,
    pullRequest,
    aheadCount,
    worktreeClean,
  });

  if (plan.shouldCreateBootstrapCommit) {
    ensureBootstrapCommit({ cwd, env });
  }

  if (plan.shouldCreateBootstrapCommit || plan.shouldCreatePullRequest) {
    ensureBranchPushed({ cwd, env });
  }

  if (plan.shouldReopenPullRequest) {
    reopenPullRequest({
      pullRequestNumber: pullRequest.number,
      cwd,
      env,
    });
  }

  if (plan.shouldCreatePullRequest) {
    createDraftPullRequest({
      gitBranch,
      baseBranch,
      cwd,
      env,
    });
  }

  const neonBranchName = getNeonBranchNameForGitBranch(gitBranch);
  const projectId = getNeonProjectId({ workspaceRoot, cwd, env });

  await waitForWorkflowRun({
    gitBranch,
    cwd,
    env,
  });
  await waitForNeonBranchReady({
    neonBranchName,
    projectId,
    cwd,
    env,
  });

  return getExistingPullRequest({ gitBranch, cwd, env });
}

export async function bootstrapPreviewEnvironment({ cwd = process.cwd(), env = process.env } = {}) {
  const workspaceRoot = getWorkspaceRoot({ cwd });
  const gitBranch = getCurrentGitBranch({ cwd });

  if (!isProtectedGitBranch(gitBranch)) {
    await ensurePreviewPullRequest({
      gitBranch,
      workspaceRoot,
      cwd,
      env,
    });
  } else {
    const projectId = getNeonProjectId({ workspaceRoot, cwd, env });
    ensureLocalNeonContext({ workspaceRoot, projectId });
  }

  return resolveDatabaseUrlSync({
    cwd,
    env: {
      ...env,
      NEON_FORCE_BRANCH_URL: "1",
    },
  });
}

const isEntrypoint =
  process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isEntrypoint) {
  bootstrapPreviewEnvironment()
    .then((databaseUrl) => {
      process.stdout.write(`${databaseUrl}\n`);
    })
    .catch((error) => {
      const detail = error instanceof Error ? error.message : String(error);
      process.stderr.write(`${detail}\n`);
      process.exitCode = 1;
    });
}
