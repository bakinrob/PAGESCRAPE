import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

const SKILL_PACK_DIRNAME = "ford-dealer-template-migration";
const REQUIRED_SKILL_PACK_FILE = path.join(
  SKILL_PACK_DIRNAME,
  "assets",
  "extracted-page.schema.json",
);

export function findSkillPackRoot(startDir = process.cwd()) {
  let current = path.resolve(startDir);

  while (true) {
    const candidate = path.join(current, SKILL_PACK_DIRNAME);
    if (existsSync(path.join(candidate, "assets", "extracted-page.schema.json"))) {
      return candidate;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  throw new Error(
    `Unable to locate ${REQUIRED_SKILL_PACK_FILE} from "${startDir}".`,
  );
}

export function resolveSkillPackPath(...segments: string[]) {
  return path.join(findSkillPackRoot(), ...segments);
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
