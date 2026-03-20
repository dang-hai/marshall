import { Check, ChevronRight, FolderOpen, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { DisplayUser, GoogleCalendarConnectionStatus } from "@marshall/shared";
import {
  defaultAppSettings,
  type AppSettings,
  type TranscriptionProvider,
} from "../../../shared/settings";
import { useAudioCapture } from "../hooks/useAudioCapture";
import { useSettings } from "../hooks/useSettings";

interface ModelStorageInfo {
  modelsDir: string;
  selectedModelSize: number | null;
  selectedModelPath: string | null;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
import { cn, getInitial } from "../lib/utils";
import { type SettingsSectionId } from "./settings-config";
import { Button } from "./ui/button";

const transcriptionProviderOptions: Array<{
  description: string;
  disabled?: boolean;
  key: TranscriptionProvider;
  label: string;
}> = [
  {
    key: "local",
    label: "Local (Whisper)",
    description: "Process audio locally using the Whisper model. Private and offline.",
  },
  {
    key: "deepgram",
    label: "Deepgram",
    description: "Real-time cloud transcription with low latency. Requires internet connection.",
  },
  {
    key: "assemblyAI",
    label: "AssemblyAI",
    description: "Cloud-based transcription with high accuracy. Coming soon.",
    disabled: true,
  },
  {
    key: "speechmatics",
    label: "Speechmatics",
    description: "Enterprise-grade cloud transcription. Coming soon.",
    disabled: true,
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

interface ProviderRowProps {
  children?: React.ReactNode;
  description: string;
  disabled?: boolean;
  label: string;
  name: string;
  onSelect: () => void;
  selected: boolean;
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

function ProviderRow({
  children,
  description,
  disabled = false,
  label,
  name,
  onSelect,
  selected,
}: ProviderRowProps) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border border-border/40 p-3 transition-all duration-200",
        selected && "border-primary/50 bg-primary/5",
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      <input
        type="radio"
        name={name}
        checked={selected}
        disabled={disabled}
        onChange={onSelect}
        className="mt-0.5 h-4 w-4 border-border bg-background text-primary disabled:cursor-not-allowed"
      />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground">{label}</p>
        <p className="text-2xs text-muted-foreground">{description}</p>
        {selected && children && (
          <div className="mt-2 pt-2 border-t border-border/30">{children}</div>
        )}
      </div>
    </label>
  );
}

const defaultTranscriptionSettings: AppSettings["transcription"] = defaultAppSettings.transcription;

export function SettingsPanel({ onBack, section, user, onSignOut }: SettingsPanelProps) {
  const { micPermission, screenPermission, requestMicPermission, requestScreenPermission } =
    useAudioCapture();
  const { error, loading, settings, updateSection } = useSettings();
  const transcriptionSettings = settings?.transcription ?? defaultTranscriptionSettings;
  const displayName = user?.name || user?.email || "User";
  const transcriptionReady = !loading && Boolean(settings);

  const [modelStorageInfo, setModelStorageInfo] = useState<ModelStorageInfo | null>(null);
  const [calendarConnection, setCalendarConnection] =
    useState<GoogleCalendarConnectionStatus | null>(null);
  const [isCalendarLoading, setIsCalendarLoading] = useState(section === "calendar");
  const [isCalendarActionLoading, setIsCalendarActionLoading] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);

  const loadCalendarStatus = useCallback(async () => {
    setIsCalendarLoading(true);
    setCalendarError(null);

    try {
      const status = await window.calendarAPI.getStatus();
      setCalendarConnection(status);
      return status;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load Google Calendar status";
      setCalendarError(message);
      return null;
    } finally {
      setIsCalendarLoading(false);
    }
  }, []);

  useEffect(() => {
    if (section === "audio") {
      const fetchModelInfo = async () => {
        try {
          const [storageInfo, models] = await Promise.all([
            window.transcriptionAPI.getStorageInfo(),
            window.transcriptionAPI.getModels(),
          ]);

          const selectedModel = transcriptionSettings.selectedModel;
          const modelInfo = models.find((m) => m.name === selectedModel);

          setModelStorageInfo({
            modelsDir: storageInfo.modelsDir,
            selectedModelSize: storageInfo.modelSizes[selectedModel] ?? null,
            selectedModelPath: modelInfo?.path ?? null,
          });
        } catch {
          // Ignore errors - info is optional
        }
      };

      void fetchModelInfo();
    }
  }, [section, transcriptionSettings.selectedModel]);

  useEffect(() => {
    if (section === "calendar") {
      void loadCalendarStatus();
    }
  }, [loadCalendarStatus, section]);

  const setTranscriptionProvider = (provider: TranscriptionProvider) => {
    void updateSection("transcription", { provider });
  };

  const connectGoogleCalendar = async () => {
    setIsCalendarActionLoading(true);
    setCalendarError(null);

    try {
      await window.calendarAPI.connectGoogle();
      await loadCalendarStatus();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to connect Google Calendar";
      setCalendarError(message);
    } finally {
      setIsCalendarActionLoading(false);
    }
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

        {section === "audio" && (
          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-soft">
            <p className="mb-2 text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Transcription provider
            </p>
            <h3 className="text-sm font-medium text-foreground">Choose how audio is transcribed</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Select between local processing or cloud-based transcription services.
            </p>
            <div className="mt-4 space-y-2">
              {transcriptionProviderOptions.map((option) => (
                <ProviderRow
                  key={option.key}
                  description={option.description}
                  disabled={!transcriptionReady || option.disabled}
                  label={option.label}
                  name="transcription-provider"
                  onSelect={() => setTranscriptionProvider(option.key)}
                  selected={transcriptionSettings.provider === option.key}
                >
                  {option.key === "local" && modelStorageInfo && (
                    <div className="flex items-center gap-4 text-2xs">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void window.electronAPI.openPath(modelStorageInfo.modelsDir);
                        }}
                        className="flex items-center gap-1.5 min-w-0 flex-1 rounded px-1 -mx-1 hover:bg-muted/50 transition-colors text-left"
                      >
                        <FolderOpen className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                        <span className="truncate text-muted-foreground font-mono hover:text-foreground transition-colors">
                          {modelStorageInfo.modelsDir}
                        </span>
                      </button>
                      {modelStorageInfo.selectedModelSize !== null && (
                        <span className="shrink-0 rounded bg-muted/50 px-1.5 py-0.5 font-medium text-muted-foreground">
                          {formatBytes(modelStorageInfo.selectedModelSize)}
                        </span>
                      )}
                    </div>
                  )}
                  {option.key === "deepgram" && (
                    <div className="flex items-center gap-2 text-2xs">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        Nova-2 model
                      </span>
                      <span className="text-muted-foreground/60">|</span>
                      <span className="text-muted-foreground">
                        Audio is sent to Deepgram servers for processing
                      </span>
                    </div>
                  )}
                </ProviderRow>
              ))}
            </div>
          </div>
        )}

        {section === "calendar" && (
          <>
            <div className="rounded-xl border border-border/60 bg-card p-5 shadow-soft">
              <p className="mb-2 text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Google Calendar
              </p>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-medium text-foreground">Connect upcoming events</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Marshall reads your next 5 upcoming Google Calendar events and shows them on
                    Home.
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-2xs font-medium",
                    calendarConnection?.connected
                      ? "bg-emerald-500/10 text-emerald-600"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {calendarConnection?.connected ? "Connected" : "Not connected"}
                </span>
              </div>
              <div className="mt-4 rounded-lg border border-border/50 bg-muted/20 px-4 py-3">
                <p className="text-xs font-medium text-foreground">Connection status</p>
                {isCalendarLoading ? (
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Checking Google Calendar access...</span>
                  </div>
                ) : calendarConnection?.connected ? (
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <p>Connected as {calendarConnection.accountEmail || "your Google account"}.</p>
                    <p>Marshall only requests read-only access for upcoming calendar events.</p>
                  </div>
                ) : (
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <p>Google Calendar access has not been granted yet.</p>
                    <p>
                      Use the button below to approve read-only calendar access in your browser.
                    </p>
                  </div>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => void connectGoogleCalendar()}
                  disabled={isCalendarLoading || isCalendarActionLoading}
                >
                  {isCalendarActionLoading ? (
                    <>
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      <span>
                        {calendarConnection?.connected ? "Reconnecting..." : "Connecting..."}
                      </span>
                    </>
                  ) : (
                    <span>
                      {calendarConnection?.connected
                        ? "Reconnect Google Calendar"
                        : "Connect Google Calendar"}
                    </span>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void loadCalendarStatus()}
                  disabled={isCalendarLoading || isCalendarActionLoading}
                >
                  Refresh status
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-5 shadow-soft">
              <p className="mb-2 text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Sync behavior
              </p>
              <h3 className="text-sm font-medium text-foreground">What Marshall uses</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                The current integration reads event titles, times, locations, and Google Calendar
                links from your primary calendar.
              </p>
              <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                <p>Marshall shows the 5 upcoming events on Home after the calendar is connected.</p>
                <p>
                  Calendar access stays read-only. Editing or creating Google Calendar events is not
                  part of this integration.
                </p>
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
        {calendarError && section === "calendar" && (
          <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {calendarError}
          </div>
        )}
      </div>
    </div>
  );
}
