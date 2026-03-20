import { describe, expect, it } from "bun:test";
import type { Auth } from "@marshall/auth";
import { createBackendApp } from "../src/server";

describe("createBackendApp", () => {
  it("serves a health endpoint", async () => {
    const app = createBackendApp({
      auth: {
        handler: async () => new Response("unexpected"),
      } as Auth,
    });

    const response = await app.handle(new Request("http://localhost/health"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ok",
    });
  });

  it("forwards auth requests to Better Auth without rewriting the URL", async () => {
    const app = createBackendApp({
      auth: {
        handler: async (request: Request) =>
          new Response(JSON.stringify({ url: request.url }), {
            headers: {
              "content-type": "application/json",
            },
          }),
      } as Auth,
    });

    const response = await app.handle(new Request("http://localhost/api/auth/session"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      url: "http://localhost/api/auth/session",
    });
  });

  it("serves the calendar connect page", async () => {
    const app = createBackendApp({
      auth: {
        handler: async () => new Response("unexpected"),
      } as Auth,
    });

    const response = await app.handle(new Request("http://localhost/calendar/connect"));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("Connect Google Calendar");
    expect(html).toContain("authClient.signIn.social");
    expect(html).toContain("calendar.readonly");
  });
});
