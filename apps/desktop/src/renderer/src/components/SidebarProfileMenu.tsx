import type { Ref } from "react";
import { ChevronUp, Settings } from "lucide-react";
import { cn } from "../lib/utils";
import { fallbackUser } from "./settings-config";

interface SidebarProfileMenuProps {
  active: boolean;
  containerRef?: Ref<HTMLDivElement>;
  isOpen: boolean;
  onOpenSettings: () => void;
  onToggle: () => void;
}

function getInitial(name: string) {
  return name.trim().charAt(0).toUpperCase();
}

export function SidebarProfileMenu({
  active,
  containerRef,
  isOpen,
  onOpenSettings,
  onToggle,
}: SidebarProfileMenuProps) {
  return (
    <div className="relative mt-auto" ref={containerRef}>
      {isOpen && (
        <div
          role="menu"
          aria-label="Profile menu"
          className="absolute inset-x-0 bottom-full mb-2 overflow-hidden rounded-lg border border-border/70 bg-popover shadow-lifted"
        >
          <div className="border-b border-border/60 bg-muted/40 px-3 py-2">
            <p className="truncate text-xs font-medium text-popover-foreground">
              {fallbackUser.name}
            </p>
            <p className="text-2xs text-muted-foreground">Signed in placeholder</p>
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={onOpenSettings}
            className="flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors hover:bg-accent"
          >
            <Settings className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
            <div>
              <p className="text-xs font-medium text-popover-foreground">Settings</p>
              <p className="text-2xs text-muted-foreground">Open account and app preferences</p>
            </div>
          </button>
        </div>
      )}

      <button
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={onToggle}
        className={cn(
          "w-full rounded-lg border bg-card p-2.5 text-left shadow-soft transition-colors",
          active || isOpen
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
          <ChevronUp
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform",
              isOpen ? "rotate-0" : "rotate-180"
            )}
          />
        </div>
      </button>
    </div>
  );
}
