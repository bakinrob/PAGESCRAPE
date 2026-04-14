import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { indexTemplatePackage } from "@/lib/template-package";

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
    expect(result.files).toEqual([
      { path: "assets/logo.svg", kind: "asset", size: expect.any(Number) },
      { path: "manifest.json", kind: "other", size: expect.any(Number) },
      { path: "notes/readme.txt", kind: "other", size: expect.any(Number) },
      { path: "pages/home.html", kind: "html", size: expect.any(Number) },
      { path: "scripts/app.js", kind: "js", size: expect.any(Number) },
      { path: "styles/site.css", kind: "css", size: expect.any(Number) },
    ]);
  });
});
