import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const PROTECTED_GIT_BRANCHES = new Set(["main", "master", "release"]);
export const DEFAULT_NEON_DATABASE_NAME = "marshall";
export const DEFAULT_NEON_ROLE_NAME = "marshall_owner";

function runCommand(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  }).trim();
}

export function parseEnvFile(content) {
  const values = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (key) {
      values[key] = value;
    }
  }

  return values;
}

export function getWorkspaceRoot({ cwd = process.cwd(), run = runCommand } = {}) {
  return run("git", ["rev-parse", "--show-toplevel"], { cwd });
}

export function loadWorkspaceEnv({
  cwd = process.cwd(),
  env = process.env,
  run = runCommand,
} = {}) {
  const workspaceRoot = getWorkspaceRoot({ cwd, run });

  for (const fileName of [".env.local", ".env"]) {
    const envPath = resolve(workspaceRoot, fileName);
    if (!existsSync(envPath)) {
      continue;
    }

    const values = parseEnvFile(readFileSync(envPath, "utf8"));
    for (const [key, value] of Object.entries(values)) {
      if (!(key in env)) {
        env[key] = value;
      }
    }
  }

  return workspaceRoot;
}

export function readLocalNeonProjectId(workspaceRoot) {
  const contextPath = resolve(workspaceRoot, ".neon");
  if (!existsSync(contextPath)) {
    return undefined;
  }

  const context = JSON.parse(readFileSync(contextPath, "utf8"));
  return typeof context.projectId === "string" ? context.projectId : undefined;
}

export function getCurrentGitBranch({ cwd = process.cwd(), run = runCommand } = {}) {
  const branchName = run("git", ["branch", "--show-current"], { cwd });
  if (!branchName) {
    throw new Error("Unable to determine the current Git branch.");
  }

  return branchName;
}

export function isProtectedGitBranch(gitBranch) {
  return PROTECTED_GIT_BRANCHES.has(gitBranch);
}

export function toNeonPreviewBranchName(gitBranch) {
  const slug = gitBranch
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const hash = createHash("sha256").update(gitBranch).digest("hex").slice(0, 8);
  const maxSlugLength = 50;
  const safeSlug = (slug || "branch").slice(0, maxSlugLength).replace(/-+$/g, "");

  return `git-${safeSlug || "branch"}-${hash}`;
}

export function getPullRequestNumber({ gitBranch, cwd = process.cwd() } = {}) {
  try {
    const output = runCommand(
      "gh",
      [
        "pr",
        "list",
        "--head",
        gitBranch,
        "--state",
        "open",
        "--json",
        "number",
        "--jq",
        ".[0].number",
      ],
      { cwd }
    );
    const prNumber = Number.parseInt(output, 10);
    return Number.isNaN(prNumber) ? null : prNumber;
  } catch {
    return null;
  }
}

export function getNeonBranchNameForGitBranch(gitBranch, { cwd = process.cwd() } = {}) {
  if (isProtectedGitBranch(gitBranch)) {
    return gitBranch;
  }

  // Try to get PR number for pr-<number> naming
  const prNumber = getPullRequestNumber({ gitBranch, cwd });
  if (prNumber) {
    return `pr-${prNumber}`;
  }

  // Fallback to old naming if no PR exists yet
  return toNeonPreviewBranchName(gitBranch);
}

export function getBranchDatabaseUrl({
  branchName,
  projectId,
  databaseName = DEFAULT_NEON_DATABASE_NAME,
  roleName = DEFAULT_NEON_ROLE_NAME,
  cwd = process.cwd(),
  env = process.env,
  run = runCommand,
} = {}) {
  try {
    return run(
      "neon",
      [
        "connection-string",
        branchName,
        "--project-id",
        projectId,
        "--database-name",
        databaseName,
        "--role-name",
        roleName,
      ],
      { cwd, env }
    );
  } catch (error) {
    const detail =
      error instanceof Error && "stderr" in error && typeof error.stderr === "string"
        ? error.stderr.trim()
        : error instanceof Error
          ? error.message
          : String(error);

    throw new Error(
      `Failed to resolve the Neon database URL for Git branch "${branchName}". ` +
        `Ensure the PR preview workflow created the Neon branch and that the Neon CLI is authenticated. ${detail}`,
      { cause: error }
    );
  }
}

export function selectDatabaseUrl({
  gitBranch,
  externalDatabaseUrl,
  loadedDatabaseUrl,
  neonProjectId,
  databaseName = DEFAULT_NEON_DATABASE_NAME,
  roleName = DEFAULT_NEON_ROLE_NAME,
  preferBranchUrl = false,
  getBranchUrl,
  cwd = process.cwd(),
} = {}) {
  if (!neonProjectId && !loadedDatabaseUrl) {
    throw new Error(
      "DATABASE_URL is required. Set it explicitly, or configure NEON_PROJECT_ID/.neon so branch-specific URLs can be resolved."
    );
  }

  if (preferBranchUrl && neonProjectId) {
    return getBranchUrl({
      branchName: getNeonBranchNameForGitBranch(gitBranch, { cwd }),
      projectId: neonProjectId,
      databaseName,
      roleName,
    });
  }

  if (externalDatabaseUrl) {
    return externalDatabaseUrl;
  }

  if (isProtectedGitBranch(gitBranch)) {
    if (loadedDatabaseUrl) {
      return loadedDatabaseUrl;
    }

    if (!neonProjectId) {
      throw new Error(
        `Unable to resolve the database URL for protected branch "${gitBranch}". Set DATABASE_URL or NEON_PROJECT_ID.`
      );
    }

    return getBranchUrl({
      branchName: getNeonBranchNameForGitBranch(gitBranch, { cwd }),
      projectId: neonProjectId,
      databaseName,
      roleName,
    });
  }

  if (!neonProjectId) {
    throw new Error(
      `Feature branch "${gitBranch}" must use a Neon preview branch. Set NEON_PROJECT_ID or create a local .neon context file instead of using the shared DATABASE_URL.`
    );
  }

  return getBranchUrl({
    branchName: getNeonBranchNameForGitBranch(gitBranch, { cwd }),
    projectId: neonProjectId,
    databaseName,
    roleName,
  });
}

export function resolveDatabaseUrlSync({
  cwd = process.cwd(),
  env = process.env,
  run = runCommand,
  getBranchUrl = getBranchDatabaseUrl,
} = {}) {
  const preferBranchUrl = env.NEON_FORCE_BRANCH_URL === "1";
  const externalDatabaseUrl = env.DATABASE_URL;
  if (externalDatabaseUrl && !preferBranchUrl) {
    return externalDatabaseUrl;
  }

  const workspaceRoot = loadWorkspaceEnv({ cwd, env, run });
  const gitBranch = getCurrentGitBranch({ cwd, run });
  const neonProjectId = env.NEON_PROJECT_ID || readLocalNeonProjectId(workspaceRoot);

  return selectDatabaseUrl({
    gitBranch,
    externalDatabaseUrl,
    loadedDatabaseUrl: env.DATABASE_URL,
    neonProjectId,
    databaseName: env.NEON_DATABASE_NAME || DEFAULT_NEON_DATABASE_NAME,
    roleName: env.NEON_ROLE_NAME || DEFAULT_NEON_ROLE_NAME,
    preferBranchUrl,
    cwd,
    getBranchUrl: ({ branchName, projectId, databaseName, roleName }) =>
      getBranchUrl({
        branchName,
        projectId,
        databaseName,
        roleName,
        cwd,
        env,
        run,
      }),
  });
}

const isEntrypoint =
  process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isEntrypoint) {
  process.stdout.write(`${resolveDatabaseUrlSync()}\n`);
}
