#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

if ! command -v bun >/dev/null 2>&1; then
  echo "bun is required but not installed." >&2
  echo "Install Bun from https://bun.sh and rerun this script." >&2
  exit 1
fi

if ! command -v mprocs >/dev/null 2>&1; then
  echo "mprocs is required but not installed." >&2
  echo "Install via: brew install mprocs" >&2
  exit 1
fi

echo "Installing workspace dependencies..."
bun install --frozen-lockfile

if [[ ! -f .env ]]; then
  if [[ -z "${SUPERSET_ROOT_PATH:-}" ]]; then
    echo "SUPERSET_ROOT_PATH is not set. Cannot copy .env." >&2
    exit 1
  fi
  if [[ ! -f "$SUPERSET_ROOT_PATH/.env" ]]; then
    echo "No .env found at $SUPERSET_ROOT_PATH/.env" >&2
    exit 1
  fi
  echo "Creating .env from $SUPERSET_ROOT_PATH/.env..."
  cp "$SUPERSET_ROOT_PATH/.env" .env
fi

if ! command -v node >/dev/null 2>&1; then
  echo "node is required but not installed." >&2
  echo "Install Node.js and rerun this script." >&2
  exit 1
fi

echo "Resolving Neon database URL for the current branch..."
DATABASE_URL="$(node scripts/bootstrap-preview-environment.mjs)"

echo "Generating worktree-specific Electron protocol..."
ELECTRON_PROTOCOL="$(node scripts/get-electron-protocol.mjs)"
echo "Using protocol: $ELECTRON_PROTOCOL"

ENV_FILE="$ROOT_DIR/.env"
ENV_DATABASE_URL="$DATABASE_URL" ENV_ELECTRON_PROTOCOL="$ELECTRON_PROTOCOL" node --input-type=module - "$ENV_FILE" "$ROOT_DIR/.neon" <<'EOF'
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const envFile = process.argv[2];
const neonContextFile = process.argv[3];
const nextDatabaseUrl = process.env.ENV_DATABASE_URL;
const electronProtocol = process.env.ENV_ELECTRON_PROTOCOL;
let current = readFileSync(envFile, "utf8");

function replaceOrAppend(content, key, value) {
  if (new RegExp(`^${key}=.*$`, "m").test(content)) {
    return content.replace(new RegExp(`^${key}=.*$`, "m"), `${key}=${value}`);
  }

  return `${content.trimEnd()}\n${key}=${value}\n`;
}

current = replaceOrAppend(current, "DATABASE_URL", nextDatabaseUrl);
current = replaceOrAppend(current, "BETTER_AUTH_ELECTRON_PROTOCOL", electronProtocol);

if (existsSync(neonContextFile)) {
  const neonContext = JSON.parse(readFileSync(neonContextFile, "utf8"));
  if (typeof neonContext.projectId === "string" && neonContext.projectId.length > 0) {
    current = replaceOrAppend(current, "NEON_PROJECT_ID", neonContext.projectId);
  }
}

writeFileSync(envFile, current);
EOF

echo "Building whisper binary with CoreML support..."
bun run --filter @marshall/transcription build:whisper

echo "Generating CoreML model for tiny.en (for ANE acceleration)..."
echo "This enables ~3x faster transcription on Apple Silicon."
bun run --filter @marshall/transcription generate:coreml tiny.en

echo "Running typecheck..."
bun run typecheck

echo "Setup complete."
echo ""
echo "CoreML acceleration is now enabled for the tiny.en model."
echo "To generate CoreML models for other sizes, run:"
echo "  bun run --filter @marshall/transcription generate:coreml <model-name>"
echo "Available models: tiny.en, base.en, small.en, medium.en, large-v3, large-v3-turbo"
