import JSZip from "jszip";

import type { TemplatePackageFile, TemplatePackageState } from "@/lib/types";

function classifyExtension(path: string): TemplatePackageFile["kind"] {
  const lowerPath = path.toLowerCase();

  if (lowerPath.endsWith(".html") || lowerPath.endsWith(".htm")) {
    return "html";
  }

  if (lowerPath.endsWith(".css")) {
    return "css";
  }

  if (lowerPath.endsWith(".js") || lowerPath.endsWith(".mjs") || lowerPath.endsWith(".cjs")) {
    return "js";
  }

  if (
    lowerPath.endsWith(".png") ||
    lowerPath.endsWith(".jpg") ||
    lowerPath.endsWith(".jpeg") ||
    lowerPath.endsWith(".gif") ||
    lowerPath.endsWith(".svg") ||
    lowerPath.endsWith(".webp") ||
    lowerPath.endsWith(".ico") ||
    lowerPath.endsWith(".avif") ||
    lowerPath.endsWith(".woff") ||
    lowerPath.endsWith(".woff2") ||
    lowerPath.endsWith(".ttf") ||
    lowerPath.endsWith(".eot")
  ) {
    return "asset";
  }

  return "other";
}

export function classifyPackagePath(path: string): TemplatePackageFile["kind"] {
  const normalized = path.replace(/\\/g, "/");
  const segments = normalized.split("/").filter(Boolean);
  const fileName = segments[segments.length - 1] ?? normalized;
  const lowerFileName = fileName.toLowerCase();

  if (lowerFileName === "manifest.json") {
    return "other";
  }

  const classified = classifyExtension(fileName);
  if (classified !== "other") {
    return classified;
  }

  if (segments.some((segment) => segment.toLowerCase() === "assets" || segment.toLowerCase() === "asset")) {
    return "asset";
  }

  return "other";
}

export async function indexTemplatePackage(
  buffer: Buffer,
  filename: string,
): Promise<TemplatePackageState> {
  const zip = await JSZip.loadAsync(buffer);
  const fileEntries = Object.values(zip.files)
    .filter((entry) => !entry.dir)
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  const files = await Promise.all(
    fileEntries.map(async (path) => {
      const entry = zip.file(path);
      if (!entry) {
        throw new Error(`Missing zip entry for ${path}`);
      }

      const content = await entry.async("uint8array");
      return {
        path,
        kind: classifyPackagePath(path),
        size: content.byteLength,
      };
    }),
  );

  const manifestPath = files.find((file) => file.path.toLowerCase().endsWith("manifest.json"))?.path;
  const manifestFile = manifestPath ? zip.file(manifestPath) : null;
  const manifestText = manifestFile ? await manifestFile.async("string") : null;
  let inferredBrand: string | undefined;
  let inferredOem: string | undefined;

  if (manifestText) {
    try {
      const manifest = JSON.parse(manifestText) as {
        brand?: string;
        oem?: string;
        destinationBrand?: string;
        destinationOem?: string;
      };
      inferredBrand = manifest.brand || manifest.destinationBrand;
      inferredOem = manifest.oem || manifest.destinationOem;
    } catch {
      // Keep indexing deterministic even if the manifest is malformed.
    }
  }

  return {
    id: crypto.randomUUID(),
    filename,
    uploadedAt: new Date().toISOString(),
    manifestPath,
    files,
    inferredBrand,
    inferredOem,
  };
}
