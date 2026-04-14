import type { JobState } from "@/lib/types";

export type WorkspaceStage = "orientation" | "processing" | "workspace";
export type PreviewMode = "package" | "package_pending" | "mapped" | "empty";

export function deriveWorkspaceStage(job: JobState | null): WorkspaceStage {
  if (!job) {
    return "orientation";
  }

  if (job.status === "queued" || job.status === "scraping") {
    return "processing";
  }

  return "workspace";
}

export function choosePreviewMode(input: {
  rebuiltHtml?: string;
  mappedPage?: unknown;
  matchedTemplatePath?: string;
}): PreviewMode {
  if (input.rebuiltHtml) {
    return "package";
  }

  if (input.matchedTemplatePath) {
    return "package_pending";
  }

  if (input.mappedPage) {
    return "mapped";
  }

  return "empty";
}
