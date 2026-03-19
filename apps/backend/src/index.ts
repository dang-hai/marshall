import { createAuthFromEnv } from "@marshall/auth";
import { createDb } from "@marshall/database";
import { createBackendApp } from "./server";

function requireEnv(key: string) {
  const value = process.env[key]?.trim();

  if (!value) {
    throw new Error(`${key} is required to start the backend.`);
  }

  return value;
}

function resolvePort(value?: string) {
  const port = Number.parseInt(value ?? "3000", 10);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`PORT must be a positive integer. Received "${value ?? ""}".`);
  }

  return port;
}

const port = resolvePort(process.env.PORT);
const baseUrl = requireEnv("BETTER_AUTH_URL");
const electronProtocol = process.env.BETTER_AUTH_ELECTRON_PROTOCOL || "marshall";
const db = createDb(requireEnv("DATABASE_URL"));
const auth = createAuthFromEnv(db);
const app = createBackendApp({ auth, baseUrl, electronProtocol });

app.listen(port);

console.log(`Marshall backend listening on http://localhost:${port}`);
