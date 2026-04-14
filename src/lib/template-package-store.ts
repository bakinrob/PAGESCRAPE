import JSZip from "jszip";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { TemplatePackageState } from "@/lib/types";

const TEMPLATE_PACKAGE_ROOT = path.join(process.cwd(), "output", "template-packages");
const WINDOWS_RESERVED_NAMES = new Set([
  "con",
  "prn",
  "aux",
  "nul",
  "com1",
  "com2",
  "com3",
  "com4",
  "com5",
  "com6",
  "com7",
  "com8",
  "com9",
  "lpt1",
  "lpt2",
  "lpt3",
  "lpt4",
  "lpt5",
  "lpt6",
  "lpt7",
  "lpt8",
  "lpt9",
]);

function safePathSegment(value: string, fallback: string) {
  const normalized = path.basename(value).replace(/[<>:"/\\|?*\x00-\x1f]+/g, "-").trim();
  const collapsed = normalized.replace(/\.+/g, ".").replace(/\s+/g, "-");
  const sanitized = collapsed.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!sanitized || sanitized === "." || sanitized === "..") {
    return fallback;
  }
  return sanitized.slice(0, 120);
}

function safeRelativePath(inputPath: string) {
  const normalized = inputPath.replace(/\\/g, "/");
  const segments = normalized.split("/").filter(Boolean);
  const sanitized = segments
    .filter((segment) => segment !== "." && segment !== "..")
    .map((segment) => {
      const cleaned = segment
        .replace(/[<>:"/\\|?*\x00-\x1f]+/g, "-")
        .replace(/[. ]+$/g, "")
        .replace(/\s+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 120);
      if (!cleaned) {
        return "file";
      }
      if (WINDOWS_RESERVED_NAMES.has(cleaned.toLowerCase())) {
        return `${cleaned}-file`;
      }
      return cleaned;
    });
  return sanitized.join(path.sep);
}

export async function saveTemplatePackage(input: {
  packageId: string;
  filename: string;
  buffer: Buffer;
  metadata?: TemplatePackageState;
}) {
  const safePackageId = safePathSegment(input.packageId, "template-package");
  const safeFilename = safePathSegment(input.filename, "template-package.zip");
  const packageRoot = path.join(TEMPLATE_PACKAGE_ROOT, safePackageId);
  const extractedRoot = path.join(packageRoot, "extracted");
  const zip = await JSZip.loadAsync(input.buffer);

  await mkdir(extractedRoot, { recursive: true });
  const archivePath = path.join(packageRoot, safeFilename);
  await writeFile(archivePath, input.buffer);

  const entries = Object.values(zip.files)
    .filter((entry) => !entry.dir)
    .sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    const targetPath = path.join(extractedRoot, safeRelativePath(entry.name));
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, Buffer.from(await entry.async("uint8array")));
  }

  const metadataPath = path.join(packageRoot, "metadata.json");
  if (input.metadata) {
    await writeFile(metadataPath, JSON.stringify(input.metadata, null, 2));
  }

  return {
    packageRoot,
    extractedRoot,
    metadataPath,
    archivePath,
  };
}

export async function writeExtractedTemplatePackageFile(input: {
  packageId: string;
  relativePath: string;
  content: Buffer | string;
}) {
  const safePackageId = safePathSegment(input.packageId, "template-package");
  const extractedPath = path.join(
    TEMPLATE_PACKAGE_ROOT,
    safePackageId,
    "extracted",
    safeRelativePath(input.relativePath),
  );
  await mkdir(path.dirname(extractedPath), { recursive: true });
  await writeFile(extractedPath, input.content);
  return extractedPath;
}
