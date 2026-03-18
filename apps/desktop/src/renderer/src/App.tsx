import { useEffect, useState } from "react";
import { Home, MessageSquare, ChevronRight } from "lucide-react";
import { APP_NAME } from "@marshall/shared";
import { cn } from "./lib/utils";
import { SettingsPanel } from "./components/SettingsPanel";
import { useAudioCapture } from "./hooks/useAudioCapture";

const sidebarItems = [
  { id: "home", label: "Home", icon: Home },
  { id: "chat", label: "Chat", icon: MessageSquare },
] as const;

type ViewId = (typeof sidebarItems)[number]["id"] | "settings";

const fallbackUser = {
  name: "Hai Dang",
};

function getInitial(name: string) {
  return name.trim().charAt(0).toUpperCase();
}

export default function App() {
  const [activeView, setActiveView] = useState<ViewId>("home");

  const { micPermission, screenPermission, requestMicPermission, requestScreenPermission } =
    useAudioCapture();

  useEffect(() => {
    window.electronAPI?.onNavigate((path) => {
      setActiveView(path === "/settings" ? "settings" : "home");
    });
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="h-7 w-full app-drag border-b border-border/50 bg-muted/30 backdrop-blur-sm" />

      <main className="flex min-h-[calc(100vh-1.75rem)]">
        <aside className="app-no-drag flex w-52 shrink-0 flex-col border-r border-border/50 bg-card/60 px-3 py-4 backdrop-blur-sm">
          <div className="mb-5 px-2">
            <p className="text-2xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              {APP_NAME}
            </p>
          </div>

          <nav className="space-y-0.5">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveView(item.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={() => setActiveView("settings")}
            className={cn(
              "mt-auto rounded-lg border bg-card p-2.5 shadow-soft transition-colors text-left",
              activeView === "settings"
                ? "border-primary/40 bg-primary/5"
                : "border-border/60 hover:border-border hover:bg-accent/50"
            )}
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-sm font-medium text-muted-foreground">
                {getInitial(fallbackUser.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{fallbackUser.name}</p>
                <p className="text-2xs text-muted-foreground">Profile & Settings</p>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </button>
        </aside>

        <section className="app-no-drag flex flex-1 flex-col overflow-auto p-5">
          {activeView === "home" && (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center space-y-2">
                <p className="text-2xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
                  Welcome to Marshall
                </p>
                <p className="text-sm text-muted-foreground">Your focused call moderator</p>
              </div>
            </div>
          )}

          {activeView === "chat" && (
            <div className="flex flex-1 items-center justify-center">
              <div className="w-full max-w-2xl rounded-lg border border-border/60 bg-card p-6 shadow-soft">
                <div className="space-y-3">
                  <p className="text-2xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
                    Chat
                  </p>
                  <h1 className="text-xl font-medium tracking-tight text-foreground">
                    Conversations stay one click away
                  </h1>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    The chat area is wired into the sidebar and ready for message UI when that
                    screen is implemented.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeView === "settings" && (
            <SettingsPanel
              micPermission={micPermission}
              screenPermission={screenPermission}
              onRequestMic={requestMicPermission}
              onRequestScreen={requestScreenPermission}
              onBack={() => setActiveView("home")}
            />
          )}
        </section>
      </main>
    </div>
  );
}
