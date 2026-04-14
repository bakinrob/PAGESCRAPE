import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { readFile, rm } from "node:fs/promises";

import { indexTemplatePackage } from "@/lib/template-package";
import { saveTemplatePackage } from "@/lib/template-package-store";

describe("indexTemplatePackage", () => {
  it("indexes files and detects a manifest from an in-memory zip", async () => {
    const zip = new JSZip();
    zip.file("manifest.json", JSON.stringify({ brand: "Ford", oem: "Ford" }));
    zip.file("pages/home.html", "<html><body><h1>Home</h1></body></html>");
    zip.file("styles/site.css", "body { color: #111; }");
    zip.file("scripts/app.js", "console.log('hi');");
    zip.file("assets/logo.svg", "<svg />");
    zip.file("notes/readme.txt", "notes");

    const buffer = await zip.generateAsync({ type: "nodebuffer" });
    const result = await indexTemplatePackage(buffer, "dealer-template.zip");

    expect(result.filename).toBe("dealer-template.zip");
    expect(result.manifestPath).toBe("manifest.json");
    expect(result.inferredBrand).toBe("Ford");
    expect(result.inferredOem).toBe("Ford");
    expect(result.files).toEqual([
      { path: "assets/logo.svg", kind: "asset", size: expect.any(Number) },
      { path: "manifest.json", kind: "other", size: expect.any(Number) },
      { path: "notes/readme.txt", kind: "other", size: expect.any(Number) },
      { path: "pages/home.html", kind: "html", size: expect.any(Number) },
      { path: "scripts/app.js", kind: "js", size: expect.any(Number) },
      { path: "styles/site.css", kind: "css", size: expect.any(Number) },
    ]);
  });

  it("keeps indexing and reports a warning when the chosen manifest is malformed", async () => {
    const zip = new JSZip();
    zip.file("manifest.json", "{invalid");
    zip.file("pages/home.html", "<html><body><h1>Home</h1></body></html>");

    const buffer = await zip.generateAsync({ type: "nodebuffer" });
    const result = await indexTemplatePackage(buffer, "broken-template.zip");

    expect(result.manifestPath).toBe("manifest.json");
    expect(result.inferredBrand).toBeUndefined();
    expect(result.inferredOem).toBeUndefined();
    expect(result.warnings).toEqual([
      expect.stringContaining("Manifest detected at manifest.json"),
    ]);
  });

  it("stores the original archive and extracted files inside the package workspace", async () => {
    const zip = new JSZip();
    zip.file("pages/home.html", "<html><body><h1>Home</h1></body></html>");

    const buffer = await zip.generateAsync({ type: "nodebuffer" });
    const metadata = await indexTemplatePackage(buffer, "dealer-template.zip");
    const saved = await saveTemplatePackage({
      packageId: "../unsafe-package-id",
      filename: "../unsafe-name.zip",
      buffer,
      metadata,
    });

    const extractedHtml = await readFile(`${saved.extractedRoot}\\pages\\home.html`, "utf8");

    expect(saved.packageRoot).toContain("output");
    expect(saved.packageRoot).toContain("template-packages");
    expect(saved.archivePath.endsWith("unsafe-name.zip")).toBe(true);
    expect(extractedHtml).toContain("<h1>Home</h1>");

    await rm(saved.packageRoot, { recursive: true, force: true });
  });
});
