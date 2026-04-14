import { NextResponse } from "next/server";

import { createJob, startJob } from "@/lib/job-store";
import { inferDealerNameFromHomepage } from "@/lib/pipeline";
import { templateExists } from "@/lib/templates-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    inputMode?: "homepage" | "manual_urls";
    dealerName?: string;
    homepageUrl?: string;
    manualUrls?: string[];
    seoLock?: boolean;
    oemPreset?: string;
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

  const requestedPreset = payload.oemPreset?.trim() || "ford-varsity";
  const presetIsKnown = await templateExists(requestedPreset);
  if (!presetIsKnown) {
    return NextResponse.json(
      { error: `Template "${requestedPreset}" is not installed. Insert it from the template menu first.` },
      { status: 400 },
    );
  }

  const effectiveHomepageUrl = homepageUrl || manualUrls[0];

  const job = createJob({
    inputMode,
    dealerName: payload.dealerName?.trim() || inferDealerNameFromHomepage(effectiveHomepageUrl),
    homepageUrl: effectiveHomepageUrl,
    manualUrls,
    discoveredUrls: [],
    seoLock: payload.seoLock ?? true,
    oemPreset: requestedPreset,
  });

  startJob(job.id);

  return NextResponse.json(job);
}
