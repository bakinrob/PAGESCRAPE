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

    expect(result[0]).toMatchObject({
      pageId: "page-home",
      sourcePageType: "homepage",
      templatePath: "templates/home.html",
    });
    expect(result[0].reasons.join(" ")).toContain("exact page-type match");
    expect(result[0].alternatives).toHaveLength(2);
    expect(result[0].alternatives[0]).toContain("templates/contact.html");
    expect(result[0].alternatives[1]).toContain("templates/landing.html");

    expect(result[1]).toMatchObject({
      pageId: "page-about",
      sourcePageType: "about",
      templatePath: "templates/landing.html",
    });
    expect(result[1].reasons.join(" ")).toContain("nearest confidence fallback");
    expect(result[1].alternatives).toContainEqual(
      expect.stringContaining("templates/contact.html"),
    );
  });
});
