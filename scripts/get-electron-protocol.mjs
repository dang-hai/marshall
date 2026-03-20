#!/usr/bin/env node
/**
 * Generates a worktree-specific Electron protocol name based on the current git branch.
 *
 * - Protected branches (main, master, release) use "marshall"
 * - Feature branches use "marshall-<branch-slug>" (max 50 chars, URL-safe)
 *
 * Usage: node scripts/get-electron-protocol.mjs
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const PROTECTED_BRANCHES = new Set(["main", "master", "release"]);
const BASE_PROTOCOL = "marshall";

function getCurrentGitBranch() {
  const branch = execFileSync("git", ["branch", "--show-current"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

  if (!branch) {
    throw new Error("Unable to determine the current Git branch.");
  }

  return branch;
}

function toProtocolSuffix(gitBranch) {
  // Create a URL-safe slug from the branch name
  const slug = gitBranch
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  // Add a short hash to handle collisions from slugification
  const hash = createHash("sha256").update(gitBranch).digest("hex").slice(0, 6);

  // Protocol names should be concise - limit slug to ~30 chars
  const maxSlugLength = 30;
  const safeSlug = (slug || "branch").slice(0, maxSlugLength).replace(/-+$/g, "");

  return `${safeSlug}-${hash}`;
}

export function getElectronProtocol(gitBranch) {
  if (PROTECTED_BRANCHES.has(gitBranch)) {
    return BASE_PROTOCOL;
  }

  return `${BASE_PROTOCOL}-${toProtocolSuffix(gitBranch)}`;
}

// Run as CLI if executed directly
const isEntrypoint =
  process.argv[1] && import.meta.url === new URL(process.argv[1], "file://").href;

if (isEntrypoint) {
  try {
    const branch = getCurrentGitBranch();
    const protocol = getElectronProtocol(branch);
    process.stdout.write(protocol);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}
