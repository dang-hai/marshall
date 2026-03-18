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

echo "Running typecheck..."
bun run typecheck

echo "Setup complete."
