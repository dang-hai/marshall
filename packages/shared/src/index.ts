// Shared types and utilities

export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Auth user from Better Auth session */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  image?: string;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Minimal user info for UI display */
export type DisplayUser = Pick<AuthUser, "id" | "email" | "name" | "image">;

export interface Session {
  id: string;
  userId: string;
  expiresAt: Date;
}

export const APP_NAME = "Marshall";
export const APP_VERSION = "0.0.1";

export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
