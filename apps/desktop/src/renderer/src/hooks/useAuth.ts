import { useEffect, useState, useCallback } from "react";
import type { AuthUser } from "@marshall/shared";

interface UseAuthReturn {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  signIn: (options?: { provider?: string }) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    try {
      const userData = await window.authAPI.getUser();
      setUser(userData);
    } catch (err) {
      console.error("[Auth] Error fetching user:", err);
    }
  }, []);

  useEffect(() => {
    // Check for existing token and user on mount
    async function init() {
      try {
        const existingToken = await window.authAPI.getToken();
        if (existingToken) {
          setToken(existingToken);
          await fetchUser();
        }
      } catch (err) {
        console.error("[Auth] Error initializing:", err);
      } finally {
        setIsLoading(false);
      }
    }

    init();
  }, [fetchUser]);

  const signIn = useCallback(
    async (options?: { provider?: string }) => {
      setIsLoading(true);
      setError(null);

      try {
        const newToken = await window.authAPI.requestAuth(options);
        setToken(newToken);
        // Fetch user data after getting token
        await fetchUser();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Sign in failed";
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchUser]
  );

  const signOut = useCallback(async () => {
    setIsLoading(true);
    try {
      await window.authAPI.signOut();
      setToken(null);
      setUser(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign out failed");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    await fetchUser();
  }, [fetchUser]);

  return {
    user,
    token,
    isLoading,
    isAuthenticated: !!user,
    error,
    signIn,
    signOut,
    refreshUser,
  };
}
