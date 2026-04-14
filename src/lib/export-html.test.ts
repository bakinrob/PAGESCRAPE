import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { buildHtmlExportArchive } from "@/lib/export-html";

describe("buildHtmlExportArchive", () => {
  it("emits rebuilt html and handoff metadata", async () => {
    const archive = await buildHtmlExportArchive(
      {
        manifest: {
        jobId: "job-123",
        dealerName: "Demo Dealer",
        inputMode: "homepage",
        homepageUrl: "https://example.com",
        manualUrls: [],
        oemPreset: "dealer-static-reference",
        seoLock: true,
        scrapedAt: "2026-04-13T00:00:00.000Z",
        totalUrls: 1,
        completedPages: 1,
        unsupportedPages: 0,
        discoveredUrls: ["https://example.com"],
        warnings: [],
      },
        extractedPages: [],
        mappedPages: [
          {
            dealer_name: "Demo Dealer",
            oem_preset: "dealer-static-reference",
            source_url: "https://example.com",
            page_type: "homepage",
            template: {
              preset: "dealer-static-reference",
              page_layout: "home",
              version: "1",
            },
            seo: {
              locked: false,
              title: "Demo Dealer | New Cars",
              meta_description: "Shop new cars.",
              h1: "Welcome to Demo Dealer",
              canonical_url: "https://example.com",
              og_title: "Demo Dealer | New Cars",
              og_description: "Shop new cars.",
              og_image: "https://example.com/og.jpg",
            },
            sections: [],
            validation: {
              seo_status: "green",
              warnings: [],
              errors: [],
            },
            confidence_notes: [],
          },
        ],
      },
      {
        rebuiltPages: [
          {
            sourceUrl: "https://example.com",
            pageId: "page-1",
            rebuilt: {
              templatePath: "templates/home.html",
              confidence: 0.91,
              html: "<!doctype html><html><head><title>Demo Dealer | New Cars</title></head><body><h1>Welcome to Demo Dealer</h1></body></html>",
            },
          },
        ],
      },
    );

    const zip = await JSZip.loadAsync(archive.content);
    const manifest = JSON.parse(await zip.file("manifest.json")!.async("string"));
    const mapping = JSON.parse(await zip.file("data/mapping.json")!.async("string"));
    const summary = JSON.parse(await zip.file("data/summary.json")!.async("string"));
    const fileNames = Object.keys(zip.files);
    const rebuiltHtmlEntry = zip.file("pages/templates/home.html");

    expect(manifest.dealerName).toBe("Demo Dealer");
    expect(mapping[0]).toMatchObject({
      sourceUrl: "https://example.com",
      pageType: "homepage",
      templatePath: "templates/home.html",
      rebuilt: true,
      confidence: 0.91,
    });
    expect(summary.rebuiltPages).toBe(1);
    expect(fileNames).toContain("pages/templates/home.html");
    expect(rebuiltHtmlEntry).not.toBeNull();
    const rebuiltHtml = await rebuiltHtmlEntry!.async("string");
    expect(rebuiltHtml).toContain("Welcome to Demo Dealer");
  });
});
