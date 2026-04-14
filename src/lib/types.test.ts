import { describe, expect, it } from "vitest";
import type { JobState } from "@/lib/types";

describe("JobState", () => {
  it("supports template package and pairing state", () => {
    const job: JobState = {
      id: "job-1",
      status: "idle",
      createdAt: "2026-04-13T00:00:00.000Z",
      updatedAt: "2026-04-13T00:00:00.000Z",
      input: {
        inputMode: "homepage",
        homepageUrl: "https://example.com",
        manualUrls: [],
        discoveredUrls: [],
        seoLock: false,
        oemPreset: "ford",
      },
      progress: {
        completed: 0,
        total: 0,
      },
      pages: [],
      pairings: [],
      warnings: [],
    };

    expect(job.templatePackage).toBeUndefined();
    expect(job.templateDetection).toBeUndefined();
    expect(job.pairings).toBeDefined();
    expect(job.destinationBrand).toBeUndefined();
  });
});
