import type { Context } from "./trpc";
import type { Database } from "@marshall/database";
import type { Auth } from "@marshall/auth";

export function createTRPCContext(opts: {
  db: Database;
  auth: Auth;
  session?: { user: { id: string; email: string } | null };
}): Context {
  return {
    db: opts.db,
    auth: opts.auth,
    session: opts.session ?? { user: null },
  };
}
