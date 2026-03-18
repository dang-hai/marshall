# Marshall Architecture

## Overview

Marshall is a macOS desktop application built with Electron, featuring a tray icon for quick access. The project uses a monorepo structure with Bun workspaces.

## Tech Stack

| Category           | Technology        | Purpose                                                 |
| ------------------ | ----------------- | ------------------------------------------------------- |
| **Runtime**        | Bun               | Package manager, script runner, fast JavaScript runtime |
| **Language**       | TypeScript        | Type-safe development across all packages               |
| **Desktop**        | Electron          | Cross-platform desktop application framework            |
| **Build**          | electron-vite     | Fast Electron bundler with Vite                         |
| **Frontend**       | React 18          | UI library for renderer process                         |
| **Styling**        | Tailwind CSS      | Utility-first CSS framework                             |
| **UI Components**  | shadcn/ui         | Accessible, customizable component library              |
| **API Layer**      | tRPC              | End-to-end typesafe APIs                                |
| **State**          | TanStack Query    | Server state management                                 |
| **Database**       | Neon (PostgreSQL) | Serverless Postgres database                            |
| **ORM**            | Drizzle ORM       | TypeScript-first SQL ORM                                |
| **Authentication** | better-auth       | Authentication library                                  |

## Project Structure

```
marshall/
├── apps/
│   └── desktop/              # Electron application
│       ├── src/
│       │   ├── main/         # Electron main process
│       │   │   ├── index.ts  # App entry, window management
│       │   │   └── tray.ts   # Tray icon and menu
│       │   ├── preload/      # Preload scripts (context bridge)
│       │   └── renderer/     # React frontend
│       │       └── src/
│       │           ├── components/ui/  # shadcn components
│       │           ├── lib/            # Utilities
│       │           └── styles/         # Global CSS
│       ├── electron.vite.config.ts
│       └── tailwind.config.js
│
├── packages/
│   ├── shared/               # Shared types and utilities
│   │   └── src/index.ts
│   │
│   ├── database/             # Database schema and connection
│   │   ├── src/
│   │   │   ├── schema.ts     # Drizzle schema definitions
│   │   │   └── index.ts      # Database client factory
│   │   └── drizzle.config.ts
│   │
│   ├── auth/                 # Authentication
│   │   └── src/
│   │       ├── index.ts      # Server-side auth setup
│   │       └── client.ts     # Client-side auth helpers
│   │
│   └── api/                  # tRPC API layer
│       └── src/
│           ├── trpc.ts       # tRPC initialization
│           ├── context.ts    # Request context
│           ├── index.ts      # Router exports
│           └── routers/      # API routes
│
├── package.json              # Workspace root
├── tsconfig.json             # TypeScript project references
├── bunfig.toml               # Bun configuration
└── .env.example              # Environment variables template
```

## Key Features

### Tray Icon

- Template image that adapts to macOS dark/light mode
- Click to show/hide main window
- Context menu with:
  - Show application
  - Preferences
  - Quit

### Window Management

- Hidden title bar with draggable region
- Stays running in background on close (macOS behavior)
- Re-activates on dock icon click

### Type Safety

- End-to-end types via tRPC
- Shared types across all packages
- TypeScript project references for incremental builds

## External Dependencies

### Neon Database

Serverless PostgreSQL database. Requires:

- `DATABASE_URL` environment variable
- Drizzle migrations for schema management

### better-auth

Authentication system with:

- Email/password authentication
- Session management
- Database adapter for Drizzle

## Development

```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Build for production
bun run build

# Package for distribution
bun run --filter @marshall/desktop package
```

## Environment Variables

| Variable             | Description                       |
| -------------------- | --------------------------------- |
| `DATABASE_URL`       | Neon PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Secret key for auth token signing |
| `BETTER_AUTH_URL`    | Base URL for auth callbacks       |
