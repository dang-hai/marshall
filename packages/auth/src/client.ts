import { createAuthClient } from "better-auth/client";

export function createClient(baseUrl: string) {
  return createAuthClient({
    baseURL: baseUrl,
  });
}

export type AuthClient = ReturnType<typeof createClient>;
