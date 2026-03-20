---
name: electron-protocol
description: Manage Electron protocol registrations across Marshall worktrees. Use when auth redirects fail, deep links go to wrong app, or before starting dev in a new worktree.
triggers:
  - auth redirect not working
  - deep link going to wrong app
  - marshall:// protocol
  - electron protocol
  - clean electron
  - reset electron
  - protocol registration
  - auth callback failing
  - wrong worktree receiving auth
---

# Electron Protocol Manager

Marshall uses custom protocols for OAuth callbacks. Each worktree uses a **unique protocol** based on its git branch:

- **Protected branches** (main, master, release): `marshall://`
- **Feature branches**: `marshall-<branch-slug>://` (e.g., `marshall-feature-auth-abc123://`)

This allows multiple worktrees to run simultaneously without protocol conflicts. The protocol is automatically configured by `bun run setup`.

## Available Commands

Run these from the project root:

| Command                   | Description                                                        |
| ------------------------- | ------------------------------------------------------------------ |
| `bun run electron:status` | Show running Electron processes and registrations                  |
| `bun run electron:clean`  | Kill all Marshall Electrons and unregister from Launch Services    |
| `bun run electron:reset`  | Clean + register current worktree as protocol handler              |
| `bun run dev:clean`       | Reset protocols and start dev server (recommended for fresh start) |

## When to Use

### Auth Redirect Not Working

If the user authenticates in the browser but doesn't get redirected back to the Electron app:

```bash
bun run electron:status  # Check which protocol is configured
bun run electron:reset   # Re-register the protocol
bun run dev
```

### After Running Setup

After `bun run setup`, the protocol is automatically configured in `.env`. If you need to re-register with Launch Services:

```bash
bun run electron:reset
```

### Multiple Worktrees Running

With per-worktree protocols, multiple worktrees can run simultaneously. Each worktree's protocol is independent:

```bash
bun run electron:status  # Shows current worktree's protocol
```

## Direct Script Usage

The underlying script can also be called directly:

```bash
./scripts/electron-protocol.sh status   # Show status
./scripts/electron-protocol.sh clean    # Kill and unregister all
./scripts/electron-protocol.sh register # Register current worktree
./scripts/electron-protocol.sh reset    # Clean + register
```

## How It Works

1. **Protocol Generation**: `scripts/get-electron-protocol.mjs` generates a unique protocol name based on the git branch
2. **Setup Integration**: `bun run setup` writes `BETTER_AUTH_ELECTRON_PROTOCOL` to `.env`
3. **Registration**: Registers the current worktree's Electron.app as the handler for its unique protocol

## Troubleshooting

### Auth redirect not working

1. Check that `.env` has the correct `BETTER_AUTH_ELECTRON_PROTOCOL` value
2. Run `bun run electron:reset` to re-register with Launch Services
3. Restart the dev server

### Protocol mismatch after branch change

If you change branches without re-running setup:

```bash
bun run setup  # Regenerates protocol for new branch
```
