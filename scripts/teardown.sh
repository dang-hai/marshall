#!/usr/bin/env bash
# Teardown script for superset worktree removal
# Closes the associated PR when a worktree is deleted

set -euo pipefail

# Get current branch
BRANCH="$(git branch --show-current 2>/dev/null || true)"

if [[ -z "$BRANCH" ]]; then
  echo "Could not determine current branch, skipping PR cleanup"
  exit 0
fi

# Protected branches don't have preview PRs
if [[ "$BRANCH" == "main" || "$BRANCH" == "master" || "$BRANCH" == "release" ]]; then
  echo "Protected branch '$BRANCH', no PR to close"
  exit 0
fi

# Check if gh is available
if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI not found, skipping PR cleanup"
  exit 0
fi

# Find open PR for this branch
PR_NUMBER="$(gh pr list --head "$BRANCH" --state open --json number --jq '.[0].number' 2>/dev/null || true)"

if [[ -z "$PR_NUMBER" || "$PR_NUMBER" == "null" ]]; then
  echo "No open PR found for branch '$BRANCH'"
  exit 0
fi

echo "Closing PR #$PR_NUMBER for branch '$BRANCH'..."
gh pr close "$PR_NUMBER" --comment "Closed automatically: worktree removed"

echo "PR #$PR_NUMBER closed"
