# Architecture

## Application Stack

- The desktop application is built with TypeScript and Electron.
- Icons are provided by [Lucide](https://github.com/lucide-icons/lucide).

## AI and Speech

- Speech-to-text is powered by `whisper.cpp`.
- LLM and coding-agent calls are monitored with Langfuse.

## Authentication and Data

- Authentication is handled with Better Auth.
- Persistent application data is stored in Neon Database.

## Feature Management

- PostHog is used for feature gating.
