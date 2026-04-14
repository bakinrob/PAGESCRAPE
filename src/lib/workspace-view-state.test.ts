import { describe, expect, it } from "vitest";

import { choosePreviewMode, deriveWorkspaceStage } from "@/lib/workspace-view-state";

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

describe("choosePreviewMode", () => {
  it("prefers package-driven rebuilt html when present", () => {
    const result = choosePreviewMode({
      rebuiltHtml: "<html></html>",
      mappedPage: {} as never,
    });

    expect(result).toBe("package");
  });

  it("falls back to mapped preview when rebuilt html is unavailable", () => {
    expect(choosePreviewMode({ mappedPage: {} as never })).toBe("mapped");
  });

  it("returns empty when no rebuild data exists", () => {
    expect(choosePreviewMode({})).toBe("empty");
  });
});
