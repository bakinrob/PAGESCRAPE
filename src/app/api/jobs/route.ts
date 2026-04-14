import { NextResponse } from "next/server";

import { createJob, readStoredTemplatePackage, startJob } from "@/lib/job-store";
import { inferDealerNameFromHomepage } from "@/lib/pipeline";
import { listTemplates } from "@/lib/templates-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    inputMode?: "homepage" | "manual_urls";
    dealerName?: string;
    homepageUrl?: string;
    manualUrls?: string[];
    seoLock?: boolean;
    oemPreset?: string;
    templatePackageId?: string;
  };

  const inputMode = payload.inputMode === "manual_urls" ? "manual_urls" : "homepage";
  const homepageUrl = payload.homepageUrl?.trim();
  const manualUrls = (payload.manualUrls ?? [])
    .map((url) => url.trim())
    .filter(Boolean)
    .slice(0, 10);

  if (inputMode === "homepage" && !homepageUrl) {
    return NextResponse.json({ error: "A homepage URL is required." }, { status: 400 });
  }

  if (inputMode === "manual_urls" && manualUrls.length === 0) {
    return NextResponse.json({ error: "Add at least one static page URL." }, { status: 400 });
  }

  try {
    if (homepageUrl) {
      new URL(homepageUrl);
    }
    manualUrls.forEach((url) => {
      new URL(url);
    });
  } catch {
    return NextResponse.json({ error: "All URLs must be valid absolute URLs." }, { status: 400 });
  }

  const effectiveHomepageUrl = homepageUrl || manualUrls[0];
  const templatePackageId = payload.templatePackageId?.trim();
  const packageTemplate =
    templatePackageId ? await readStoredTemplatePackage(templatePackageId) : undefined;

  if (templatePackageId && !packageTemplate) {
    return NextResponse.json(
      { error: `Template package "${templatePackageId}" was not found.` },
      { status: 404 },
    );
  }

  const requestedPreset = payload.oemPreset?.trim() || "dealer-static-reference";
  const installedTemplates = await listTemplates();
  const presetRecord = installedTemplates.find((record) => record.id === requestedPreset);

  if (!packageTemplate && !presetRecord) {
    return NextResponse.json(
      { error: `Template "${requestedPreset}" is not installed. Insert it from the template menu first.` },
      { status: 400 },
    );
  }

  const job = createJob({
    inputMode,
    dealerName: payload.dealerName?.trim() || inferDealerNameFromHomepage(effectiveHomepageUrl),
    homepageUrl: effectiveHomepageUrl,
    manualUrls,
    discoveredUrls: [],
    seoLock: payload.seoLock ?? true,
    oemPreset: requestedPreset,
    templatePackageId: packageTemplate?.packageId ?? templatePackageId,
    templatePackage: packageTemplate?.templatePackage,
    templateDetection: packageTemplate
      ? {
          status: "ready",
          warnings: packageTemplate.templatePackage.warnings ?? [],
        }
      : undefined,
    destinationBrand: packageTemplate
      ? packageTemplate.templatePackage.inferredBrand || packageTemplate.templatePackage.inferredOem
        ? {
            brand: packageTemplate.templatePackage.inferredBrand,
            oem: packageTemplate.templatePackage.inferredOem,
            source: "manifest",
            confidence: 1,
          }
        : presetRecord
          ? {
              brand: presetRecord.brand,
              oem: presetRecord.brand,
              source: "fallback",
              confidence: 0.5,
            }
          : undefined
      : presetRecord
        ? {
            brand: presetRecord.brand,
            oem: presetRecord.brand,
            source: "fallback",
            confidence: 0.5,
          }
        : undefined,
  });

  startJob(job.id);

  return NextResponse.json(job);
}
