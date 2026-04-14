import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export interface TemplateRecord {
  id: string;
  displayName: string;
  brand: string;
  status: "active" | "preview" | "draft";
  builtIn: boolean;
  createdAt: string;
  notes?: string;
}

const templatesRoot = path.resolve(process.cwd(), "templates");

const builtInTemplates: TemplateRecord[] = [
  {
    id: "dealer-static-reference",
    displayName: "Dealer Static Migration Reference",
    brand: "Reference",
    status: "active",
    builtIn: true,
    createdAt: "2026-04-13T00:00:00.000Z",
    notes:
      "OEM-agnostic reference taxonomy for static dealer page migration. Used as the fallback mapping engine until an uploaded destination package or brand-specific mapping is available.",
  },
  {
    id: "ford-varsity",
    displayName: "Ford — Varsity Reference",
    brand: "Ford",
    status: "active",
    builtIn: true,
    createdAt: "2026-04-13T00:00:00.000Z",
    notes:
      "Reference Ford slot system audited from Varsity Ford and other dealer sites. Used as the default mapping engine for new templates until they ship their own slot definitions.",
  },
];

async function ensureTemplatesRoot() {
  try {
    await stat(templatesRoot);
  } catch {
    await mkdir(templatesRoot, { recursive: true });
  }
}

function safeId(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

async function readUserTemplates(): Promise<TemplateRecord[]> {
  await ensureTemplatesRoot();
  let entries: string[] = [];
  try {
    entries = await readdir(templatesRoot);
  } catch {
    return [];
  }

  const records: TemplateRecord[] = [];
  for (const entry of entries) {
    const configPath = path.join(templatesRoot, entry, "config.json");
    try {
      const raw = await readFile(configPath, "utf8");
      const parsed = JSON.parse(raw) as Partial<TemplateRecord>;
      if (!parsed.id || !parsed.displayName || !parsed.brand) continue;
      records.push({
        id: parsed.id,
        displayName: parsed.displayName,
        brand: parsed.brand,
        status: parsed.status ?? "preview",
        builtIn: false,
        createdAt: parsed.createdAt ?? new Date().toISOString(),
        notes: parsed.notes,
      });
    } catch {
      continue;
    }
  }
  return records;
}

export async function listTemplates(): Promise<TemplateRecord[]> {
  const userRecords = await readUserTemplates();
  const merged = [...builtInTemplates];
  for (const record of userRecords) {
    if (!merged.find((existing) => existing.id === record.id)) {
      merged.push(record);
    }
  }
  return merged;
}

export async function templateExists(id: string) {
  const all = await listTemplates();
  return all.some((record) => record.id === id);
}

export async function createTemplate(input: {
  displayName: string;
  brand: string;
  notes?: string;
}): Promise<{ record: TemplateRecord; folderPath: string }> {
  const displayName = input.displayName.trim();
  const brand = input.brand.trim();
  if (!displayName) throw new Error("Template display name is required.");
  if (!brand) throw new Error("Brand is required.");

  await ensureTemplatesRoot();
  const baseId = safeId(`${brand}-${displayName}`) || safeId(brand) || "template";
  let id = baseId;
  let suffix = 1;
  const existing = await listTemplates();
  while (existing.some((record) => record.id === id)) {
    suffix += 1;
    id = `${baseId}-${suffix}`;
  }

  const folderPath = path.join(templatesRoot, id);
  await mkdir(folderPath, { recursive: true });

  const record: TemplateRecord = {
    id,
    displayName,
    brand,
    status: "preview",
    builtIn: false,
    createdAt: new Date().toISOString(),
    notes:
      input.notes?.trim() ||
      `Template ${displayName} created from the migration wizard. Slot mapping inherits the Ford reference engine until brand-specific slot definitions ship.`,
  };

  await writeFile(
    path.join(folderPath, "config.json"),
    JSON.stringify(record, null, 2),
    "utf8",
  );

  await writeFile(
    path.join(folderPath, "README.md"),
    `# ${displayName}\n\nBrand: ${brand}\n\nThis folder holds the template definition for ${displayName}.\nDrop slot definitions, brand tokens, and reference URLs in this folder to ship a brand-specific mapping.\n`,
    "utf8",
  );

  return { record, folderPath };
}
