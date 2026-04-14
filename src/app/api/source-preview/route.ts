import { NextResponse } from "next/server";

import { captureSourcePreview } from "@/lib/pipeline";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    url?: string;
  };

  const url = payload.url?.trim();

  if (!url) {
    return NextResponse.json({ error: "A page URL is required." }, { status: 400 });
  }

  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: "Page URL must be a valid absolute URL." }, { status: 400 });
  }

  try {
    const preview = await captureSourcePreview(url);
    return NextResponse.json(preview);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to capture source preview.",
      },
      { status: 500 },
    );
  }
}
