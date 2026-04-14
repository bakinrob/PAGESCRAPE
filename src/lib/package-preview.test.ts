import { describe, expect, it } from "vitest";

import { buildTemplatePackageBaseHref, injectTemplatePackageBase } from "@/lib/package-preview";

describe("package preview helpers", () => {
  it("builds a base href from the template directory", () => {
    expect(buildTemplatePackageBaseHref("pkg-1", "templates/home.html")).toBe(
      "/api/template-packages/pkg-1/files/templates/",
    );
  });

  it("injects a base tag into html with a head element", () => {
    const document = injectTemplatePackageBase(
      "<html><head><title>Demo</title></head><body></body></html>",
      "/api/template-packages/pkg-1/files/templates/",
    );

    expect(document).toContain('<base href="/api/template-packages/pkg-1/files/templates/">');
  });

  it("wraps partial html when a head element is missing", () => {
    const document = injectTemplatePackageBase("<section>Demo</section>", "/api/template-packages/pkg-1/files/");

    expect(document).toContain("<!doctype html>");
    expect(document).toContain('<base href="/api/template-packages/pkg-1/files/">');
  });
});
