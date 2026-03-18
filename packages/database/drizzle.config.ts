import { defineConfig } from "drizzle-kit";
import { resolveDatabaseUrlSync } from "../../scripts/neon-branch-utils.mjs";

const databaseUrl = resolveDatabaseUrlSync();

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
