import { createAuthFromEnv } from "@marshall/auth";
import { createDb } from "@marshall/database";
import { createBackendApp } from "./server";

type BackendEnv = Record<string, string | undefined>;

function requireEnv(env: BackendEnv, key: string) {
  const value = env[key]?.trim();

  if (!value) {
    throw new Error(`${key} is required to start the backend.`);
  }

  return value;
}

export function createConfiguredBackendApp(env: BackendEnv = process.env) {
  const baseUrl = requireEnv(env, "BETTER_AUTH_URL");
  const electronProtocol = env.BETTER_AUTH_ELECTRON_PROTOCOL || "marshall";
  const db = createDb(requireEnv(env, "DATABASE_URL"));
  const auth = createAuthFromEnv(db, env);

  // Notion OAuth config (optional)
  const notion =
    env.NOTION_CLIENT_ID?.trim() && env.NOTION_CLIENT_SECRET?.trim()
      ? {
          clientId: env.NOTION_CLIENT_ID.trim(),
          clientSecret: env.NOTION_CLIENT_SECRET.trim(),
        }
      : undefined;

  return createBackendApp({ auth, db, baseUrl, electronProtocol, notion });
}

const app = createConfiguredBackendApp();

export default app;
