import { useState, useEffect } from "react";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { APP_NAME, APP_VERSION } from "@marshall/shared";

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
      <div className="h-8 w-full app-drag bg-muted/50" />

      <main className="container mx-auto p-6">
        <Card className="max-w-lg mx-auto mt-12">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">{APP_NAME}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-center">
              Welcome to {APP_NAME} v{APP_VERSION}
            </p>
            <p className="text-sm text-muted-foreground text-center">
              Your Electron app is running successfully with a tray icon.
            </p>
            {currentPath === "/settings" && (
              <p className="text-sm text-center text-blue-500">
                Settings page (navigated from tray menu)
              </p>
            )}
            <div className="flex justify-center gap-2">
              <Button variant="default">Get Started</Button>
              <Button variant="outline">Learn More</Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
