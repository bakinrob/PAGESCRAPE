import { NextResponse } from "next/server";

import { getExportBundle, getJob } from "@/lib/job-store";
import { buildHtmlExportArchive } from "@/lib/export-html";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  const job = getJob(jobId);

  if (!job) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  const bundle = getExportBundle(jobId);
  if (!bundle) {
    return NextResponse.json({ error: "Export bundle unavailable." }, { status: 404 });
  }

  const format = new URL(request.url).searchParams.get("format");
  const filenameBase = (bundle.manifest.dealerName || "ford-dealer")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  if (format !== "json") {
    const archive = await buildHtmlExportArchive(bundle);
    return new NextResponse(new Uint8Array(archive.content), {
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="${archive.filename}"`,
      },
    });
  }

  return new NextResponse(JSON.stringify(bundle, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${filenameBase || "ford-dealer"}-ford-scrape-bundle.json"`,
    },
  });
}
