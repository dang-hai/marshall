import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import type { Auth } from "@marshall/auth";
import { account, note, noteTranscription, type Database } from "@marshall/database";
import type {
  CreateNoteInput,
  GoogleCalendarConnectionStatus,
  NoteRecord,
  NoteTranscriptionSnapshot,
  SaveNoteTranscriptionInput,
  UpdateNoteInput,
} from "@marshall/shared";
import { and, desc, eq, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import { createTranscriptionRoutes } from "./transcription";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import {
  GOOGLE_CALENDAR_PROVIDER_ID,
  GOOGLE_CALENDAR_READONLY_SCOPE,
  hasGoogleCalendarAccess,
  parseGoogleCalendarScopes,
  serializeGoogleCalendarEvent,
} from "./calendar";

export interface BackendAppOptions {
  auth: Auth;
  db?: Database;
  baseUrl?: string;
  electronProtocol?: string;
}

// Store pending desktop auth requests (state -> redirect info)
const pendingDesktopAuth = new Map<string, { scheme: string; createdAt: number }>();

/** Maximum time to wait for desktop auth completion */
const AUTH_REQUEST_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [state, info] of pendingDesktopAuth) {
    if (now - info.createdAt > AUTH_REQUEST_TTL_MS) {
      pendingDesktopAuth.delete(state);
    }
  }
}, AUTH_REQUEST_TTL_MS);

function signInPage(baseUrl: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign In - Marshall</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
    }
    .container {
      background: rgba(255,255,255,0.05);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 16px;
      padding: 48px;
      width: 100%;
      max-width: 400px;
      text-align: center;
    }
    .logo {
      width: 64px;
      height: 64px;
      background: rgba(99, 102, 241, 0.2);
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
    }
    .logo svg { width: 32px; height: 32px; color: #818cf8; }
    h1 { font-size: 24px; font-weight: 600; margin-bottom: 8px; }
    p { color: rgba(255,255,255,0.6); font-size: 14px; margin-bottom: 32px; }
    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      width: 100%;
      padding: 14px 24px;
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 10px;
      background: rgba(255,255,255,0.05);
      color: #fff;
      font-size: 15px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.3); }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn svg { width: 20px; height: 20px; }
    .spinner {
      display: none;
      width: 20px;
      height: 20px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .message { margin-top: 20px; padding: 12px; border-radius: 8px; font-size: 14px; display: none; }
    .message.error { background: rgba(239, 68, 68, 0.2); color: #fca5a5; display: block; }
    .message.success { background: rgba(34, 197, 94, 0.2); color: #86efac; display: block; }
    .footer { margin-top: 32px; font-size: 12px; color: rgba(255,255,255,0.4); }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
      </svg>
    </div>
    <h1>Welcome to Marshall</h1>
    <p>Sign in to continue to the desktop app</p>

    <button id="googleBtn" class="btn" onclick="signInWithGoogle()">
      <svg viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      <span>Continue with Google</span>
      <div class="spinner" id="googleSpinner"></div>
    </button>

    <div id="message" class="message"></div>

    <div class="footer">
      By continuing, you agree to our Terms of Service and Privacy Policy.
    </div>
  </div>

  <script type="module">
    import { createAuthClient } from "https://esm.sh/better-auth@1.5.5/client";

    const authClient = createAuthClient({
      baseURL: "${baseUrl}",
    });

    // Get URL params
    const params = new URLSearchParams(window.location.search);
    const desktopState = params.get('desktop_state');
    const desktopScheme = params.get('desktop_scheme');

    // If this is a desktop auth flow, set callback to success page
    const callbackURL = desktopState && desktopScheme
      ? "${baseUrl}/auth/desktop/success?state=" + desktopState + "&scheme=" + desktopScheme
      : "${baseUrl}";

    async function signInWithGoogle() {
      const btn = document.getElementById('googleBtn');
      const spinner = document.getElementById('googleSpinner');
      const message = document.getElementById('message');

      if (btn) btn.disabled = true;
      if (spinner) spinner.style.display = 'block';
      if (message) { message.className = 'message'; message.style.display = 'none'; }

      try {
        await authClient.signIn.social({
          provider: "google",
          callbackURL,
        });
      } catch (error) {
        if (message) {
          message.textContent = error.message || 'Sign in failed. Please try again.';
          message.className = 'message error';
        }
        if (btn) btn.disabled = false;
        if (spinner) spinner.style.display = 'none';
      }
    }

    window.signInWithGoogle = signInWithGoogle;

    // Auto-start OAuth if provider is specified
    if (params.get('provider') === 'google') {
      signInWithGoogle();
    }
  </script>
</body>
</html>`;
}

function calendarConnectPage(baseUrl: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Connect Google Calendar - Marshall</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
    }
    .container {
      background: rgba(255,255,255,0.05);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 16px;
      padding: 48px;
      width: 100%;
      max-width: 420px;
      text-align: center;
    }
    h1 { font-size: 24px; font-weight: 600; margin-bottom: 8px; }
    p { color: rgba(255,255,255,0.65); font-size: 14px; line-height: 1.6; }
    .subtitle { margin-bottom: 32px; }
    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      width: 100%;
      padding: 14px 24px;
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 10px;
      background: rgba(255,255,255,0.05);
      color: #fff;
      font-size: 15px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.3); }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn svg { width: 20px; height: 20px; }
    .spinner {
      display: none;
      width: 20px;
      height: 20px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    .message {
      margin-top: 20px;
      padding: 12px;
      border-radius: 8px;
      font-size: 14px;
      display: none;
      text-align: left;
    }
    .message.error { background: rgba(239, 68, 68, 0.2); color: #fca5a5; display: block; }
    .message.info { background: rgba(59, 130, 246, 0.16); color: #bfdbfe; display: block; }
    .footer { margin-top: 28px; font-size: 12px; color: rgba(255,255,255,0.45); }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="container">
    <h1>Connect Google Calendar</h1>
    <p class="subtitle">Grant Marshall read-only access to your upcoming Google Calendar events.</p>

    <button id="googleCalendarBtn" class="btn" onclick="connectGoogleCalendar()">
      <svg viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      <span>Continue with Google</span>
      <div class="spinner" id="googleCalendarSpinner"></div>
    </button>

    <div id="message" class="message"></div>

    <div class="footer">
      Marshall only requests read-only Google Calendar access in this flow.
    </div>
  </div>

  <script type="module">
    import { createAuthClient } from "https://esm.sh/better-auth@1.5.5/client";

    const authClient = createAuthClient({
      baseURL: "${baseUrl}",
    });

    const params = new URLSearchParams(window.location.search);
    const desktopState = params.get("desktop_state");
    const desktopScheme = params.get("desktop_scheme");

    const callbackURL =
      desktopState && desktopScheme
        ? "${baseUrl}/auth/desktop/calendar-success?state=" +
          encodeURIComponent(desktopState) +
          "&scheme=" +
          encodeURIComponent(desktopScheme)
        : "${baseUrl}";

    const errorCallbackURL =
      desktopState && desktopScheme
        ? "${baseUrl}/auth/desktop/calendar-error?state=" +
          encodeURIComponent(desktopState) +
          "&scheme=" +
          encodeURIComponent(desktopScheme) +
          "&error=calendar_connect_failed"
        : "${baseUrl}";

    async function connectGoogleCalendar() {
      const btn = document.getElementById("googleCalendarBtn");
      const spinner = document.getElementById("googleCalendarSpinner");
      const message = document.getElementById("message");

      if (btn) btn.disabled = true;
      if (spinner) spinner.style.display = "block";
      if (message) {
        message.className = "message";
        message.style.display = "none";
      }

      try {
        await authClient.signIn.social({
          provider: "google",
          callbackURL,
          errorCallbackURL,
          scopes: [
            "openid",
            "email",
            "profile",
            "${GOOGLE_CALENDAR_READONLY_SCOPE}",
          ],
        });
      } catch (error) {
        if (message) {
          const errorMessage =
            error instanceof Error ? error.message : "Google Calendar connect failed.";
          message.textContent = errorMessage;
          message.className = "message error";
        }
        if (btn) btn.disabled = false;
        if (spinner) spinner.style.display = "none";
      }
    }

    window.connectGoogleCalendar = connectGoogleCalendar;

    if (!desktopState || !desktopScheme) {
      const message = document.getElementById("message");
      if (message) {
        message.textContent = "Missing desktop callback information. Start this flow from Marshall.";
        message.className = "message error";
      }
    } else {
      connectGoogleCalendar();
    }
  </script>
</body>
</html>`;
}

// Success page that redirects to desktop app
function desktopSuccessPage(scheme: string, token: string, state: string) {
  const redirectUrl = `${scheme}://auth/callback?token=${encodeURIComponent(token)}&state=${encodeURIComponent(state)}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign In Successful - Marshall</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      text-align: center;
    }
    .container { max-width: 400px; padding: 48px; }
    h1 { font-size: 24px; margin-bottom: 16px; }
    p { color: rgba(255,255,255,0.6); margin-bottom: 24px; }
    a { color: #818cf8; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Sign in successful!</h1>
    <p>Redirecting to Marshall desktop app...</p>
    <p>If you're not redirected automatically, <a href="${redirectUrl}">click here</a>.</p>
  </div>
  <script>
    window.location.href = "${redirectUrl}";
  </script>
</body>
</html>`;
}

function desktopCalendarRedirectPage({
  description,
  redirectLabel,
  redirectUrl,
  title,
}: {
  description: string;
  redirectLabel: string;
  redirectUrl: string;
  title: string;
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Marshall</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      text-align: center;
      margin: 0;
    }
    .container { max-width: 420px; padding: 48px; }
    h1 { font-size: 24px; margin-bottom: 16px; }
    p { color: rgba(255,255,255,0.68); margin-bottom: 24px; line-height: 1.6; }
    a { color: #818cf8; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${title}</h1>
    <p>${description}</p>
    <p>If Marshall does not open automatically, <a href="${redirectUrl}">${redirectLabel}</a>.</p>
  </div>
  <script>
    window.location.href = "${redirectUrl}";
  </script>
</body>
</html>`;
}

function toIsoString(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function parseDateInput(value?: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildGoogleCalendarConnectionStatus(
  scope: string | null | undefined,
  accountEmail: string | null | undefined
): GoogleCalendarConnectionStatus {
  const scopes = parseGoogleCalendarScopes(scope);

  return {
    connected: hasGoogleCalendarAccess(scopes),
    accountEmail: accountEmail ?? null,
    scopes,
  };
}

function serializeNoteTranscription(
  row: typeof noteTranscription.$inferSelect
): NoteTranscriptionSnapshot {
  return {
    id: row.id,
    noteId: row.noteId,
    status: row.status,
    provider: row.provider,
    mode: row.mode,
    language: row.language,
    model: row.model,
    transcriptText: row.transcriptText,
    finalText: row.finalText,
    interimText: row.interimText,
    segments: row.segments,
    lastSegmentIndex: row.lastSegmentIndex,
    durationSeconds: row.durationSeconds,
    recordingDurationSeconds: row.recordingDurationSeconds,
    error: row.error,
    startedAt: toIsoString(row.startedAt),
    completedAt: toIsoString(row.completedAt),
    lastPartialAt: toIsoString(row.lastPartialAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeNote(
  row: typeof note.$inferSelect,
  transcriptionRow?: typeof noteTranscription.$inferSelect
): NoteRecord {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    trashedAt: toIsoString(row.trashedAt),
    transcription: transcriptionRow ? serializeNoteTranscription(transcriptionRow) : null,
  };
}

async function getAuthenticatedSession(
  auth: Auth,
  request: Request,
  set: { status?: number | string }
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    set.status = 401;
    return null;
  }

  return session;
}

export function createBackendApp({
  auth,
  db,
  baseUrl = "http://localhost:3000",
  electronProtocol = "marshall",
}: BackendAppOptions) {
  return (
    new Elysia()
      .use(
        cors({
          origin: true,
          credentials: true,
        })
      )
      .onError(({ error, request }) => {
        const url = new URL(request.url);
        console.error(`[Server Error] ${request.method} ${url.pathname}`);
        console.error("[Server Error] Details:", error);
        if (error instanceof Error) {
          console.error("[Server Error] Message:", error.message);
          console.error("[Server Error] Stack:", error.stack);
        }
      })
      .get("/", () => ({
        name: "marshall-backend",
        status: "ok",
      }))
      .get("/health", () => ({
        status: "ok",
      }))
      // Sign-in page for desktop auth
      .get("/sign-in", () => {
        return new Response(signInPage(baseUrl), {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      })
      .get("/calendar/connect", () => {
        return new Response(calendarConnectPage(baseUrl), {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      })
      // Desktop auth: initiate flow (called by Electron app)
      .get("/auth/desktop/connect", ({ query }) => {
        const state = query.state;
        const scheme = query.scheme || electronProtocol;

        if (!state) {
          return new Response("Missing state parameter", { status: 400 });
        }

        // Store the pending auth request
        pendingDesktopAuth.set(state, { scheme, createdAt: Date.now() });
        console.log(`[Desktop Auth] Initiated: state=${state}, scheme=${scheme}`);

        // Redirect to sign-in page with desktop params
        const signInUrl = `${baseUrl}/sign-in?desktop_state=${state}&desktop_scheme=${scheme}`;
        return Response.redirect(signInUrl, 302);
      })
      // Desktop auth: success callback (after OAuth completes)
      .get("/auth/desktop/success", async ({ query, request, set }) => {
        try {
          const state = query.state as string;
          const scheme = (query.scheme as string) || electronProtocol;

          console.log(`[Desktop Auth] Success callback: state=${state}, scheme=${scheme}`);
          console.log(`[Desktop Auth] Cookies:`, request.headers.get("cookie"));

          if (!state) {
            set.status = 400;
            return "Missing state parameter";
          }

          // Clean up pending request if it exists
          pendingDesktopAuth.delete(state);

          // Get the session from cookies
          const session = await auth.api.getSession({ headers: request.headers });
          console.log(`[Desktop Auth] Session:`, session ? `user=${session.user.email}` : "null");

          if (!session) {
            set.status = 401;
            set.headers["Content-Type"] = "text/html; charset=utf-8";
            return `<!DOCTYPE html>
            <html><body style="font-family: sans-serif; padding: 40px; text-align: center;">
              <h1>Authentication Required</h1>
              <p>No session found. Please try signing in again.</p>
              <a href="${baseUrl}/sign-in?desktop_state=${state}&desktop_scheme=${scheme}">Try Again</a>
            </body></html>`;
          }

          // Create a token for the desktop app (use session token)
          const token = session.session.token;
          console.log(
            `[Desktop Auth] Success: user=${session.user.email}, token=${token.substring(0, 10)}...`
          );

          // Return page that redirects to desktop app
          set.headers["Content-Type"] = "text/html; charset=utf-8";
          return desktopSuccessPage(scheme, token, state);
        } catch (error) {
          console.error(`[Desktop Auth] Error:`, error);
          set.status = 500;
          return `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
        }
      })
      .get("/auth/desktop/calendar-success", ({ query, set }) => {
        const state = query.state as string | undefined;
        const scheme = (query.scheme as string | undefined) || electronProtocol;

        if (!state) {
          set.status = 400;
          return "Missing state parameter";
        }

        set.headers["Content-Type"] = "text/html; charset=utf-8";
        return desktopCalendarRedirectPage({
          title: "Google Calendar connected",
          description: "Marshall now has read access to your upcoming Google Calendar events.",
          redirectLabel: "open Marshall",
          redirectUrl: `${scheme}://calendar/callback?state=${encodeURIComponent(state)}`,
        });
      })
      .get("/auth/desktop/calendar-error", ({ query, set }) => {
        const state = query.state as string | undefined;
        const scheme = (query.scheme as string | undefined) || electronProtocol;
        const error = typeof query.error === "string" ? query.error : "calendar_connect_failed";

        if (!state) {
          set.status = 400;
          return "Missing state parameter";
        }

        set.headers["Content-Type"] = "text/html; charset=utf-8";
        return desktopCalendarRedirectPage({
          title: "Google Calendar connection failed",
          description:
            "Marshall could not complete Google Calendar access. Try the connection flow again.",
          redirectLabel: "return to Marshall",
          redirectUrl: `${scheme}://calendar/error?state=${encodeURIComponent(state)}&error=${encodeURIComponent(error)}`,
        });
      })
      // Get current user from session token (for desktop app)
      .get("/api/user/me", async ({ request, set }) => {
        try {
          const session = await getAuthenticatedSession(auth, request, set);
          if (!session) {
            return { error: "Not authenticated" };
          }

          return {
            user: {
              id: session.user.id,
              email: session.user.email,
              name: session.user.name,
              image: session.user.image,
              emailVerified: session.user.emailVerified,
              createdAt: session.user.createdAt,
              updatedAt: session.user.updatedAt,
            },
          };
        } catch (error) {
          console.error("[API] Error getting user:", error);
          set.status = 500;
          return { error: "Failed to get user" };
        }
      })
      .get("/api/calendar/google/status", async ({ request, set }) => {
        if (!db) {
          set.status = 500;
          return { error: "Database is not configured" };
        }

        try {
          const session = await getAuthenticatedSession(auth, request, set);
          if (!session) {
            return { error: "Not authenticated" };
          }

          const [googleAccount] = await db
            .select()
            .from(account)
            .where(
              and(
                eq(account.userId, session.user.id),
                eq(account.providerId, GOOGLE_CALENDAR_PROVIDER_ID)
              )
            )
            .orderBy(desc(account.updatedAt))
            .limit(1);

          return buildGoogleCalendarConnectionStatus(googleAccount?.scope, session.user.email);
        } catch (error) {
          console.error("[API] Error getting Google Calendar status:", error);
          set.status = 500;
          return { error: "Failed to get Google Calendar status" };
        }
      })
      .get(
        "/api/calendar/google/upcoming",
        async ({ query, request, set }) => {
          if (!db) {
            set.status = 500;
            return { error: "Database is not configured" };
          }

          try {
            const session = await getAuthenticatedSession(auth, request, set);
            if (!session) {
              return { error: "Not authenticated" };
            }

            const [googleAccount] = await db
              .select({ scope: account.scope })
              .from(account)
              .where(
                and(
                  eq(account.userId, session.user.id),
                  eq(account.providerId, GOOGLE_CALENDAR_PROVIDER_ID)
                )
              )
              .orderBy(desc(account.updatedAt))
              .limit(1);

            const status = buildGoogleCalendarConnectionStatus(
              googleAccount?.scope,
              session.user.email
            );

            if (!status.connected) {
              set.status = 403;
              return { error: "Google Calendar is not connected" };
            }

            const token = await auth.api.getAccessToken({
              headers: request.headers,
              body: { providerId: GOOGLE_CALENDAR_PROVIDER_ID },
            });

            const limit = Math.min(Math.max(Number(query.limit ?? 5) || 5, 1), 10);
            const calendarUrl = new URL(
              "https://www.googleapis.com/calendar/v3/calendars/primary/events"
            );
            calendarUrl.searchParams.set("maxResults", String(limit));
            calendarUrl.searchParams.set("orderBy", "startTime");
            calendarUrl.searchParams.set("singleEvents", "true");
            calendarUrl.searchParams.set("timeMin", new Date().toISOString());

            const response = await fetch(calendarUrl.toString(), {
              headers: {
                Authorization: `Bearer ${token.accessToken}`,
              },
            });

            if (!response.ok) {
              const message = await response.text();
              console.error("[API] Google Calendar request failed:", response.status, message);
              set.status = 502;
              return { error: "Failed to fetch upcoming Google Calendar events" };
            }

            const payload = (await response.json()) as { items?: unknown[] };
            const events = (payload.items ?? [])
              .flatMap((item) => {
                const event = serializeGoogleCalendarEvent(item as Record<string, unknown>);
                return event ? [event] : [];
              })
              .slice(0, limit);

            return { events };
          } catch (error) {
            console.error("[API] Error fetching upcoming Google Calendar events:", error);
            set.status = 500;
            return { error: "Failed to fetch upcoming Google Calendar events" };
          }
        },
        {
          query: t.Object({
            limit: t.Optional(t.String()),
          }),
        }
      )
      // LLM completion endpoint
      .post(
        "/api/ai/completion",
        async ({ body, set }) => {
          try {
            const { prompt, system } = body;

            const { text } = await generateText({
              model: anthropic("claude-sonnet-4-20250514"),
              system: system || "You are a helpful assistant.",
              prompt,
            });

            return { text };
          } catch (error) {
            console.error("[AI] Completion error:", error);
            set.status = 500;
            return {
              error: error instanceof Error ? error.message : "Completion failed",
            };
          }
        },
        {
          body: t.Object({
            prompt: t.String(),
            system: t.Optional(t.String()),
          }),
        }
      )
      .get("/api/notes", async ({ request, set }) => {
        if (!db) {
          set.status = 500;
          return { error: "Database is not configured" };
        }

        try {
          const session = await getAuthenticatedSession(auth, request, set);
          if (!session) {
            return { error: "Not authenticated" };
          }

          const notes = await db
            .select()
            .from(note)
            .where(eq(note.userId, session.user.id))
            .orderBy(desc(note.updatedAt));

          const noteIds = notes.map((entry) => entry.id);
          const transcriptions =
            noteIds.length > 0
              ? await db
                  .select()
                  .from(noteTranscription)
                  .where(inArray(noteTranscription.noteId, noteIds))
              : [];

          const transcriptionByNoteId = new Map(
            transcriptions.map((entry) => [entry.noteId, entry] as const)
          );

          return {
            notes: notes.map((entry) => serializeNote(entry, transcriptionByNoteId.get(entry.id))),
          };
        } catch (error) {
          console.error("[API] Error listing notes:", error);
          set.status = 500;
          return { error: "Failed to list notes" };
        }
      })
      .post("/api/notes", async ({ body, request, set }) => {
        if (!db) {
          set.status = 500;
          return { error: "Database is not configured" };
        }

        try {
          const session = await getAuthenticatedSession(auth, request, set);
          if (!session) {
            return { error: "Not authenticated" };
          }

          const input = (body ?? {}) as CreateNoteInput;
          const now = new Date();
          const createdAt = parseDateInput(input.createdAt) ?? now;
          const updatedAt = parseDateInput(input.updatedAt) ?? createdAt;
          const trashedAt = parseDateInput(input.trashedAt);

          const [createdNote] = await db
            .insert(note)
            .values({
              id: randomUUID(),
              userId: session.user.id,
              title: input.title ?? "",
              body: input.body ?? "",
              createdAt,
              updatedAt,
              trashedAt,
            })
            .returning();

          return {
            note: serializeNote(createdNote),
          };
        } catch (error) {
          console.error("[API] Error creating note:", error);
          set.status = 500;
          return { error: "Failed to create note" };
        }
      })
      .patch("/api/notes/:noteId", async ({ body, params, request, set }) => {
        if (!db) {
          set.status = 500;
          return { error: "Database is not configured" };
        }

        try {
          const session = await getAuthenticatedSession(auth, request, set);
          if (!session) {
            return { error: "Not authenticated" };
          }

          const input = (body ?? {}) as UpdateNoteInput;
          const updates: Partial<typeof note.$inferInsert> = {
            updatedAt: new Date(),
          };

          if (typeof input.title === "string") {
            updates.title = input.title;
          }

          if (typeof input.body === "string") {
            updates.body = input.body;
          }

          if ("trashedAt" in input) {
            updates.trashedAt = parseDateInput(input.trashedAt ?? null);
          }

          const [updatedNote] = await db
            .update(note)
            .set(updates)
            .where(and(eq(note.id, params.noteId), eq(note.userId, session.user.id)))
            .returning();

          if (!updatedNote) {
            set.status = 404;
            return { error: "Note not found" };
          }

          const [transcriptionRow] = await db
            .select()
            .from(noteTranscription)
            .where(eq(noteTranscription.noteId, updatedNote.id));

          return {
            note: serializeNote(updatedNote, transcriptionRow),
          };
        } catch (error) {
          console.error("[API] Error updating note:", error);
          set.status = 500;
          return { error: "Failed to update note" };
        }
      })
      .put("/api/notes/:noteId/transcription", async ({ body, params, request, set }) => {
        if (!db) {
          set.status = 500;
          return { error: "Database is not configured" };
        }

        try {
          const session = await getAuthenticatedSession(auth, request, set);
          if (!session) {
            return { error: "Not authenticated" };
          }

          const [ownedNote] = await db
            .select()
            .from(note)
            .where(and(eq(note.id, params.noteId), eq(note.userId, session.user.id)));

          if (!ownedNote) {
            set.status = 404;
            return { error: "Note not found" };
          }

          const input = body as SaveNoteTranscriptionInput;
          const now = new Date();

          const transcriptionData = {
            status: input.status,
            provider: input.provider,
            mode: input.mode,
            language: input.language,
            model: input.model,
            transcriptText: input.transcriptText,
            finalText: input.finalText,
            interimText: input.interimText,
            segments: input.segments,
            lastSegmentIndex: input.lastSegmentIndex,
            durationSeconds: input.durationSeconds,
            recordingDurationSeconds: input.recordingDurationSeconds,
            error: input.error,
            startedAt: parseDateInput(input.startedAt),
            completedAt: parseDateInput(input.completedAt),
            lastPartialAt: parseDateInput(input.lastPartialAt),
          };

          const [savedTranscription] = await db
            .insert(noteTranscription)
            .values({
              id: randomUUID(),
              noteId: ownedNote.id,
              ...transcriptionData,
              createdAt: now,
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: noteTranscription.noteId,
              set: {
                ...transcriptionData,
                updatedAt: now,
              },
            })
            .returning();

          await db
            .update(note)
            .set({ updatedAt: now })
            .where(and(eq(note.id, ownedNote.id), eq(note.userId, session.user.id)));

          return {
            transcription: serializeNoteTranscription(savedTranscription),
          };
        } catch (error) {
          console.error("[API] Error saving note transcription:", error);
          set.status = 500;
          return { error: "Failed to save note transcription" };
        }
      })
      // Transcription WebSocket routes
      .use(createTranscriptionRoutes())
      // Use .mount() for Better Auth
      .mount(auth.handler)
  );
}
