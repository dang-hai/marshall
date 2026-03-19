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

Marshall uses the `marshall://` custom protocol for OAuth callbacks. On macOS, only one app can own a protocol at a time. When running multiple worktrees, protocol conflicts cause auth redirects to fail or go to the wrong Electron instance.

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
bun run electron:reset
bun run dev
```

### Deep Link Going to Wrong App

If `marshall://` links open a different worktree's Electron (often shows the default Electron welcome page):

```bash
bun run electron:status  # Check what's running
bun run electron:clean   # Kill everything
bun run dev              # Start fresh
```

### Before Starting Dev in a New Worktree

Always recommended when switching worktrees:

```bash
bun run dev:clean
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

1. **Killing processes**: Finds and kills all Electron processes from Marshall worktrees
2. **Unregistering**: Removes all Marshall Electron apps from macOS Launch Services database
3. **Registering**: Registers the current worktree's Electron.app as the `marshall://` handler

## Symptoms of Protocol Conflicts

- Browser shows "Sign in successful! Redirecting..." but nothing happens
- A different Electron window (wrong worktree) opens instead
- Default Electron welcome page appears with "To run a local app..." message
- Auth flow hangs indefinitely
