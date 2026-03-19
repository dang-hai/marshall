import { Check, ChevronRight, X } from "lucide-react";
import type { DisplayUser } from "@marshall/shared";
import { defaultAppSettings, type AppSettings } from "../../../shared/settings";
import { useAudioCapture } from "../hooks/useAudioCapture";
import { useSettings } from "../hooks/useSettings";
import { cn, getInitial } from "../lib/utils";
import { type SettingsSectionId } from "./settings-config";
import { Button } from "./ui/button";

const defaultCalendarSettings: AppSettings["calendar"] = defaultAppSettings.calendar;

const calendarVisibilityOptions: Array<{
  description: string;
  key: keyof AppSettings["calendar"]["visibleCalendars"];
  label: string;
}> = [
  {
    key: "work",
    label: "Work",
    description: "Your default work calendar and scheduled meetings.",
  },
  {
    key: "personal",
    label: "Personal",
    description: "Private events that help Marshall understand availability.",
  },
  {
    key: "shared",
    label: "Shared",
    description: "Team or project calendars that should appear alongside your own.",
  },
];

const calendarDisplayOptions: Array<{
  description: string;
  key: Exclude<keyof AppSettings["calendar"], "visibleCalendars">;
  label: string;
}> = [
  {
    key: "showDeclinedEvents",
    label: "Show declined events",
    description: "Keep declined meetings visible for quick context.",
  },
  {
    key: "showWeekends",
    label: "Show weekends",
    description: "Include Saturday and Sunday in calendar previews.",
  },
  {
    key: "compactView",
    label: "Compact layout",
    description: "Reduce spacing to fit more events in the calendar preview.",
  },
];

interface SettingsPanelProps {
  onBack: () => void;
  section: SettingsSectionId;
  user?: DisplayUser | null;
  onSignOut?: () => Promise<void>;
}

interface PermissionRowProps {
  description: string;
  granted: boolean;
  label: string;
  onRequest: () => void;
}

interface PreferenceRowProps {
  checked: boolean;
  description: string;
  disabled?: boolean;
  label: string;
  onToggle: () => void;
}

function PermissionRow({ label, description, granted, onRequest }: PermissionRowProps) {
  return (
    <div className="flex items-center justify-between border-b border-border/40 py-2.5 last:border-0">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded-full",
            granted ? "bg-green-600/10 text-green-600" : "bg-muted text-muted-foreground"
          )}
        >
          {granted ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
        </div>
        <div>
          <p className="text-xs font-medium">{label}</p>
          <p className="text-2xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {!granted && (
        <Button variant="outline" size="sm" onClick={onRequest}>
          Grant
        </Button>
      )}
      {granted && <span className="text-2xs text-muted-foreground">Granted</span>}
    </div>
  );
}

function PreferenceRow({
  label,
  description,
  checked,
  disabled = false,
  onToggle,
}: PreferenceRowProps) {
  return (
    <label className="flex items-start justify-between gap-3 border-b border-border/40 py-3 last:border-0">
      <div>
        <p className="text-xs font-medium text-foreground">{label}</p>
        <p className="text-2xs text-muted-foreground">{description}</p>
      </div>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onToggle}
        className="mt-0.5 h-4 w-4 rounded border-border bg-background text-primary disabled:cursor-not-allowed disabled:opacity-50"
      />
    </label>
  );
}

export function SettingsPanel({ onBack, section, user, onSignOut }: SettingsPanelProps) {
  const { micPermission, screenPermission, requestMicPermission, requestScreenPermission } =
    useAudioCapture();
  const { error, loading, settings, updateSection } = useSettings();
  const calendarSettings = settings?.calendar ?? defaultCalendarSettings;
  const calendarReady = !loading && Boolean(settings);
  const displayName = user?.name || user?.email || "User";

  const toggleCalendarVisibility = (key: keyof AppSettings["calendar"]["visibleCalendars"]) => {
    void updateSection("calendar", {
      visibleCalendars: {
        ...calendarSettings.visibleCalendars,
        [key]: !calendarSettings.visibleCalendars[key],
      },
    });
  };

  const toggleCalendarDisplay = (
    key: Exclude<keyof AppSettings["calendar"], "visibleCalendars">
  ) => {
    void updateSection("calendar", {
      [key]: !calendarSettings[key],
    } as Partial<AppSettings["calendar"]>);
  };

  return (
    <div className="flex w-full max-w-5xl flex-1 flex-col gap-4">
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronRight className="h-3 w-3 rotate-180" />
          Back
        </button>
      </div>

      <div>
        <h2 className="text-lg font-medium">Settings</h2>
        <p className="text-xs text-muted-foreground">
          Manage your account, calendar preferences, and permissions.
        </p>
      </div>

      <div className="flex-1 space-y-4">
        {section === "account" && (
          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-soft">
            <p className="mb-2 text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Current user
            </p>
            <div className="flex items-center gap-3">
              {user?.image ? (
                <img
                  src={user.image}
                  alt={displayName}
                  className="h-10 w-10 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-sm font-medium text-muted-foreground">
                  {getInitial(displayName)}
                </div>
              )}
              <div>
                <h3 className="text-sm font-medium text-foreground">{displayName}</h3>
                <p className="text-xs text-muted-foreground">{user?.email || "Not signed in"}</p>
              </div>
            </div>
            {onSignOut && (
              <div className="mt-4">
                <Button variant="outline" size="sm" onClick={onSignOut}>
                  Sign out
                </Button>
              </div>
            )}
          </div>
        )}

        {section === "calendar" && (
          <>
            <div className="rounded-xl border border-border/60 bg-card p-5 shadow-soft">
              <p className="mb-2 text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Visible calendars
              </p>
              <h3 className="text-sm font-medium text-foreground">Choose which calendars show</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Marshall can tailor meeting context around the calendars you want to keep visible.
              </p>
              <div className="mt-3">
                {calendarVisibilityOptions.map((option) => (
                  <PreferenceRow
                    key={option.key}
                    checked={calendarSettings.visibleCalendars[option.key]}
                    description={option.description}
                    disabled={!calendarReady}
                    label={option.label}
                    onToggle={() => toggleCalendarVisibility(option.key)}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-5 shadow-soft">
              <p className="mb-2 text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Display options
              </p>
              <h3 className="text-sm font-medium text-foreground">
                Control how calendar data appears
              </h3>
              <div className="mt-3">
                {calendarDisplayOptions.map((option) => (
                  <PreferenceRow
                    key={option.key}
                    checked={calendarSettings[option.key]}
                    description={option.description}
                    disabled={!calendarReady}
                    label={option.label}
                    onToggle={() => toggleCalendarDisplay(option.key)}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {section === "permissions" && (
          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-soft">
            <p className="mb-2 text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Permissions
            </p>
            <PermissionRow
              label="Microphone"
              description="Required for voice transcription"
              granted={micPermission === "granted"}
              onRequest={requestMicPermission}
            />
            <PermissionRow
              label="Screen Recording"
              description="Required for system audio capture"
              granted={screenPermission === "granted"}
              onRequest={requestScreenPermission}
            />
            <p className="mt-4 text-2xs text-muted-foreground">
              To revoke permissions, go to System Settings {" > "} Privacy & Security.
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
