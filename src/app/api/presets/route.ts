import { NextResponse } from "next/server";

import { createTemplate, listTemplates } from "@/lib/templates-store";

export const runtime = "nodejs";

export async function GET() {
  const templates = await listTemplates();
  return NextResponse.json({ templates });
}

export async function POST(request: Request) {
  let payload: { displayName?: string; brand?: string; notes?: string };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!payload.displayName?.trim() || !payload.brand?.trim()) {
    return NextResponse.json(
      { error: "Both displayName and brand are required." },
      { status: 400 },
    );
  }

  try {
    const { record, folderPath } = await createTemplate({
      displayName: payload.displayName,
      brand: payload.brand,
      notes: payload.notes,
    });
    return NextResponse.json({ template: record, folderPath });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create template." },
      { status: 500 },
    );
  }
}
