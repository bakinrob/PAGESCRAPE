import { rm } from "node:fs/promises";

import JSZip from "jszip";
import { afterEach, describe, expect, it } from "vitest";

import { detectTemplateFiles, classifyTemplateFile } from "@/lib/template-detection";
import { indexTemplatePackage } from "@/lib/template-package";
import { saveTemplatePackage } from "@/lib/template-package-store";

const createdPackageRoots: string[] = [];

afterEach(async () => {
  while (createdPackageRoots.length > 0) {
    const packageRoot = createdPackageRoots.pop();
    if (packageRoot) {
      await rm(packageRoot, { recursive: true, force: true });
    }
  }
});

describe("classifyTemplateFile", () => {
  it("scores service templates from filename, title, h1, nav, and hero signals", () => {
    const result = classifyTemplateFile({
      path: "service/index.html",
      html: `
        <html>
          <head>
            <title>Ford Service Center</title>
          </head>
          <body>
            <nav>
              <a href="/service/">Service</a>
              <a href="/contact/">Contact</a>
            </nav>
            <main>
              <section class="hero">
                <img alt="Ford logo" src="/assets/ford-logo.svg" />
                <h1>Ford Service Center</h1>
                <p>Schedule maintenance and repairs today.</p>
              </section>
            </main>
          </body>
        </html>
      `,
      manifest: {
        brand: "Ford",
        oem: "Ford",
      },
    });

    expect(result.pageType).toBe("service");
    expect(result.confidence).toBeGreaterThan(0.6);
    expect(result.reasons.join(" ")).toContain("filename");
    expect(result.reasons.join(" ")).toContain("title");
    expect(result.reasons.join(" ")).toContain("h1");
    expect(result.brand).toEqual({
      brand: "Ford",
      oem: "Ford",
      source: "manifest",
      confidence: 1,
      reasons: ["manifest brand/oem"],
    });
    expect(result.alternatives.length).toBeGreaterThan(0);
  });

  it("does not infer short aliases from unrelated substrings", () => {
    const result = classifyTemplateFile({
      path: "about/index.html",
      html: `
        <html>
          <head><title>Premium Dealer Experience</title></head>
          <body>
            <main>
              <h1>Welcome to our premium dealership</h1>
              <p>We provide a premium experience with no shortcuts.</p>
            </main>
          </body>
        </html>
      `,
    });

    expect(result.brand).toBeUndefined();
  });
});

describe("detectTemplateFiles", () => {
  it("classifies stored html files from package storage", async () => {
    const zip = new JSZip();
    zip.file("manifest.json", JSON.stringify({ brand: "Honda", oem: "Honda" }));
    zip.file(
      "home.html",
      `
        <html>
          <head><title>Honda Dealer Home</title></head>
          <body>
            <nav><a>Home</a><a>Service</a></nav>
            <main>
              <section class="hero">
                <img alt="Honda badge" src="/assets/honda-mark.svg" />
                <h1>Honda Dealer Home</h1>
              </section>
            </main>
          </body>
        </html>
      `,
    );
    zip.file(
      "service.html",
      `
        <html>
          <head><title>Honda Service</title></head>
          <body>
            <nav><a>Service</a><a>Finance</a></nav>
            <main>
              <section class="hero">
                <h1>Honda Service</h1>
                <p>Maintenance and repair scheduling.</p>
              </section>
            </main>
          </body>
        </html>
      `,
    );

    const buffer = Buffer.from(await zip.generateAsync({ type: "uint8array" }));
    const packageMeta = await indexTemplatePackage(buffer, "dealer-template.zip");
    const stored = await saveTemplatePackage({
      packageId: packageMeta.id,
      filename: packageMeta.filename,
      buffer,
      metadata: packageMeta,
    });
    createdPackageRoots.push(stored.packageRoot);

    const result = await detectTemplateFiles(packageMeta.id);

    expect(result.packageId).toBe(packageMeta.id);
    expect(result.files.map((file) => file.pageType)).toEqual(["homepage", "service"]);
    expect(result.brand).toEqual({
      brand: "Honda",
      oem: "Honda",
      source: "manifest",
      confidence: expect.any(Number),
      reasons: expect.arrayContaining(["manifest brand/oem"]),
    });
  });

  it("prefers strong html evidence when stored manifest metadata disagrees", async () => {
    const zip = new JSZip();
    zip.file("home.html", "<html><head><title>Honda Dealer Home</title></head><body><h1>Honda Dealer Home</h1><img alt='Honda logo' src='/assets/honda.svg' /></body></html>");
    zip.file("service.html", "<html><head><title>Honda Service</title></head><body><h1>Honda Service</h1><p>Schedule maintenance.</p></body></html>");

    const buffer = Buffer.from(await zip.generateAsync({ type: "uint8array" }));
    const packageMeta = await indexTemplatePackage(buffer, "dealer-template.zip");
    const stored = await saveTemplatePackage({
      packageId: packageMeta.id,
      filename: packageMeta.filename,
      buffer,
      metadata: {
        ...packageMeta,
        inferredBrand: "Ford",
        inferredOem: "Ford",
      },
    });
    createdPackageRoots.push(stored.packageRoot);

    const result = await detectTemplateFiles(packageMeta.id);

    expect(result.brand).toEqual({
      brand: "Honda",
      oem: "Honda",
      source: "heuristic",
      confidence: expect.any(Number),
      reasons: expect.arrayContaining(["manifest disagrees with Ford"]),
    });
  });
});
