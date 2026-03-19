import { useState } from "react";
import { Loader2 } from "lucide-react";
import { APP_NAME } from "@marshall/shared";
import { Button } from "./ui/button";

interface LoginScreenProps {
  onSignIn: (options?: { provider?: string }) => Promise<void>;
}

export function LoginScreen({ onSignIn }: LoginScreenProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [authMethod, setAuthMethod] = useState<"google" | "browser" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setAuthMethod("google");
    setError(null);

    try {
      await onSignIn({ provider: "google" });
    } catch (err) {
      console.error("[Auth] Error:", err);
      setError(err instanceof Error ? err.message : "Auth failed");
    } finally {
      setIsLoading(false);
      setAuthMethod(null);
    }
  };

  const handleBrowserSignIn = async () => {
    setIsLoading(true);
    setAuthMethod("browser");
    setError(null);

    try {
      await onSignIn();
    } catch (err) {
      console.error("[Auth] Error:", err);
      setError(err instanceof Error ? err.message : "Auth failed");
    } finally {
      setIsLoading(false);
      setAuthMethod(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      {/* Drag region for window */}
      <div className="fixed inset-x-0 top-0 h-7 app-drag" />

      <div className="w-full max-w-sm px-8">
        {/* Logo and branding */}
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <svg
              className="h-8 w-8 text-primary"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Welcome to {APP_NAME}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to start transcribing your meetings
          </p>
        </div>

        {/* Auth buttons */}
        <div className="space-y-3">
          <Button
            variant="outline"
            size="lg"
            className="relative w-full justify-center gap-3 border-border/60 bg-card hover:bg-accent"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
          >
            {isLoading && authMethod === "google" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            )}
            <span>Continue with Google</span>
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/60" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <Button
            variant="secondary"
            size="lg"
            className="w-full justify-center"
            onClick={handleBrowserSignIn}
            disabled={isLoading}
          >
            {isLoading && authMethod === "browser" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            <span>Sign in with Browser</span>
          </Button>

          {error && <p className="text-sm text-red-500 text-center">{error}</p>}
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-muted-foreground">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
