import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { findSkillPackRoot } from "./skill-pack";

const tempRoots: string[] = [];

async function makeSkillWorkspace(layout: "repo" | "worktree") {
  const root = await mkdtemp(path.join(tmpdir(), "skill-pack-"));
  tempRoots.push(root);

  const skillsRoot = path.join(root, "skills");
  const repoRoot =
    layout === "repo"
      ? path.join(skillsRoot, "PAGESCRAPE")
      : path.join(skillsRoot, "PAGESCRAPE", ".worktrees", "dealer-page-migration-workspace");
  const skillRoot = path.join(skillsRoot, "ford-dealer-template-migration");

  await mkdir(path.join(skillRoot, "assets"), { recursive: true });
  await mkdir(repoRoot, { recursive: true });
  await writeFile(
    path.join(skillRoot, "assets", "extracted-page.schema.json"),
    JSON.stringify({ title: "Extracted page schema" }),
    "utf8",
  );

  return {
    repoRoot,
    skillRoot,
  };
}

describe("findSkillPackRoot", () => {
  afterEach(async () => {
    while (tempRoots.length > 0) {
      const root = tempRoots.pop();
      if (root) {
        await import("node:fs/promises").then(({ rm }) =>
          rm(root, { recursive: true, force: true }),
        );
      }
    }
  });

  it("finds the skill pack when running from the repo root", async () => {
    const { repoRoot, skillRoot } = await makeSkillWorkspace("repo");

    expect(findSkillPackRoot(repoRoot)).toBe(skillRoot);
  });

  it("finds the skill pack when running from a nested git worktree", async () => {
    const { repoRoot, skillRoot } = await makeSkillWorkspace("worktree");

    expect(findSkillPackRoot(repoRoot)).toBe(skillRoot);
  });
});
