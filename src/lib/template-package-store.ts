import JSZip from "jszip";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { TemplatePackageState } from "@/lib/types";

const TEMPLATE_PACKAGE_ROOT = path.join(process.cwd(), "output", "template-packages");

function safeRelativePath(inputPath: string) {
  const normalized = inputPath.replace(/\\/g, "/");
  const segments = normalized.split("/").filter(Boolean);
  const sanitized = segments.filter((segment) => segment !== "." && segment !== "..");
  return sanitized.join(path.sep);
}

export async function saveTemplatePackage(input: {
  packageId: string;
  filename: string;
  buffer: Buffer;
  metadata?: TemplatePackageState;
}) {
  const packageRoot = path.join(TEMPLATE_PACKAGE_ROOT, input.packageId);
  const extractedRoot = path.join(packageRoot, "extracted");
  const zip = await JSZip.loadAsync(input.buffer);

  await mkdir(extractedRoot, { recursive: true });
  await writeFile(path.join(packageRoot, input.filename), input.buffer);

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
  };
}

export async function writeExtractedTemplatePackageFile(input: {
  packageId: string;
  relativePath: string;
  content: Buffer | string;
}) {
  const extractedPath = path.join(
    TEMPLATE_PACKAGE_ROOT,
    input.packageId,
    "extracted",
    safeRelativePath(input.relativePath),
  );
  await mkdir(path.dirname(extractedPath), { recursive: true });
  await writeFile(extractedPath, input.content);
  return extractedPath;
}
