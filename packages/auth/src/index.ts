import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Database } from "@marshall/database";

export function createAuth(db: Database, baseUrl: string) {
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
    }),
    baseURL: baseUrl,
    emailAndPassword: {
      enabled: true,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // 1 day
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
