import { electron } from "@better-auth/electron";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { oAuthProxy, organization } from "better-auth/plugins";
import type { Database } from "@marshall/database";

export interface ResolvedAuthConfig {
  baseURL: string;
  secret: string;
  trustedOrigins: string[];
  electronProtocol: string;
  google?: {
    clientId: string;
    clientSecret: string;
  };
  oauthProxy?: {
    currentURL?: string;
    productionURL: string;
  };
}

type AuthEnv = Record<string, string | undefined>;

const DEFAULT_ELECTRON_PROTOCOL = "marshall";

function requireEnv(env: AuthEnv, key: string) {
  const value = env[key]?.trim();

  if (!value) {
    throw new Error(`${key} is required to configure Better Auth.`);
  }

  return value;
}

function parseList(value?: string) {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function resolveAuthConfig(env: AuthEnv = process.env) {
  const baseURL = requireEnv(env, "BETTER_AUTH_URL");
  const secret = requireEnv(env, "BETTER_AUTH_SECRET");
  const electronProtocol = env.BETTER_AUTH_ELECTRON_PROTOCOL?.trim() || DEFAULT_ELECTRON_PROTOCOL;

  const trustedOrigins = Array.from(
    new Set([
      baseURL,
      ...parseList(env.BETTER_AUTH_TRUSTED_ORIGINS),
      // Both formats for compatibility
      `${electronProtocol}://`,
      `${electronProtocol}://app`,
    ])
  );

  const google =
    env.GOOGLE_CLIENT_ID?.trim() && env.GOOGLE_CLIENT_SECRET?.trim()
      ? {
          clientId: env.GOOGLE_CLIENT_ID.trim(),
          clientSecret: env.GOOGLE_CLIENT_SECRET.trim(),
        }
      : undefined;

  const oauthProxyProductionURL = env.BETTER_AUTH_OAUTH_PROXY_PRODUCTION_URL?.trim();
  const oauthProxy = oauthProxyProductionURL
    ? {
        productionURL: oauthProxyProductionURL,
        currentURL: env.BETTER_AUTH_OAUTH_PROXY_CURRENT_URL?.trim(),
      }
    : undefined;

  return {
    baseURL,
    secret,
    trustedOrigins,
    electronProtocol,
    google,
    oauthProxy,
  } satisfies ResolvedAuthConfig;
}

export function buildAuthOptions(db: Database, config: ResolvedAuthConfig): BetterAuthOptions {
  const plugins: BetterAuthOptions["plugins"] = [
    organization(),
    electron({
      disableOriginOverride: true,
    }),
  ];

  if (config.oauthProxy) {
    plugins.push(oAuthProxy(config.oauthProxy));
  }

  return {
    database: drizzleAdapter(db, {
      provider: "pg",
    }),
    baseURL: config.baseURL,
    secret: config.secret,
    trustedOrigins: config.trustedOrigins,
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
    },
    socialProviders: config.google ? { google: config.google } : undefined,
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // 1 day
    },
    plugins,
  };
}

export function createAuth(db: Database, config: ResolvedAuthConfig) {
  return betterAuth(buildAuthOptions(db, config));
}

export function createAuthFromEnv(db: Database, env: AuthEnv = process.env) {
  return createAuth(db, resolveAuthConfig(env));
}

export type Auth = ReturnType<typeof createAuth>;
