import {
  electronClient,
  type ElectronClientOptions,
  type ElectronProxyClientOptions,
} from "@better-auth/electron/client";
import { electronProxyClient } from "@better-auth/electron/proxy";
import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/client";

export function createClient(baseUrl: string) {
  return createAuthClient({
    baseURL: baseUrl,
    plugins: [organizationClient()],
  });
}

export function createElectronClient(baseUrl: string, options: ElectronClientOptions) {
  return createAuthClient({
    baseURL: baseUrl,
    plugins: [organizationClient(), electronClient(options)],
  });
}

export function createElectronProxyClient(baseUrl: string, options: ElectronProxyClientOptions) {
  return createAuthClient({
    baseURL: baseUrl,
    plugins: [organizationClient(), electronProxyClient(options)],
  });
}

export type AuthClient = ReturnType<typeof createClient>;
export type ElectronAuthClient = ReturnType<typeof createElectronClient>;
export type ElectronProxyAuthClient = ReturnType<typeof createElectronProxyClient>;
