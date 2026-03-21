export interface UpdateStatus {
  status: "idle" | "checking" | "available" | "downloading" | "downloaded" | "error";
  version?: string;
  releaseNotes?: string;
  progress?: number;
  error?: string;
}
