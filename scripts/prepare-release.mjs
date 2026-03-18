import { execFile } from "node:child_process";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const args = process.argv.slice(2);

function getArg(name) {
  const prefix = `${name}=`;
  const match = args.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

function hasArg(name) {
  return args.includes(name);
}

const commitRange = getArg("--commit-range");
const dryRun = hasArg("--dry-run");

const packageRoots = ["apps", "packages"];

const changeTypeTitles = {
  breaking: "Breaking Changes",
  feat: "Features",
  fix: "Fixes",
  perf: "Performance",
  refactor: "Refactors",
  docs: "Documentation",
  build: "Build",
  ci: "CI",
  test: "Tests",
  chore: "Chores",
  revert: "Reverts",
  other: "Other",
};

export function bumpVersion(version, type) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);

  if (!match) {
    throw new Error(`Unsupported version format: ${version}`);
  }

  const [, majorRaw, minorRaw, patchRaw] = match;
  const major = Number.parseInt(majorRaw, 10);
  const minor = Number.parseInt(minorRaw, 10);
  const patch = Number.parseInt(patchRaw, 10);

  switch (type) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
    default:
      throw new Error(`Unexpected bump type: ${type}`);
  }
}

export function parseSemanticCommit(subject, body = "", hash = "") {
  const conventionalMatch = subject.match(/^([a-z]+)(?:\(([^)]+)\))?(!)?:\s+(.+)$/i);
  const bodyHasBreakingChange = /BREAKING CHANGE:/m.test(body);

  if (!conventionalMatch) {
    return {
      type: "other",
      description: subject.trim(),
      scope: null,
      isBreaking: bodyHasBreakingChange,
      hash,
    };
  }

  const [, rawType, scope, bang, description] = conventionalMatch;
  const type = rawType.toLowerCase();

  return {
    type,
    description: description.trim(),
    scope: scope ?? null,
    isBreaking: bang === "!" || bodyHasBreakingChange,
    hash,
  };
}

export function determineReleaseType(commits) {
  if (commits.some((commit) => commit.isBreaking)) {
    return "major";
  }

  if (commits.some((commit) => commit.type === "feat")) {
    return "minor";
  }

  if (commits.some((commit) => ["fix", "perf", "revert"].includes(commit.type))) {
    return "patch";
  }

  return null;
}

export function buildChangelogSection(
  version,
  commits,
  date = new Date().toISOString().slice(0, 10)
) {
  const groups = new Map();

  for (const commit of commits) {
    const groupKey = commit.isBreaking
      ? "breaking"
      : changeTypeTitles[commit.type]
        ? commit.type
        : "other";
    const currentGroup = groups.get(groupKey) ?? [];
    const scope = commit.scope ? `**${commit.scope}:** ` : "";
    const shortHash = commit.hash ? ` (${commit.hash.slice(0, 7)})` : "";
    currentGroup.push(`- ${scope}${commit.description}${shortHash}`);
    groups.set(groupKey, currentGroup);
  }

  const orderedKeys = [
    "breaking",
    "feat",
    "fix",
    "perf",
    "refactor",
    "docs",
    "build",
    "ci",
    "test",
    "chore",
    "revert",
    "other",
  ];

  const sections = orderedKeys
    .filter((key) => groups.has(key))
    .map((key) => `### ${changeTypeTitles[key]}\n\n${groups.get(key).join("\n")}`)
    .join("\n\n");

  return `## ${version} - ${date}\n\n${sections}\n`;
}

async function collectPackageFiles() {
  const packageFiles = [];

  for (const root of packageRoots) {
    const entries = await readdir(root, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const packagePath = path.join(root, entry.name, "package.json");

      try {
        await readFile(packagePath, "utf8");
        packageFiles.push(packagePath);
      } catch {
        // Ignore directories without a package.json.
      }
    }
  }

  return packageFiles.sort();
}

async function readCommits(range) {
  const { stdout } = await execFileAsync("git", [
    "log",
    "--reverse",
    "--pretty=format:%H%x01%s%x01%b%x02",
    range,
  ]);

  return stdout
    .split("\x02")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [hash, subject, body = ""] = entry.split("\x01");
      return parseSemanticCommit(subject, body, hash);
    });
}

async function updatePackageVersions(packageFiles, nextVersion) {
  for (const packageFile of packageFiles) {
    const packageJson = JSON.parse(await readFile(packageFile, "utf8"));
    packageJson.version = nextVersion;

    if (!dryRun) {
      await writeFile(packageFile, `${JSON.stringify(packageJson, null, 2)}\n`);
    }
  }
}

async function updateRootChangelog(section) {
  const changelogPath = "CHANGELOG.md";
  let current = "";

  try {
    current = await readFile(changelogPath, "utf8");
  } catch {
    current = "# Changelog\n\n";
  }

  const nextContent = current.startsWith("# Changelog")
    ? `# Changelog\n\n${section}\n${current.replace(/^# Changelog\s*\n\n?/, "")}`
    : `# Changelog\n\n${section}\n${current}`;

  if (!dryRun) {
    await writeFile(changelogPath, nextContent);
  }
}

export async function main() {
  if (!commitRange) {
    throw new Error("Expected --commit-range=<git-range>");
  }

  const commits = await readCommits(commitRange);
  const releaseType = determineReleaseType(commits);

  if (!releaseType) {
    process.stdout.write("\n");
    return;
  }

  const packageFiles = await collectPackageFiles();

  if (packageFiles.length === 0) {
    throw new Error("No workspace package.json files found");
  }

  const firstPackage = JSON.parse(await readFile(packageFiles[0], "utf8"));
  const nextVersion = bumpVersion(firstPackage.version, releaseType);
  const section = buildChangelogSection(nextVersion, commits);

  await updatePackageVersions(packageFiles, nextVersion);
  await updateRootChangelog(section);

  process.stdout.write(`${nextVersion}\n`);
}

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : "";

if (currentFile === invokedFile) {
  await main();
}
