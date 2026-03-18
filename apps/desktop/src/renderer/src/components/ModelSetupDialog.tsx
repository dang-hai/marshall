import { Download } from "lucide-react";
import { Button } from "./ui/button";

interface ModelSetupDialogProps {
  modelName: string;
  modelSize: string;
  isDownloading: boolean;
  downloadProgress: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ModelSetupDialog({
  modelName,
  modelSize,
  isDownloading,
  downloadProgress,
  onConfirm,
  onCancel,
}: ModelSetupDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-lg border border-border/60 bg-card p-5 shadow-lifted">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Download className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-medium">Download Required</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              The transcription model needs to be downloaded before use.
            </p>
          </div>
        </div>

        <div className="rounded-md bg-muted/50 p-3 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">{modelName}</span>
            <span className="text-2xs text-muted-foreground font-mono">{modelSize}</span>
          </div>
          {isDownloading && (
            <div className="mt-2">
              <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
              <p className="text-2xs text-muted-foreground mt-1 text-right font-mono">
                {downloadProgress}%
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={isDownloading}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={onConfirm} disabled={isDownloading}>
            {isDownloading ? "Downloading..." : "Download"}
          </Button>
        </div>
      </div>
    </div>
  );
}
