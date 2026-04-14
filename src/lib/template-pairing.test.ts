import { describe, expect, it } from "vitest";

import { pairSourcePagesToTemplates } from "@/lib/template-pairing";

describe("pairSourcePagesToTemplates", () => {
  it("prefers exact matches before falling back to the nearest confidence match", () => {
    const result = pairSourcePagesToTemplates(
      [
        {
          pageId: "page-home",
          pageType: "homepage",
          confidence: 0.72,
          reasons: ["path:root-homepage"],
        },
        {
          pageId: "page-about",
          pageType: "about",
          confidence: 0.91,
          reasons: ["text:about"],
        },
      ],
      [
        {
          path: "templates/home.html",
          pageType: "homepage",
          confidence: 0.64,
          reasons: ["filename matched \"home\""],
          alternatives: [],
        },
        {
          path: "templates/contact.html",
          pageType: "contact",
          confidence: 0.88,
          reasons: ["filename matched \"contact\""],
          alternatives: [],
        },
        {
          path: "templates/landing.html",
          pageType: "local_seo_landing",
          confidence: 0.94,
          reasons: ["filename matched \"landing\""],
          alternatives: [],
        },
      ],
    );

    expect(result).toHaveLength(2);
    const byPageId = Object.fromEntries(result.map((pairing) => [pairing.pageId, pairing]));

    expect(byPageId["page-home"]).toMatchObject({
      pageId: "page-home",
      sourcePageType: "homepage",
      templatePath: "templates/home.html",
    });
    expect(byPageId["page-home"].reasons.join(" ")).toContain("exact page-type match");
    expect(byPageId["page-home"].alternatives).toHaveLength(1);
    expect(byPageId["page-home"].alternatives[0]).toContain("templates/contact.html");

    expect(byPageId["page-about"]).toMatchObject({
      pageId: "page-about",
      sourcePageType: "about",
      templatePath: "templates/landing.html",
    });
    expect(byPageId["page-about"].reasons.join(" ")).toContain("nearest confidence fallback");
    expect(byPageId["page-about"].confidence).toBeLessThan(0.7);
    expect(byPageId["page-about"].alternatives).toHaveLength(2);
    expect(byPageId["page-about"].alternatives).toContainEqual(
      expect.stringContaining("templates/home.html"),
    );
    expect(byPageId["page-about"].alternatives).toContainEqual(
      expect.stringContaining("templates/contact.html"),
    );
  });

  it("does not reuse the same destination template path for multiple source pages", () => {
    const result = pairSourcePagesToTemplates(
      [
        {
          pageId: "page-service-a",
          pageType: "service",
          confidence: 0.94,
          reasons: ["service-page-a"],
        },
        {
          pageId: "page-service-b",
          pageType: "service",
          confidence: 0.81,
          reasons: ["service-page-b"],
        },
      ],
      [
        {
          path: "templates/service-primary.html",
          pageType: "service",
          confidence: 0.92,
          reasons: ["service-primary"],
          alternatives: [],
        },
        {
          path: "templates/service-secondary.html",
          pageType: "service",
          confidence: 0.77,
          reasons: ["service-secondary"],
          alternatives: [],
        },
      ],
    );

    expect(result).toHaveLength(2);
    expect(new Set(result.map((pairing) => pairing.templatePath)).size).toBe(2);
  });
});
