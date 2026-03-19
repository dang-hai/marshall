import { createAuthClient } from "better-auth/client";
import { electronClient } from "@better-auth/electron/client";
import { organizationClient } from "better-auth/client/plugins";
import { storage } from "@better-auth/electron/storage";

const BETTER_AUTH_URL = process.env.BETTER_AUTH_URL || "http://localhost:3000";
const ELECTRON_PROTOCOL = process.env.BETTER_AUTH_ELECTRON_PROTOCOL || "marshall";

console.log("[Auth Client] Initializing with:", {
  baseURL: BETTER_AUTH_URL,
  protocol: ELECTRON_PROTOCOL,
});

export const authClient = createAuthClient({
  baseURL: BETTER_AUTH_URL,
  plugins: [
    organizationClient(),
    electronClient({
      // Sign-in page URL - has electronProxyClient to handle redirect back to Electron
      signInURL: `${BETTER_AUTH_URL}/sign-in`,
      protocol: {
        scheme: ELECTRON_PROTOCOL,
      },
      storage: storage(),
    }),
  ],
});

export type AuthClient = typeof authClient;
