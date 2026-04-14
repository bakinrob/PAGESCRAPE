import { NextResponse } from "next/server";

import { readStoredTemplatePackage } from "@/lib/job-store";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ packageId: string }> },
) {
  const { packageId } = await params;
  const stored = await readStoredTemplatePackage(packageId);

  if (!stored) {
    return NextResponse.json({ error: "Template package not found." }, { status: 404 });
  }

  return NextResponse.json({
    templatePackage: stored.templatePackage,
    templateDetection: {
      status: "ready",
      warnings: stored.templatePackage.warnings ?? [],
    },
    destinationBrand:
      stored.templatePackage.inferredBrand || stored.templatePackage.inferredOem
        ? {
            brand: stored.templatePackage.inferredBrand,
            oem: stored.templatePackage.inferredOem,
            source: "manifest",
            confidence: 1,
          }
        : undefined,
    storage: {
      packageId: stored.packageId,
      archiveFilename: stored.archiveFilename,
      files: stored.files,
    },
  });
}
