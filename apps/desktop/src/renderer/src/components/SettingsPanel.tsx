import { Check, X, ChevronRight } from "lucide-react";
import { Button } from "./ui/button";

interface SettingsPanelProps {
  micPermission: "granted" | "denied" | "prompt" | "unknown";
  screenPermission: "granted" | "denied" | "prompt" | "unknown";
  onRequestMic: () => Promise<boolean>;
  onRequestScreen: () => Promise<boolean>;
  onBack: () => void;
}

export function SettingsPanel({
  micPermission,
  screenPermission,
  onRequestMic,
  onRequestScreen,
  onBack,
}: SettingsPanelProps) {
  const PermissionRow = ({
    label,
    description,
    granted,
    onRequest,
  }: {
    label: string;
    description: string;
    granted: boolean;
    onRequest: () => void;
  }) => (
    <div className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-0">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-5 w-5 items-center justify-center rounded-full ${
            granted ? "bg-green-600/10 text-green-600" : "bg-muted text-muted-foreground"
          }`}
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

  return (
    <div className="w-full max-w-md space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight className="h-3 w-3 rotate-180" />
          Back
        </button>
      </div>

      <div>
        <h2 className="text-lg font-medium">Settings</h2>
        <p className="text-xs text-muted-foreground">Manage permissions and preferences</p>
      </div>

      <div className="rounded-lg border border-border/60 bg-card p-3">
        <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
          Permissions
        </p>
        <PermissionRow
          label="Microphone"
          description="Required for voice transcription"
          granted={micPermission === "granted"}
          onRequest={onRequestMic}
        />
        <PermissionRow
          label="Screen Recording"
          description="Required for system audio capture"
          granted={screenPermission === "granted"}
          onRequest={onRequestScreen}
        />
      </div>

      <p className="text-2xs text-muted-foreground">
        To revoke permissions, go to System Settings → Privacy & Security
      </p>
    </div>
  );
}
