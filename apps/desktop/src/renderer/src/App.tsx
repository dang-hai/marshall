import { useEffect, useState } from "react";
import { Home, MessageSquare, Settings } from "lucide-react";
import { APP_NAME } from "@marshall/shared";
import { cn } from "./lib/utils";

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

  useEffect(() => {
    window.electronAPI?.onNavigate((path) => {
      setActiveView(path === "/settings" ? "settings" : "home");
    });
  }, []);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f7f4ee,_#ece8de_58%,_#e4dfd3)] text-slate-900">
      <div className="h-8 w-full app-drag border-b border-black/5 bg-white/40 backdrop-blur-sm" />

      <main className="flex min-h-[calc(100vh-2rem)]">
        <aside className="app-no-drag flex w-72 shrink-0 flex-col border-r border-black/5 bg-white/70 p-5 backdrop-blur-xl">
          <div className="mb-8">
            <p className="text-xs font-medium uppercase tracking-[0.32em] text-slate-500">
              {APP_NAME}
            </p>
          </div>

          <nav className="space-y-2">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveView(item.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition",
                    isActive
                      ? "bg-slate-900 text-white shadow-[0_12px_30px_rgba(15,23,42,0.18)]"
                      : "text-slate-600 hover:bg-white hover:text-slate-900"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-xl border transition",
                      isActive ? "border-white/15 bg-white/10" : "border-black/5 bg-black/[0.03]"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="mt-auto rounded-[28px] border border-black/5 bg-white/80 p-4 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-black/10 bg-gradient-to-br from-stone-100 to-stone-200 text-2xl font-medium text-slate-500">
                {getInitial(fallbackUser.name)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-slate-900">{fallbackUser.name}</p>
                <p className="text-sm text-slate-500">Profile</p>
              </div>
            </div>
          </div>
        </aside>

        <section className="app-no-drag flex flex-1 items-center justify-center p-8">
          <div className="w-full max-w-3xl rounded-[32px] border border-white/70 bg-white/75 p-10 shadow-[0_24px_80px_rgba(148,163,184,0.22)] backdrop-blur-xl">
            {activeView === "home" && (
              <div className="space-y-4">
                <p className="text-sm font-medium uppercase tracking-[0.28em] text-slate-500">
                  Home
                </p>
                <h1 className="text-4xl font-semibold tracking-tight text-slate-950">
                  Focused calls start here.
                </h1>
                <p className="max-w-xl text-base leading-7 text-slate-600">
                  This new shell gives Marshall a persistent navigation rail. Home and Chat are
                  ready as the initial sidebar sections, with space for more views later.
                </p>
              </div>
            )}

            {activeView === "chat" && (
              <div className="space-y-4">
                <p className="text-sm font-medium uppercase tracking-[0.28em] text-slate-500">
                  Chat
                </p>
                <h1 className="text-4xl font-semibold tracking-tight text-slate-950">
                  Conversations stay one click away.
                </h1>
                <p className="max-w-xl text-base leading-7 text-slate-600">
                  The chat area is wired into the sidebar and ready for message UI when that screen
                  is implemented.
                </p>
              </div>
            )}

            {activeView === "settings" && (
              <div className="space-y-4">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                  <Settings className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium uppercase tracking-[0.28em] text-slate-500">
                  Settings
                </p>
                <h1 className="text-4xl font-semibold tracking-tight text-slate-950">
                  Settings opened from the tray.
                </h1>
                <p className="max-w-xl text-base leading-7 text-slate-600">
                  Tray navigation is still supported. There is no dedicated sidebar item for
                  settings yet, but the view can still be reached programmatically.
                </p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
