import { describe, expect, it } from "bun:test";
import { createDb } from "@marshall/database";
import { buildAuthOptions, resolveAuthConfig } from "../src/index";

describe("resolveAuthConfig", () => {
  it("normalizes trusted origins and applies the default Electron protocol", () => {
    const config = resolveAuthConfig({
      BETTER_AUTH_SECRET: "secret",
      BETTER_AUTH_URL: "http://localhost:3000",
      BETTER_AUTH_TRUSTED_ORIGINS: "http://localhost:5173, https://preview.marshall.app",
    });

    expect(config.baseURL).toBe("http://localhost:3000");
    expect(config.trustedOrigins).toEqual([
      "http://localhost:3000",
      "http://localhost:5173",
      "https://preview.marshall.app",
      "marshall://",
    ]);
  });

  it("includes Google and OAuth proxy settings when both are configured", () => {
    const config = resolveAuthConfig({
      BETTER_AUTH_SECRET: "secret",
      BETTER_AUTH_URL: "http://localhost:3000",
      BETTER_AUTH_ELECTRON_PROTOCOL: "marshall-dev",
      GOOGLE_CLIENT_ID: "google-client-id",
      GOOGLE_CLIENT_SECRET: "google-client-secret",
      BETTER_AUTH_OAUTH_PROXY_PRODUCTION_URL: "https://marshall.app",
      BETTER_AUTH_OAUTH_PROXY_CURRENT_URL: "https://preview.marshall.app",
    });

    expect(config.google).toEqual({
      clientId: "google-client-id",
      clientSecret: "google-client-secret",
    });
    expect(config.oauthProxy).toEqual({
      productionURL: "https://marshall.app",
      currentURL: "https://preview.marshall.app",
    });
    expect(config.trustedOrigins).toContain("marshall-dev://");
  });
});

describe("buildAuthOptions", () => {
  it("enables email/password and installs the Electron and OAuth proxy plugins", () => {
    const db = createDb("postgresql://marshall:marshall@localhost:5432/marshall");
    const config = resolveAuthConfig({
      BETTER_AUTH_SECRET: "secret",
      BETTER_AUTH_URL: "http://localhost:3000",
      GOOGLE_CLIENT_ID: "google-client-id",
      GOOGLE_CLIENT_SECRET: "google-client-secret",
      BETTER_AUTH_OAUTH_PROXY_PRODUCTION_URL: "https://marshall.app",
    });

    const options = buildAuthOptions(db, config);

    expect(options.emailAndPassword?.enabled).toBe(true);
    expect(options.socialProviders?.google).toEqual({
      clientId: "google-client-id",
      clientSecret: "google-client-secret",
    });
    expect(options.plugins?.map((plugin) => plugin.id)).toEqual([
      "organization",
      "electron",
      "oauth-proxy",
    ]);
  });
});
