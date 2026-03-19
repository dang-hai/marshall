import { useEffect, useRef, useState } from "react";
import { Home, MessageSquare } from "lucide-react";
import { APP_NAME } from "@marshall/shared";
import { DESKTOP_NAVIGATION_ROUTES } from "../../shared/navigation";
import { cn } from "./lib/utils";
import { HomePanel } from "./components/HomePanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { SidebarProfileMenu } from "./components/SidebarProfileMenu";
import { settingsSidebarItems, type SettingsSectionId } from "./components/settings-config";

const sidebarItems = [
  { id: "home", label: "Home", icon: Home },
  { id: "chat", label: "Chat", icon: MessageSquare },
] as const;

type ViewId = (typeof sidebarItems)[number]["id"] | "settings";

interface AppShellProps {
  initialProfileMenuOpen?: boolean;
  initialSettingsSection?: SettingsSectionId;
  initialView?: ViewId;
}

export function AppShell({
  initialProfileMenuOpen = false,
  initialSettingsSection = "account",
  initialView = "home",
}: AppShellProps) {
  const [activeView, setActiveView] = useState<ViewId>(initialView);
  const [activeSettingsSection, setActiveSettingsSection] =
    useState<SettingsSectionId>(initialSettingsSection);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(initialProfileMenuOpen);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    window.electronAPI?.onNavigate((path) => {
      if (path === DESKTOP_NAVIGATION_ROUTES.settings) {
        setActiveView("settings");
        setActiveSettingsSection("account");
        setIsProfileMenuOpen(false);
        return;
      }

      setActiveView("home");
    });
  }, []);

  useEffect(() => {
    if (!isProfileMenuOpen) {
      return;
    }

    const handleMouseDown = (event: MouseEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isProfileMenuOpen]);

  const openSettings = () => {
    setActiveSettingsSection("account");
    setActiveView("settings");
    setIsProfileMenuOpen(false);
  };

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

          {activeView === "settings" ? (
            <nav className="space-y-1">
              {settingsSidebarItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeSettingsSection === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveSettingsSection(item.id)}
                    className={cn(
                      "flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">{item.label}</p>
                      <p
                        className={cn(
                          "text-2xs",
                          isActive ? "text-primary-foreground/75" : "text-muted-foreground"
                        )}
                      >
                        {item.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </nav>
          ) : (
            <>
              <nav className="space-y-0.5">
                {sidebarItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeView === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveView(item.id);
                        setIsProfileMenuOpen(false);
                      }}
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

              <SidebarProfileMenu
                active={false}
                containerRef={profileMenuRef}
                isOpen={isProfileMenuOpen}
                onOpenSettings={openSettings}
                onToggle={() => setIsProfileMenuOpen((current) => !current)}
              />
            </>
          )}
        </aside>

        <section className="app-no-drag flex flex-1 flex-col overflow-auto p-5">
          {activeView === "home" && <HomePanel />}

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
            <SettingsPanel onBack={() => setActiveView("home")} section={activeSettingsSection} />
          )}
        </section>
      </main>
    </div>
  );
}

export default function App() {
  return <AppShell />;
}
