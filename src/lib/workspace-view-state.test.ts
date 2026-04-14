import { describe, expect, it } from "vitest";

import { deriveWorkspaceStage } from "@/lib/workspace-view-state";

describe("deriveWorkspaceStage", () => {
  it("returns orientation when no job is loaded", () => {
    expect(deriveWorkspaceStage(null)).toBe("orientation");
  });

  it("returns processing while a job is queued or scraping", () => {
    expect(deriveWorkspaceStage({ status: "queued" } as never)).toBe("processing");
    expect(deriveWorkspaceStage({ status: "scraping" } as never)).toBe("processing");
  });

  it("returns workspace after the job starts resolving", () => {
    expect(deriveWorkspaceStage({ status: "complete" } as never)).toBe("workspace");
    expect(deriveWorkspaceStage({ status: "error" } as never)).toBe("workspace");
  });
});
