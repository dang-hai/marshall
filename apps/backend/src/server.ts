import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import type { Auth } from "@marshall/auth";
import { createTranscriptionRoutes } from "./transcription";

export interface BackendAppOptions {
  auth: Auth;
  baseUrl: string;
  electronProtocol: string;
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

export function createBackendApp({ auth, baseUrl, electronProtocol }: BackendAppOptions) {
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
      // Get current user from session token (for desktop app)
      .get("/api/user/me", async ({ request, set }) => {
        try {
          const session = await auth.api.getSession({ headers: request.headers });
          if (!session) {
            set.status = 401;
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
      // Transcription WebSocket routes
      .use(createTranscriptionRoutes())
      // Use .mount() for Better Auth
      .mount(auth.handler)
  );
}
