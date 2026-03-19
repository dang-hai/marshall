# Marshall

## Purpose

Marshall helps lead focused calls. It acts like a moderator that makes sure your calls do not derail and that you capture the information you wanted to catch in the first place. It actively monitors your calls and nudges you with proactive support.

## General Development Cycle

When building features for Marshall, follow this order:

1. Plan the feature.
2. Implement the feature.
3. Write tests.

## Database Branching

- Feature worktrees must use their matching Neon preview branch instead of the shared production `DATABASE_URL`.
- Use `bun run db:url` to inspect the effective database URL for the current worktree when needed.

## External APIs

When working with external libraries or APIs, always use these MCP servers to fetch up-to-date documentation:

- **context7** — Query library documentation (e.g., React, Electron, tRPC)
- **deepwiki** — Query GitHub repository documentation

## Electron Protocol Management

Marshall uses `marshall://` custom protocol for OAuth callbacks. When working with multiple worktrees, protocol conflicts can cause auth issues.

**If auth redirects fail or go to the wrong app:**

```bash
bun run electron:reset   # Clean and register current worktree
bun run dev              # Start fresh
```

**Or use the combined command:**

```bash
bun run dev:clean        # Reset + start dev in one command
```

See `.claude/skills/electron-protocol.md` for full documentation.
