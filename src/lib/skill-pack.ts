import { readFile } from "node:fs/promises";
import path from "node:path";

const skillPackRoot = path.resolve(process.cwd(), "..", "ford-dealer-template-migration");

export function resolveSkillPackPath(...segments: string[]) {
  return path.join(skillPackRoot, ...segments);
}

export async function loadSkillSchema(name: "extracted-page.schema.json" | "mapped-page.schema.json") {
  const schemaPath = resolveSkillPackPath("assets", name);
  const contents = await readFile(schemaPath, "utf8");
  return JSON.parse(contents) as Record<string, unknown>;
}

export async function loadSkillReference(name: string) {
  const filePath = resolveSkillPackPath("references", name);
  return readFile(filePath, "utf8");
}
