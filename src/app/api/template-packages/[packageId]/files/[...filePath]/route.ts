import path from "node:path";
import { readFile } from "node:fs/promises";

import { NextResponse } from "next/server";

import { readStoredTemplatePackage } from "@/lib/job-store";

export const runtime = "nodejs";

const CONTENT_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".htm": "text/html; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function resolveContentType(filePath: string) {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ packageId: string; filePath: string[] }> },
) {
  const { packageId, filePath } = await params;
  const storedPackage = await readStoredTemplatePackage(packageId);

  if (!storedPackage) {
    return NextResponse.json({ error: "Template package not found." }, { status: 404 });
  }

  const relativePath = filePath
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join("/");

  if (!relativePath) {
    return NextResponse.json({ error: "Template file path is required." }, { status: 400 });
  }

  const absolutePath = path.resolve(storedPackage.extractedRoot, relativePath);
  const extractedRoot = path.resolve(storedPackage.extractedRoot);

  if (!absolutePath.startsWith(`${extractedRoot}${path.sep}`) && absolutePath !== extractedRoot) {
    return NextResponse.json({ error: "Template file path is invalid." }, { status: 400 });
  }

  try {
    const file = await readFile(absolutePath);
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "content-type": resolveContentType(relativePath),
        "cache-control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Template file not found." }, { status: 404 });
  }
}
