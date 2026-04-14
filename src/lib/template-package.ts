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

function pickManifestPath(paths: string[]) {
  const manifestCandidates = paths.filter((entryPath) =>
    entryPath.toLowerCase().endsWith("manifest.json"),
  );
  if (manifestCandidates.length === 0) {
    return undefined;
  }

  return manifestCandidates.sort((left, right) => {
    const leftDepth = left.split("/").length;
    const rightDepth = right.split("/").length;
    if (leftDepth !== rightDepth) {
      return leftDepth - rightDepth;
    }
    return left.localeCompare(right);
  })[0];
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

  const manifestPath = pickManifestPath(fileEntries);
  const manifestFile = manifestPath ? zip.file(manifestPath) : null;
  const manifestText = manifestFile ? await manifestFile.async("string") : null;
  let inferredBrand: string | undefined;
  let inferredOem: string | undefined;
  const warnings: string[] = [];

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
    } catch (error) {
      warnings.push(
        `Manifest detected at ${manifestPath}, but it could not be parsed as JSON: ${error instanceof Error ? error.message : "unknown parse error"}`,
      );
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
    warnings,
  };
}
