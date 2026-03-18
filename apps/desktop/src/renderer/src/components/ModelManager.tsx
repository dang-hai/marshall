import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import type { ModelInfo, StorageInfo } from "../hooks/useTranscription";

interface ModelManagerProps {
  models: ModelInfo[];
  storageInfo: StorageInfo | null;
  downloadProgress: { modelName: string; percent: number } | null;
  onDownload: (modelName: string) => Promise<boolean>;
  onDelete: (modelName: string) => Promise<boolean>;
  onSelect: (modelName: string) => void;
  selectedModel: string;
  disabled?: boolean;
}

export function ModelManager({
  models,
  storageInfo,
  downloadProgress,
  onDownload,
  onDelete,
  onSelect,
  selectedModel,
  disabled,
}: ModelManagerProps) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    if (bytes < 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const totalDownloaded = storageInfo?.totalSize || 0;

  const handleDelete = async (modelName: string) => {
    if (confirmDelete === modelName) {
      await onDelete(modelName);
      setConfirmDelete(null);
    } else {
      setConfirmDelete(modelName);
      // Auto-cancel confirmation after 3 seconds
      setTimeout(() => setConfirmDelete(null), 3000);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span>Models</span>
          <span className="text-xs font-normal text-muted-foreground">
            {formatSize(totalDownloaded)} used
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {models.map((model) => {
          const isDownloading = downloadProgress?.modelName === model.name;
          const isSelected = selectedModel === model.name;
          const modelSize = storageInfo?.modelSizes[model.name];

          return (
            <div
              key={model.name}
              className={`flex items-center justify-between p-2 rounded-md border ${
                isSelected ? "border-primary bg-primary/5" : "border-border"
              } ${model.downloaded && !disabled ? "cursor-pointer hover:bg-muted/50" : ""}`}
              onClick={() => {
                if (model.downloaded && !disabled && !isDownloading) {
                  onSelect(model.name);
                }
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{model.name}</span>
                  {model.downloaded && <span className="text-xs text-green-500">Downloaded</span>}
                  {isSelected && (
                    <span className="text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                      Selected
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {model.size}
                  {modelSize && ` (${formatSize(modelSize)} on disk)`}
                </div>
              </div>

              <div className="flex items-center gap-2 ml-2">
                {isDownloading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${downloadProgress.percent}%` }}
                      />
                    </div>
                    <span className="text-xs w-8">{downloadProgress.percent}%</span>
                  </div>
                ) : model.downloaded ? (
                  <Button
                    variant={confirmDelete === model.name ? "destructive" : "ghost"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(model.name);
                    }}
                    disabled={disabled}
                  >
                    {confirmDelete === model.name ? "Confirm" : "Delete"}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDownload(model.name);
                    }}
                    disabled={disabled || !!downloadProgress}
                  >
                    Download
                  </Button>
                )}
              </div>
            </div>
          );
        })}

        {storageInfo && (
          <p className="text-xs text-muted-foreground pt-2">
            Models stored in: {storageInfo.modelsDir}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
