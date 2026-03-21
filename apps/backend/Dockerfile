FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.lock ./
# Copy all workspace package.json files to match lockfile
COPY packages/shared/package.json ./packages/shared/
COPY packages/database/package.json ./packages/database/
COPY packages/auth/package.json ./packages/auth/
COPY packages/api/package.json ./packages/api/
COPY packages/transcription/package.json ./packages/transcription/
COPY packages/utilities/package.json ./packages/utilities/
COPY apps/backend/package.json ./apps/backend/
COPY apps/desktop/package.json ./apps/desktop/
COPY apps/docs/package.json ./apps/docs/
COPY apps/marketing/package.json ./apps/marketing/
RUN bun install --frozen-lockfile

# Build
FROM deps AS builder
COPY tsconfig.json ./
COPY packages ./packages
COPY apps/backend ./apps/backend
RUN bun run --filter @marshall/shared build && \
    bun run --filter @marshall/database build && \
    bun run --filter @marshall/auth build && \
    bun run --filter @marshall/backend build

# Production
FROM base AS runner
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/backend ./apps/backend

WORKDIR /app/apps/backend
ENV NODE_ENV=production
EXPOSE 3000

CMD ["bun", "run", "start"]
