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
      templatePackage: {
        id: "pkg-1",
        filename: "dealer-template.zip",
        uploadedAt: "2026-04-13T00:00:00.000Z",
        manifestPath: "manifest.json",
        files: [
          {
            path: "index.html",
            kind: "html",
            size: 1024,
          },
        ],
        inferredBrand: "Ford",
        inferredOem: "Ford",
      },
      templateDetection: {
        status: "ready",
        warnings: ["No manifest found"],
      },
      destinationBrand: {
        brand: "Ford",
        oem: "Ford",
        source: "heuristic",
        confidence: 0.92,
      },
      pairings: [
        {
          pageId: "page-1",
          sourcePageType: "service",
          templatePath: "service.html",
          confidence: 0.84,
          reasons: ["filename match"],
          alternatives: ["index.html"],
        },
      ],
      warnings: [],
    };

    expect(job.templatePackage?.filename).toBe("dealer-template.zip");
    expect(job.templatePackage?.files[0]).toMatchObject({
      path: "index.html",
      kind: "html",
      size: 1024,
    });
    expect(job.templateDetection).toEqual({
      status: "ready",
      warnings: ["No manifest found"],
    });
    expect(job.destinationBrand).toEqual({
      brand: "Ford",
      oem: "Ford",
      source: "heuristic",
      confidence: 0.92,
    });
    expect(job.pairings[0]).toEqual({
      pageId: "page-1",
      sourcePageType: "service",
      templatePath: "service.html",
      confidence: 0.84,
      reasons: ["filename match"],
      alternatives: ["index.html"],
    });
  });
});
