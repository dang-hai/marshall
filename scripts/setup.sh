#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

if ! command -v bun >/dev/null 2>&1; then
  echo "bun is required but not installed." >&2
  echo "Install Bun from https://bun.sh and rerun this script." >&2
  exit 1
fi

echo "Installing workspace dependencies..."
bun install --frozen-lockfile

if [[ ! -f .env && -f .env.example ]]; then
  echo "Creating .env from .env.example..."
  cp .env.example .env
fi

if ! command -v node >/dev/null 2>&1; then
  echo "node is required but not installed." >&2
  echo "Install Node.js and rerun this script." >&2
  exit 1
fi

echo "Resolving Neon database URL for the current branch..."
DATABASE_URL="$(NEON_FORCE_BRANCH_URL=1 node scripts/neon-branch-utils.mjs)"

ENV_FILE="$ROOT_DIR/.env"
ENV_DATABASE_URL="$DATABASE_URL" node --input-type=module - "$ENV_FILE" <<'EOF'
import { readFileSync, writeFileSync } from "node:fs";

const envFile = process.argv[2];
const nextDatabaseUrl = process.env.ENV_DATABASE_URL;
const current = readFileSync(envFile, "utf8");

if (/^DATABASE_URL=.*$/m.test(current)) {
  writeFileSync(
    envFile,
    current.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL=${nextDatabaseUrl}`),
  );
} else {
  writeFileSync(envFile, `${current.trimEnd()}\nDATABASE_URL=${nextDatabaseUrl}\n`);
}
EOF

echo "Running typecheck..."
bun run typecheck

echo "Setup complete."
