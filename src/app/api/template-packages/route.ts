import { NextResponse } from "next/server";

import { indexTemplatePackage } from "@/lib/template-package";
import { saveTemplatePackage } from "@/lib/template-package-store";

export const runtime = "nodejs";

async function getUploadedZipFile(request: Request) {
  const formData = await request.formData();
  const files = [...formData.values()].filter((value): value is File => value instanceof File);
  const zipFile = files.find((file) => file.name.toLowerCase().endsWith(".zip"));

  if (zipFile) {
    return zipFile;
  }

  if (files.length > 0) {
    throw new Error("Upload a .zip template package.");
  }

  throw new Error("A .zip file is required.");
}

export async function POST(request: Request) {
  try {
    const file = await getUploadedZipFile(request);
    const buffer = Buffer.from(await file.arrayBuffer());
    const templatePackage = await indexTemplatePackage(buffer, file.name);
    const storage = await saveTemplatePackage({
      packageId: templatePackage.id,
      filename: file.name,
      buffer,
      metadata: templatePackage,
    });

    return NextResponse.json({
      templatePackage,
      templateDetection: {
        status: "ready",
        warnings: templatePackage.warnings ?? [],
      },
      storage,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to upload template package.",
      },
      { status: 400 },
    );
  }
}
