import type { JobState } from "@/lib/types";

export type WorkspaceStage = "orientation" | "processing" | "workspace";

export function deriveWorkspaceStage(job: JobState | null): WorkspaceStage {
  if (!job) {
    return "orientation";
  }

  if (job.status === "queued" || job.status === "scraping") {
    return "processing";
  }

  return "workspace";
}
