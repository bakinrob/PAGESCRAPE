# Dealer Page Migration Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing Ford scraper demo into an OEM-agnostic dealer page migration workspace that ingests source pages plus a destination template-package zip, infers the destination OEM/brand from that package, pairs source pages to detected destination templates, rebuilds static pages into that package, and exports a provider-ready handoff bundle.

**Architecture:** Keep the current Next.js app/router structure and existing source-page extraction pipeline, but add a package-ingestion subsystem, a template-detection and pairing layer, and a destination rebuild engine that renders from uploaded template HTML instead of only the built-in Ford preset. The core must remain OEM-agnostic: Ford stays as the first reference package and fallback taxonomy, while destination brand/OEM identity comes from the uploaded package. Deliver this in phases so each milestone leaves the product in a working, testable state.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS v4, Cheerio, JSZip, Ajv, Playwright, built-in fetch, Node.js runtime route handlers.

---

## Scope and sequencing

This spec spans several subsystems, but they are tightly coupled in the shipped product. Implement them as five shippable milestones inside one plan:

1. workspace shell and state model
2. template-package upload and persistence
3. template detection and source-to-template pairing
4. destination rebuild rendering and export
5. polish, guardrails, and presentation verification

Each milestone must leave the app usable before moving to the next one.

## File structure map

### Existing files to modify

- Modify: `src/lib/types.ts`
  Expand the job, template-package, destination brand/OEM, pairing, and export types.
- Modify: `src/lib/job-store.ts`
  Persist package metadata, detection results, pairings, and rebuild outputs in job state.
- Modify: `src/lib/pipeline.ts`
  Keep source extraction logic focused on source pages; do not overload it with package logic.
- Modify: `src/lib/templates-store.ts`
  Evolve from built-in template registry into package-aware storage helpers.
- Modify: `src/lib/export-html.ts`
  Change export generation to emit package-driven provider handoff output.
- Modify: `src/app/api/jobs/route.ts`
  Accept the new workspace job payload and template package selection/upload references.
- Modify: `src/app/api/jobs/[jobId]/route.ts`
  Return the richer job state.
- Modify: `src/app/api/jobs/[jobId]/export/route.ts`
  Export rebuilt package-driven output and manifest data.
- Modify: `src/components/ford-scraper-app.tsx`
  Reshape the shell into orientation + workspace and drive the new lifecycle.
- Modify: `src/components/template-preview.tsx`
  Render rebuilt destination pages from package-driven data instead of only preset sections.
- Modify: `src/components/template-preview.module.css`
  Support the new package-driven preview shell and fallback display.
- Modify: `src/app/page.tsx`
  Keep page mounting aligned with the new workspace orientation flow.
- Modify: `src/app/layout.tsx`
  Update metadata if needed to match the migration-workspace framing.
- Modify: `src/app/globals.css`
  Support any new global workspace styles not appropriate for CSS modules.

### New library files

- Create: `src/lib/template-package-store.ts`
  Save uploaded zips, extracted files, manifests, and metadata under a stable job/package workspace.
- Create: `src/lib/template-package.ts`
  Extract and index zip contents, normalize paths, and parse optional manifests.
- Create: `src/lib/template-detection.ts`
  Classify uploaded HTML files into likely page types and compute confidence.
- Create: `src/lib/template-pairing.ts`
  Pair classified source pages to classified destination template files.
- Create: `src/lib/destination-rebuild.ts`
  Inject mapped source content into detected destination template structures.
- Create: `src/lib/workspace-validation.ts`
  Centralize warnings, ambiguity handling, unsupported-page guardrails, and confidence checks.

### New API routes

- Create: `src/app/api/template-packages/route.ts`
  Accept package uploads and return package metadata.
- Create: `src/app/api/template-packages/[packageId]/route.ts`
  Return package indexing and detection details for the inspector/workspace.

### New docs and fixtures

- Create: `docs/superpowers/plans/2026-04-13-dealer-page-migration-workspace.md`
  This plan file.
- Create: `docs/superpowers/specs/2026-04-13-dealer-page-migration-workspace-design.md`
  Already present; use as implementation authority.
- Create: `templates/fixtures/` (or `output/fixtures/` if `templates/` is inappropriate)
  Small package fixtures for homepage/contact/service template detection tests.

### New tests

The repo currently has no test runner. Add one before feature work.

- Create: `vitest.config.ts`
- Create: `src/lib/template-package.test.ts`
- Create: `src/lib/template-detection.test.ts`
- Create: `src/lib/template-pairing.test.ts`
- Create: `src/lib/destination-rebuild.test.ts`
- Create: `src/lib/workspace-validation.test.ts`

## Milestone 1: Workspace shell and state model

### Task 1: Add the test runner and first state-model tests

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/lib/types.test.ts`

- [ ] **Step 1: Add test scripts and Vitest dependencies**

Update `package.json` to add:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vitest": "^3.2.4"
  }
}
```

- [ ] **Step 2: Create a minimal Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 3: Write the failing state-model test**

Create `src/lib/types.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { JobState } from "@/lib/types";

describe("migration workspace job shape", () => {
  it("supports template package and pairing state", () => {
    const job = {} as JobState;
    expect(job.templatePackage).toBeDefined();
    expect(job.templateDetection).toBeDefined();
    expect(job.pairings).toBeDefined();
    expect(job.destinationBrand).toBeDefined();
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm run test -- src/lib/types.test.ts`

Expected: FAIL because `JobState` does not yet expose the new fields.

- [ ] **Step 5: Extend the workspace types minimally**

Add these interfaces to `src/lib/types.ts`:

```ts
export interface TemplatePackageFile {
  path: string;
  kind: "html" | "css" | "js" | "asset" | "other";
  size: number;
}

export interface TemplatePackageState {
  id: string;
  filename: string;
  uploadedAt: string;
  manifestPath?: string;
  files: TemplatePackageFile[];
  inferredBrand?: string;
  inferredOem?: string;
}

export interface TemplateTemplateMatch {
  pageId: string;
  sourcePageType: SupportedPageType;
  templatePath: string;
  confidence: number;
  reasons: string[];
  alternatives: string[];
}
```

Add to `JobState`:

```ts
templatePackage?: TemplatePackageState;
templateDetection?: {
  status: "idle" | "processing" | "ready" | "error";
  warnings: string[];
};
destinationBrand?: {
  brand?: string;
  oem?: string;
  source: "manifest" | "heuristic" | "fallback";
  confidence: number;
};
pairings: TemplateTemplateMatch[];
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm run test -- src/lib/types.test.ts`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/types.ts src/lib/types.test.ts
git commit -m "test: add workspace type coverage"
```

### Task 2: Reshape the app shell for orientation + workspace

**Files:**
- Modify: `src/components/ford-scraper-app.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Write the failing UI state test**

If component tests are too heavy for the current repo, write a narrow logic-level test in `src/lib/workspace-view-state.test.ts` for the orientation/workspace mode reducer:

```ts
import { describe, expect, it } from "vitest";
import { deriveWorkspaceStage } from "@/lib/workspace-view-state";

describe("workspace stage", () => {
  it("shows orientation when no job is loaded", () => {
    expect(deriveWorkspaceStage(null)).toBe("orientation");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/workspace-view-state.test.ts`

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Create a focused workspace view-state helper**

Create `src/lib/workspace-view-state.ts`:

```ts
import type { JobState } from "@/lib/types";

export function deriveWorkspaceStage(job: JobState | null) {
  if (!job) return "orientation";
  if (job.status === "queued" || job.status === "scraping") return "processing";
  return "workspace";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/lib/workspace-view-state.test.ts`

Expected: PASS

- [ ] **Step 5: Refactor the app shell to use the helper**

In `src/components/ford-scraper-app.tsx`:

- keep the current polished shell
- rename intake copy from Ford-only framing to migration-workspace framing
- add a destination package upload panel placeholder in the orientation screen
- make the top bar show package metadata when present
- make the top bar show detected destination brand/OEM when present
- keep compare fullscreen and inspector behavior working during the shell refactor

- [ ] **Step 6: Run quality checks**

Run:

- `npm run lint`
- `npx tsc --noEmit`
- `npm run test -- src/lib/workspace-view-state.test.ts src/lib/types.test.ts`

Expected: all PASS

- [ ] **Step 7: Commit**

```bash
git add src/components/ford-scraper-app.tsx src/app/page.tsx src/app/globals.css src/lib/workspace-view-state.ts src/lib/workspace-view-state.test.ts
git commit -m "feat: reshape app into migration workspace shell"
```

## Milestone 2: Template-package upload and persistence

### Task 3: Add zip extraction and package storage

**Files:**
- Create: `src/lib/template-package.ts`
- Create: `src/lib/template-package-store.ts`
- Create: `src/lib/template-package.test.ts`

- [ ] **Step 1: Write the failing extraction test**

Create `src/lib/template-package.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { indexTemplatePackage } from "@/lib/template-package";

describe("template package indexing", () => {
  it("classifies html, css, js, and asset files from a zip", async () => {
    const result = await indexTemplatePackage(Buffer.alloc(0), "dealer-template.zip");
    expect(result.files.some((file) => file.kind === "html")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/template-package.test.ts`

Expected: FAIL because `indexTemplatePackage` does not exist.

- [ ] **Step 3: Implement zip indexing**

In `src/lib/template-package.ts`, create:

```ts
import JSZip from "jszip";

export async function indexTemplatePackage(buffer: Buffer, filename: string) {
  const zip = await JSZip.loadAsync(buffer);
  const files = await Promise.all(
    Object.values(zip.files)
      .filter((entry) => !entry.dir)
      .map(async (entry) => ({
        path: entry.name,
        kind: classifyPackagePath(entry.name),
        size: (await entry.async("uint8array")).byteLength,
      })),
  );

  return {
    id: crypto.randomUUID(),
    filename,
    uploadedAt: new Date().toISOString(),
    manifestPath: files.find((file) => file.path.endsWith("manifest.json"))?.path,
    files,
  };
}
```

Add a small `classifyPackagePath` helper in the same file.

- [ ] **Step 4: Persist package files to a workspace folder**

In `src/lib/template-package-store.ts`, add:

```ts
export async function saveTemplatePackage(input: {
  packageId: string;
  filename: string;
  buffer: Buffer;
}) {
  // write original zip and extracted files under output/template-packages/<packageId>/
}
```

Use `output/template-packages/<packageId>/` so temp uploads are local and inspectable.

- [ ] **Step 5: Update the test to use a tiny in-memory zip fixture**

Replace `Buffer.alloc(0)` with a JSZip-built fixture inside the test so the classification is meaningful.

- [ ] **Step 6: Run tests**

Run: `npm run test -- src/lib/template-package.test.ts`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/template-package.ts src/lib/template-package-store.ts src/lib/template-package.test.ts
git commit -m "feat: add template package indexing and storage"
```

### Task 4: Add upload API and job integration

**Files:**
- Create: `src/app/api/template-packages/route.ts`
- Create: `src/app/api/template-packages/[packageId]/route.ts`
- Modify: `src/lib/job-store.ts`
- Modify: `src/app/api/jobs/route.ts`
- Test: `src/app/api/template-packages/route.test.ts`

- [ ] **Step 1: Write the failing route test**

Create `src/app/api/template-packages/route.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/template-packages/route";

describe("template package upload route", () => {
  it("returns package metadata for a zip upload", async () => {
    const request = new Request("http://localhost/api/template-packages", { method: "POST" });
    const response = await POST(request);
    expect(response.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/app/api/template-packages/route.test.ts`

Expected: FAIL because the route does not exist.

- [ ] **Step 3: Implement the upload route**

In `src/app/api/template-packages/route.ts`:

- accept `multipart/form-data`
- require a `.zip` file
- call `indexTemplatePackage`
- call `saveTemplatePackage`
- return the package metadata and initial detection status

- [ ] **Step 4: Implement the package details route**

In `src/app/api/template-packages/[packageId]/route.ts`:

- read stored metadata for the package
- return files, manifest path, detected brand/OEM, and detection status

- [ ] **Step 5: Extend `createJob` payload handling**

In `src/app/api/jobs/route.ts` and `src/lib/job-store.ts`:

- allow `templatePackageId`
- require either a built-in preset or uploaded package reference
- store `templatePackage` metadata and detected destination brand/OEM on the job

- [ ] **Step 6: Run verification**

Run:

- `npm run lint`
- `npx tsc --noEmit`
- `npm run test -- src/app/api/template-packages/route.test.ts src/lib/template-package.test.ts`

Expected: all PASS

- [ ] **Step 7: Commit**

```bash
git add src/app/api/template-packages/route.ts src/app/api/template-packages/[packageId]/route.ts src/lib/job-store.ts src/app/api/jobs/route.ts src/app/api/template-packages/route.test.ts
git commit -m "feat: add template package upload flow"
```

## Milestone 3: Template detection and source-to-template pairing

### Task 5: Detect destination template page types

**Files:**
- Create: `src/lib/template-detection.ts`
- Create: `src/lib/template-detection.test.ts`
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Write the failing detection test**

Create `src/lib/template-detection.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { classifyTemplateFile } from "@/lib/template-detection";

describe("template detection", () => {
  it("detects a service template from filename and headings", () => {
    const result = classifyTemplateFile({
      path: "service.html",
      html: "<html><head><title>Service Center</title></head><body><h1>Honda Service</h1></body></html>",
    });
    expect(result.pageType).toBe("service");
    expect(result.confidence).toBeGreaterThan(0.6);
    expect(result.brand?.oem).toBe("Honda");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/template-detection.test.ts`

Expected: FAIL because the detector does not exist.

- [ ] **Step 3: Implement the detector**

In `src/lib/template-detection.ts`:

- parse HTML with Cheerio
- score page types from:
  - filename
  - `<title>`
  - `h1`
  - top nav labels
  - hero copy
- infer destination brand/OEM from manifest values, title text, heading text, logo alt text, and asset path segments
- return:

```ts
{
  pageType: SupportedPageType | null;
  confidence: number;
  reasons: string[];
  brand?: { brand?: string; oem?: string; source: "manifest" | "heuristic" };
  alternatives: Array<{ pageType: SupportedPageType; confidence: number }>;
}
```

- [ ] **Step 4: Add package-wide detection helper**

In the same file, add:

```ts
export async function detectTemplateFiles(packageId: string) {
  // read extracted html files from storage and classify each one
}
```

- [ ] **Step 5: Run tests**

Run: `npm run test -- src/lib/template-detection.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/template-detection.ts src/lib/template-detection.test.ts src/lib/types.ts
git commit -m "feat: detect destination template page types"
```

### Task 6: Pair source pages to detected destination templates

**Files:**
- Create: `src/lib/template-pairing.ts`
- Create: `src/lib/template-pairing.test.ts`
- Modify: `src/lib/job-store.ts`

- [ ] **Step 1: Write the failing pairing test**

Create `src/lib/template-pairing.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { pairSourcePagesToTemplates } from "@/lib/template-pairing";

describe("template pairing", () => {
  it("prefers exact page-type matches", () => {
    const result = pairSourcePagesToTemplates(
      [{ id: "1", pageType: "service" }],
      [
        { path: "home.html", pageType: "homepage", confidence: 0.9 },
        { path: "service.html", pageType: "service", confidence: 0.82 },
      ],
    );
    expect(result[0].templatePath).toBe("service.html");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/template-pairing.test.ts`

Expected: FAIL because the pairing module does not exist.

- [ ] **Step 3: Implement exact-match-first pairing**

In `src/lib/template-pairing.ts`:

```ts
export function pairSourcePagesToTemplates(sourcePages, templateFiles) {
  // exact type match first
  // nearest confidence-based fallback second
  // attach reasons and alternatives
}
```

Do not overbuild conflict resolution yet. Keep it deterministic and readable.

- [ ] **Step 4: Update job execution to compute pairings**

In `src/lib/job-store.ts`:

- after source extraction completes and after package detection is ready
- generate job-level `pairings`
- carry the detected destination brand/OEM into the job summary
- store ambiguity warnings in the job and page records

- [ ] **Step 5: Run tests**

Run:

- `npm run test -- src/lib/template-pairing.test.ts src/lib/template-detection.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/template-pairing.ts src/lib/template-pairing.test.ts src/lib/job-store.ts
git commit -m "feat: pair source pages to destination templates"
```

## Milestone 4: Destination rebuild rendering and export

### Task 7: Build the destination rebuild engine

**Files:**
- Create: `src/lib/destination-rebuild.ts`
- Create: `src/lib/destination-rebuild.test.ts`
- Modify: `src/lib/job-store.ts`

- [ ] **Step 1: Write the failing rebuild test**

Create `src/lib/destination-rebuild.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { rebuildIntoTemplateHtml } from "@/lib/destination-rebuild";

describe("destination rebuild", () => {
  it("injects source heading and contact CTA into destination html", () => {
    const html = rebuildIntoTemplateHtml({
      templateHtml: "<html><body><main><section class='hero'><h1>Template</h1><a href='#'>Call</a></section></main></body></html>",
      mappedPage: {
        seo: { h1: "Vehicle Service" },
        sections: [],
      } as never,
    });

    expect(html).toContain("Vehicle Service");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/destination-rebuild.test.ts`

Expected: FAIL because the rebuild module does not exist.

- [ ] **Step 3: Implement structure-aware injection**

In `src/lib/destination-rebuild.ts`:

- parse destination HTML with Cheerio
- locate likely hero, CTA, content, and contact regions
- inject:
  - `mappedPage.seo.h1`
  - metadata fields
  - mapped CTA links
  - mapped content sections
  - contact and hours content where applicable

Add a small helper interface:

```ts
export interface DestinationRebuildInput {
  templateHtml: string;
  mappedPage: MappedPagePayload;
  pairing: TemplateTemplateMatch;
}
```

- [ ] **Step 4: Attach rebuild output to job pages**

Extend `PageResult` in `src/lib/types.ts` and usage in `src/lib/job-store.ts`:

```ts
rebuilt?: {
  templatePath: string;
  html: string;
  confidence: number;
}
```

- [ ] **Step 5: Run tests**

Run: `npm run test -- src/lib/destination-rebuild.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/destination-rebuild.ts src/lib/destination-rebuild.test.ts src/lib/job-store.ts src/lib/types.ts
git commit -m "feat: rebuild mapped pages into destination html"
```

### Task 8: Make the preview render package-driven rebuilds

**Files:**
- Modify: `src/components/template-preview.tsx`
- Modify: `src/components/template-preview.module.css`
- Modify: `src/components/ford-scraper-app.tsx`

- [ ] **Step 1: Write the failing view-state test**

Add to `src/lib/workspace-view-state.test.ts`:

```ts
it("prefers package-driven rebuilt html when present", () => {
  const result = choosePreviewMode({
    rebuiltHtml: "<html></html>",
    mappedPage: {} as never,
  });
  expect(result).toBe("package");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/workspace-view-state.test.ts`

Expected: FAIL because `choosePreviewMode` does not exist.

- [ ] **Step 3: Add a preview-mode helper**

In `src/lib/workspace-view-state.ts`:

```ts
export function choosePreviewMode(input: { rebuiltHtml?: string; mappedPage?: unknown }) {
  if (input.rebuiltHtml) return "package";
  if (input.mappedPage) return "mapped";
  return "empty";
}
```

- [ ] **Step 4: Update the rebuilt pane**

In `src/components/template-preview.tsx`:

- if `rebuilt.html` exists, render it in a stable preview frame using `iframe srcDoc`
- if not, fall back to the existing mapped/preset preview
- keep the current polished fallback styles so the workspace stays usable mid-migration
- ensure rebuilt-pane labels use the detected destination brand/OEM when a package is present

In `src/components/ford-scraper-app.tsx`:

- surface the paired destination template path in the header and inspector
- surface the detected destination brand/OEM in the orientation and workspace header
- show template confidence and ambiguity warnings

- [ ] **Step 5: Run checks**

Run:

- `npm run lint`
- `npx tsc --noEmit`
- `npm run test -- src/lib/workspace-view-state.test.ts`

Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/template-preview.tsx src/components/template-preview.module.css src/components/ford-scraper-app.tsx src/lib/workspace-view-state.ts src/lib/workspace-view-state.test.ts
git commit -m "feat: preview package-driven rebuild output"
```

### Task 9: Export provider-ready handoff bundles

**Files:**
- Modify: `src/lib/export-html.ts`
- Modify: `src/app/api/jobs/[jobId]/export/route.ts`
- Test: `src/lib/export-html.test.ts`

- [ ] **Step 1: Write the failing export test**

Create `src/lib/export-html.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildExportBundle } from "@/lib/export-html";

describe("provider handoff export", () => {
  it("includes rebuilt html pages and a mapping manifest", async () => {
    const zip = await buildExportBundle({
      manifest: { jobId: "job-1" },
      pages: [{ path: "service.html", html: "<html></html>" }],
    } as never);

    expect(zip).toBeInstanceOf(Uint8Array);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/export-html.test.ts`

Expected: FAIL if the export builder cannot emit package-driven bundles yet.

- [ ] **Step 3: Refactor export generation**

In `src/lib/export-html.ts`:

- emit rebuilt HTML files using the original destination template filenames where possible
- include:
  - `manifest.json`
  - `pairings.json`
  - `warnings.json`
  - copied asset references or asset manifest
- keep JSON export as a secondary route format

- [ ] **Step 4: Update the export route**

In `src/app/api/jobs/[jobId]/export/route.ts`:

- default to package-driven HTML bundle export
- keep `?format=json`
- return descriptive filenames such as:

```ts
`${slug}-migration-handoff.zip`
```

- [ ] **Step 5: Run tests and type checks**

Run:

- `npm run test -- src/lib/export-html.test.ts`
- `npm run lint`
- `npx tsc --noEmit`

Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/export-html.ts src/app/api/jobs/[jobId]/export/route.ts src/lib/export-html.test.ts
git commit -m "feat: export provider handoff bundles"
```

## Milestone 5: Guardrails, inspector details, and presentation polish

### Task 10: Add ambiguity and unsupported-page validation

**Files:**
- Create: `src/lib/workspace-validation.ts`
- Create: `src/lib/workspace-validation.test.ts`
- Modify: `src/lib/job-store.ts`

- [ ] **Step 1: Write the failing validation test**

Create `src/lib/workspace-validation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { validatePairing } from "@/lib/workspace-validation";

describe("workspace validation", () => {
  it("warns when confidence is below threshold", () => {
    const result = validatePairing({ confidence: 0.42 } as never);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/workspace-validation.test.ts`

Expected: FAIL because the validator does not exist.

- [ ] **Step 3: Implement validation helpers**

In `src/lib/workspace-validation.ts`:

- add `validatePairing`
- add `isOutOfScopePage`
- add `buildNeedsReviewWarnings`

Keep the thresholds simple and explicit.

- [ ] **Step 4: Wire validation into job execution**

In `src/lib/job-store.ts`:

- attach page warnings from validation helpers
- set `Needs review` style status labels for ambiguous pairings
- keep unsupported pages excluded

- [ ] **Step 5: Run tests**

Run: `npm run test -- src/lib/workspace-validation.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/workspace-validation.ts src/lib/workspace-validation.test.ts src/lib/job-store.ts
git commit -m "feat: add migration guardrails and review warnings"
```

### Task 11: Finish the inspector and package-aware workspace details

**Files:**
- Modify: `src/components/ford-scraper-app.tsx`
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Add a narrow regression test for inspector data shaping**

If the repo still lacks UI test infra, add a pure helper in `src/lib/inspector-model.ts` and test that instead.

Create `src/lib/inspector-model.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildInspectorModel } from "@/lib/inspector-model";

describe("inspector model", () => {
  it("includes template match, seo, assets, and warnings", () => {
    const model = buildInspectorModel({} as never);
    expect(model.sections.map((section) => section.key)).toEqual(
      expect.arrayContaining(["template-match", "assets", "seo", "source-signals", "warnings"]),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/inspector-model.test.ts`

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement the inspector model helper**

Create `src/lib/inspector-model.ts`:

```ts
export function buildInspectorModel(page: PageResult) {
  return {
    sections: [
      { key: "template-match", title: "Template Match" },
      { key: "assets", title: "Assets" },
      { key: "seo", title: "SEO" },
      { key: "source-signals", title: "Source Signals" },
      { key: "warnings", title: "Warnings" },
    ],
  };
}
```

- [ ] **Step 4: Refactor the inspector rendering to use the helper**

In `src/components/ford-scraper-app.tsx`:

- move repeated inspector derivation into the helper
- show:
  - template path
  - match confidence
  - reasons
  - alternatives when confidence is low
  - SEO fields
  - warnings

- [ ] **Step 5: Run checks**

Run:

- `npm run test -- src/lib/inspector-model.test.ts`
- `npm run lint`
- `npx tsc --noEmit`

Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/inspector-model.ts src/lib/inspector-model.test.ts src/components/ford-scraper-app.tsx src/lib/types.ts
git commit -m "feat: finish package-aware inspector details"
```

### Task 12: End-to-end presentation verification

**Files:**
- Modify only if verification uncovers issues in:
  - `src/components/ford-scraper-app.tsx`
  - `src/components/template-preview.tsx`
  - `src/lib/export-html.ts`
  - `src/lib/job-store.ts`

- [ ] **Step 1: Build a repeatable demo fixture**

Prepare one:

- source homepage URL fixture
- one inner-page URL fixture
- one small destination template zip fixture

Store them under `output/fixtures/` or a dedicated local fixture folder.

- [ ] **Step 2: Run full automated verification**

Run:

- `npm run test`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`

Expected: all PASS

- [ ] **Step 3: Run browser verification**

Use `@playwright` or `vercel:agent-browser-verify` style verification flow locally:

- start `next dev`
- open orientation screen
- upload template package
- start a job
- verify:
  - source page appears
  - rebuilt page appears
  - inspector opens
  - compare fullscreen is stable
  - export route returns `200`

- [ ] **Step 4: Fix any discovered regression**

Apply the smallest targeted fixes only where the verification exposed a real issue.

- [ ] **Step 5: Re-run the full verification set**

Run:

- `npm run test`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`

Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "chore: verify migration workspace for presentation"
```

## Notes for the implementing agent

- Do not delete the current Ford preset pipeline until package-driven rebuilds are working. Keep it as a fallback preview path and normalized taxonomy reference during the transition.
- Avoid turning package ingestion into a generic CMS or template authoring platform.
- Do not expand into inventory, SRP, or VDP support in this plan.
- The core engine must not assume Ford output. Uploaded package identity should drive destination OEM/brand behavior.
- Keep heuristics readable and deterministic before adding any AI-assisted detection layer.
- Prefer adding small focused helpers over growing `ford-scraper-app.tsx` or `job-store.ts` further without boundaries.

## Suggested verification order while implementing

1. unit tests for each new library
2. lint and typecheck after every milestone
3. build after milestones 2, 4, and 5
4. browser verification only after the workspace path is functional

## Execution handoff

Use one of these execution modes after plan approval:

1. `superpowers:subagent-driven-development` `(recommended)`
   Fresh worker per task, review between tasks.

2. `superpowers:executing-plans`
   Inline execution in this session with checkpoints.
