import { useState, useEffect } from "react";
import { TranscriptionPanel } from "./components/TranscriptionPanel";
import { APP_NAME } from "@marshall/shared";

export default function App() {
  const [currentPath, setCurrentPath] = useState("/");

  useEffect(() => {
    window.electronAPI?.onNavigate((path) => {
      setCurrentPath(path);
    });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Draggable title bar for macOS */}
      <div className="h-8 w-full app-drag bg-muted/50 flex items-center justify-center">
        <span className="text-xs text-muted-foreground">{APP_NAME}</span>
      </div>

      <main className="container mx-auto p-6">
        {currentPath === "/settings" ? (
          <div className="max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Settings</h1>
            <p className="text-muted-foreground">Settings page coming soon...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6">
            <TranscriptionPanel />
          </div>
        )}
      </main>
    </div>
  );
}
