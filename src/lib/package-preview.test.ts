import { describe, expect, it } from "vitest";

import {
  buildTemplatePackageBaseHref,
  injectTemplatePackageBase,
  prepareTemplatePackagePreviewDocument,
  rewriteTemplatePackageRootRelativeUrls,
} from "@/lib/package-preview";

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

  it("rewrites root-relative asset urls to the package file route", () => {
    const document = rewriteTemplatePackageRootRelativeUrls(
      '<link rel="stylesheet" href="/assets/site.css"><style>.hero{background-image:url("/images/hero.jpg")}</style>',
      "pkg-1",
    );

    expect(document).toContain('/api/template-packages/pkg-1/files/assets/site.css');
    expect(document).toContain('/api/template-packages/pkg-1/files/images/hero.jpg');
  });

  it("prepares a package preview document with both rewrites and a base tag", () => {
    const document = prepareTemplatePackagePreviewDocument(
      '<html><head></head><body><img src="/images/logo.svg"></body></html>',
      { packageId: "pkg-1", templatePath: "templates/home.html" },
    );

    expect(document).toContain('<base href="/api/template-packages/pkg-1/files/templates/">');
    expect(document).toContain('/api/template-packages/pkg-1/files/images/logo.svg');
  });
});
