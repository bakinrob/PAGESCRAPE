import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/template-packages/route";

describe("POST /api/template-packages", () => {
  it("indexes and stores an uploaded destination package zip", async () => {
    const zip = new JSZip();
    zip.file("manifest.json", JSON.stringify({ brand: "Ford", oem: "Ford" }));
    zip.file("pages/home.html", "<html><body><h1>Home</h1></body></html>");
    zip.file("styles/site.css", "body { color: #111; }");
    zip.file("scripts/app.js", "console.log('hi');");

    const formData = new FormData();
    const archiveBuffer = await zip.generateAsync({ type: "arraybuffer" });
    formData.set(
      "file",
      new File([archiveBuffer], "dealer-template.zip", {
        type: "application/zip",
      }),
    );

    const response = await POST(
      new Request("http://localhost/api/template-packages", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      templatePackage: {
        filename: string;
        manifestPath?: string;
        files: Array<{ path: string; kind: string }>;
      };
      templateDetection: {
        status: string;
        warnings: string[];
      };
    };

    expect(payload.templatePackage.filename).toBe("dealer-template.zip");
    expect(payload.templatePackage.manifestPath).toBe("manifest.json");
    expect(payload.templatePackage.files.map((file) => file.kind)).toEqual([
      "other",
      "html",
      "js",
      "css",
    ]);
    expect(payload.templateDetection).toEqual({
      status: "ready",
      warnings: [],
    });
  });
});
