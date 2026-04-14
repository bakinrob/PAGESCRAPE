import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import { discoverPagesFromHomepage, processUrl } from "@/lib/pipeline";
import { rebuildDestinationHtml } from "@/lib/destination-rebuild";
import { detectTemplateFiles } from "@/lib/template-detection";
import { classifyPackagePath } from "@/lib/template-package";
import { pairSourcePagesToTemplates } from "@/lib/template-pairing";
import { buildNeedsReviewWarnings, validatePairing } from "@/lib/workspace-validation";
import type {
  ExportBundle,
  JobInput,
  JobState,
  PageResult,
  RebuiltPagePayload,
  SupportedPageType,
  TemplatePackageFile,
  TemplatePackageState,
} from "@/lib/types";

const globalForJobs = globalThis as typeof globalThis & {
  fordScraperJobs?: Map<string, JobState>;
};

const jobStore = globalForJobs.fordScraperJobs ?? new Map<string, JobState>();
globalForJobs.fordScraperJobs = jobStore;
const templatePackagesRoot = path.join(process.cwd(), "output", "template-packages");

function nowIso() {
  return new Date().toISOString();
}

function createInitialPages(urls: string[]): PageResult[] {
  return urls.map((url, index) => ({
    id: `${index + 1}-${Buffer.from(url).toString("base64url").slice(0, 10)}`,
    url,
    stage: "queued",
    statusLabel: "Queued",
  }));
}

function safePackageId(packageId: string) {
  const base = path.basename(packageId).replace(/[<>:"/\\|?*\x00-\x1f]+/g, "-").trim();
  return base || "template-package";
}

function uniqueStrings(values: string[]) {
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index);
}

async function listExtractedFiles(extractedRoot: string, prefix = ""): Promise<TemplatePackageFile[]> {
  let entries;
  try {
    entries = await readdir(extractedRoot, { withFileTypes: true });
  } catch {
    return [];
  }

  const files: TemplatePackageFile[] = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const relativePath = prefix ? path.posix.join(prefix, entry.name) : entry.name;
    const absolutePath = path.join(extractedRoot, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listExtractedFiles(absolutePath, relativePath)));
      continue;
    }

    const stats = await stat(absolutePath);
    files.push({
      path: relativePath.replace(/\\/g, "/"),
      kind: classifyPackagePath(relativePath),
      size: stats.size,
    });
  }

  return files;
}

export async function readStoredTemplatePackage(packageId: string) {
  const safeId = safePackageId(packageId);
  const packageRoot = path.join(templatePackagesRoot, safeId);
  const extractedRoot = path.join(packageRoot, "extracted");
  const metadataPath = path.join(packageRoot, "metadata.json");

  try {
    const raw = await readFile(metadataPath, "utf8");
    const templatePackage = JSON.parse(raw) as TemplatePackageState;
    const files = await listExtractedFiles(extractedRoot);
    const archiveFilename = (await readdir(packageRoot, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".zip"))
      .sort((left, right) => left.name.localeCompare(right.name))[0]?.name;

    return {
      templatePackage,
      packageId: safeId,
      packageRoot,
      extractedRoot,
      archiveFilename,
      files,
    };
  } catch {
    return undefined;
  }
}

function buildPairingSources(job: JobState) {
  return job.pages.flatMap((page) => {
    const classification = page.extracted?.classification;
    if (!classification?.supported) {
      return [];
    }

    return [
      {
        pageId: page.id,
        pageType: classification.page_type as SupportedPageType,
        confidence: classification.confidence,
        reasons: uniqueStrings([
          ...classification.matched_signals,
          ...classification.ambiguity_notes,
          ...(page.extracted?.validation.warnings ?? []),
        ]),
      },
    ];
  });
}

function buildPairingWarnings(
  pairings: JobState["pairings"],
  destinationBrand: JobState["destinationBrand"],
) {
  return uniqueStrings([
    ...(destinationBrand?.source === "heuristic" && destinationBrand.brand
      ? [`Destination brand inferred heuristically as ${destinationBrand.brand}.`]
      : []),
    ...pairings.flatMap((pairing) =>
      pairing.reasons.some((reason) => reason.includes("nearest confidence fallback"))
        ? [`Fallback pairing used for ${pairing.pageId} -> ${pairing.templatePath}.`]
        : pairing.confidence < 0.7
          ? [`Low-confidence pairing for ${pairing.pageId} -> ${pairing.templatePath}.`]
          : [],
    ),
  ]);
}

async function buildRebuiltPages(job: JobState, pairings: JobState["pairings"]) {
  if (!job.templatePackage) {
    return { rebuilds: [], warnings: [] as string[] };
  }

  const storedPackage = await readStoredTemplatePackage(job.templatePackage.id);
  if (!storedPackage) {
    return {
      rebuilds: [],
      warnings: [`Template package "${job.templatePackage.id}" is no longer available on disk.`],
    };
  }

  const rebuilds: Array<{ pageId: string; rebuilt: RebuiltPagePayload }> = [];
  const warnings: string[] = [];

  for (const pairing of pairings) {
    const page = job.pages.find((candidate) => candidate.id === pairing.pageId);
    const mappedPage = page?.mapped;
    if (!mappedPage) {
      warnings.push(`Skipping rebuild for ${pairing.pageId} because mapped output is unavailable.`);
      continue;
    }

    const templateHtmlPath = path.join(storedPackage.extractedRoot, pairing.templatePath);

    try {
      const templateHtml = await readFile(templateHtmlPath, "utf8");
      rebuilds.push({
        pageId: pairing.pageId,
        rebuilt: rebuildDestinationHtml({
          templateHtml,
          templatePath: pairing.templatePath,
          confidence: pairing.confidence,
          mappedPage,
        }),
      });
    } catch {
      warnings.push(`Skipping rebuild for ${pairing.pageId} because ${pairing.templatePath} was not readable.`);
    }
  }

  return { rebuilds, warnings };
}

type CreateJobInput = JobInput & {
  templatePackageId?: string;
  templatePackage?: TemplatePackageState;
  templateDetection?: JobState["templateDetection"];
  destinationBrand?: JobState["destinationBrand"];
};

export function createJob(input: CreateJobInput) {
  const id = crypto.randomUUID();
  const createdAt = nowIso();
  const templatePackage = input.templatePackage;

  const job: JobState = {
    id,
    status: "queued",
    createdAt,
    updatedAt: createdAt,
    input: {
      ...input,
      templatePackageId: input.templatePackageId,
    },
    progress: {
      completed: 0,
      total: 0,
    },
    pages: [],
    templatePackage,
    templateDetection:
      input.templateDetection ??
      (templatePackage
        ? {
            status: "ready",
            warnings: templatePackage.warnings ?? [],
          }
        : undefined),
    destinationBrand:
      input.destinationBrand ??
      (templatePackage && (templatePackage.inferredBrand || templatePackage.inferredOem)
        ? {
            brand: templatePackage.inferredBrand,
            oem: templatePackage.inferredOem,
            source: "manifest",
            confidence: 1,
          }
        : undefined),
    pairings: [],
    warnings: [],
  };

  jobStore.set(id, job);
  return job;
}

export function getJob(jobId: string) {
  return jobStore.get(jobId);
}

function patchJob(jobId: string, updater: (job: JobState) => JobState) {
  const existing = jobStore.get(jobId);
  if (!existing) {
    return;
  }

  const updated = updater(existing);
  updated.updatedAt = nowIso();
  jobStore.set(jobId, updated);
}

export function startJob(jobId: string) {
  const job = jobStore.get(jobId);
  if (!job || job.status !== "queued") {
    return;
  }

  void runJob(jobId);
}

async function runJob(jobId: string) {
  try {
    patchJob(jobId, (job) => ({ ...job, status: "scraping" }));

    const job = jobStore.get(jobId);
    if (!job) {
      return;
    }

    if (job.input.inputMode === "homepage") {
      patchJob(jobId, (snapshot) => ({
        ...snapshot,
        warnings: [...snapshot.warnings, "Discovering core static CMS pages from homepage navigation."],
      }));

      const discovery = await discoverPagesFromHomepage(job.input.homepageUrl);

      patchJob(jobId, (snapshot) => ({
        ...snapshot,
        input: {
          ...snapshot.input,
          homepageUrl: discovery.homepageUrl,
          discoveredUrls: discovery.discoveredUrls,
        },
        pages: createInitialPages(discovery.discoveredUrls),
        progress: {
          completed: 0,
          total: discovery.discoveredUrls.length,
        },
        warnings: [
          ...snapshot.warnings,
          ...discovery.warnings.filter((warning, index, list) => list.indexOf(warning) === index),
        ],
      }));
    } else {
      const manualUrls = Array.from(new Set(job.input.manualUrls));
      patchJob(jobId, (snapshot) => ({
        ...snapshot,
        input: {
          ...snapshot.input,
          discoveredUrls: manualUrls,
        },
        pages: createInitialPages(manualUrls),
        progress: {
          completed: 0,
          total: manualUrls.length,
        },
        warnings: [
          ...snapshot.warnings,
          "Processing exact static page URLs provided by the operator.",
        ],
      }));
    }

    const discoveredJob = jobStore.get(jobId);
    if (!discoveredJob) {
      return;
    }

    for (let index = 0; index < discoveredJob.pages.length; index += 1) {
      const currentUrl = discoveredJob.input.discoveredUrls[index];

      patchJob(jobId, (snapshot) => {
        const pages = [...snapshot.pages];
        pages[index] = {
          ...pages[index],
          stage: "discovering",
          statusLabel:
            snapshot.input.inputMode === "homepage"
              ? index === 0
                ? "Homepage discovered"
                : "Navigation page discovered"
              : "Selected page queued for rebuild",
        };
        return { ...snapshot, pages };
      });

      patchJob(jobId, (snapshot) => {
        const pages = [...snapshot.pages];
        pages[index] = {
          ...pages[index],
          stage: "fetching",
          statusLabel: "Fetching source",
        };
        return { ...snapshot, pages };
      });

      const result = await processUrl({
        dealerName: discoveredJob.input.dealerName || "Dealer",
        url: currentUrl,
        seoLock: discoveredJob.input.seoLock,
        oemPreset: discoveredJob.input.oemPreset,
        updateStage: (stage, label) => {
          patchJob(jobId, (snapshot) => {
            const pages = [...snapshot.pages];
            pages[index] = {
              ...pages[index],
              stage,
              statusLabel: label,
            };
            return { ...snapshot, pages };
          });
        },
      });

      patchJob(jobId, (snapshot) => {
        const pages = [...snapshot.pages];
        pages[index] = result;
        const completed = pages.filter((page) =>
          ["complete", "unsupported", "error"].includes(page.stage),
        ).length;
        const warnings = [
          ...snapshot.warnings,
          ...pages.flatMap((page) => page.extracted?.validation.warnings ?? []),
        ].filter((warning, warningIndex, list) => list.indexOf(warning) === warningIndex);

        return {
          ...snapshot,
          pages,
          progress: {
            completed,
            total: snapshot.progress.total,
          },
          warnings,
        };
      });
    }

    const pairedJob = jobStore.get(jobId);
    if (!pairedJob) {
      return;
    }

    if (pairedJob.templatePackage) {
      try {
        const detected = await detectTemplateFiles(pairedJob.templatePackage.id);
        const sourcePages = buildPairingSources(pairedJob);
        const pairings = pairSourcePagesToTemplates(sourcePages, detected.files);
        const destinationBrand = detected.brand ?? pairedJob.destinationBrand;
        const pairingWarnings = buildPairingWarnings(pairings, destinationBrand);
        const { rebuilds, warnings: rebuildWarnings } = await buildRebuiltPages(
          { ...pairedJob, destinationBrand },
          pairings,
        );

        patchJob(jobId, (snapshot) => ({
          ...snapshot,
          destinationBrand,
          pairings,
          pages: snapshot.pages.map((page) => {
            const pairing = pairings.find((candidate) => candidate.pageId === page.id);
            const rebuilt = rebuilds.find((entry) => entry.pageId === page.id)?.rebuilt;
            if (!pairing) {
              return rebuilt ? { ...page, rebuilt } : page;
            }

            const reviewWarnings = buildNeedsReviewWarnings({ page, pairing });
            const pairingValidation = validatePairing(pairing);
            const extracted =
              page.extracted && reviewWarnings.length > 0
                ? {
                    ...page.extracted,
                    validation: {
                      ...page.extracted.validation,
                      warnings: uniqueStrings([...page.extracted.validation.warnings, ...reviewWarnings]),
                    },
                  }
                : page.extracted;

            return {
              ...page,
              extracted,
              rebuilt: rebuilt ?? page.rebuilt,
              statusLabel:
                page.stage === "complete" && pairingValidation.needsReview
                  ? "Needs review"
                  : page.statusLabel,
            };
          }),
          warnings: uniqueStrings([...snapshot.warnings, ...pairingWarnings, ...rebuildWarnings]),
        }));
      } catch (error) {
        patchJob(jobId, (snapshot) => ({
          ...snapshot,
          warnings: uniqueStrings([
            ...snapshot.warnings,
            `Template pairing unavailable: ${error instanceof Error ? error.message : "Unknown pairing error"}.`,
          ]),
        }));
      }
    }

    patchJob(jobId, (snapshot) => ({
      ...snapshot,
      status: snapshot.pages.some((page) => page.stage === "error") ? "error" : "complete",
      error: snapshot.pages.find((page) => page.stage === "error")?.error,
    }));
  } catch (error) {
    patchJob(jobId, (snapshot) => ({
      ...snapshot,
      status: "error",
      error: error instanceof Error ? error.message : "Unknown job error",
      warnings: [
        ...snapshot.warnings,
        error instanceof Error ? error.message : "Unknown job error",
      ].filter((warning, warningIndex, list) => list.indexOf(warning) === warningIndex),
    }));
  }
}

export function getExportBundle(jobId: string): ExportBundle | undefined {
  const job = jobStore.get(jobId);
  if (!job) {
    return undefined;
  }

  const extractedPages = job.pages
    .map((page) => page.extracted)
    .filter((page): page is NonNullable<PageResult["extracted"]> => Boolean(page));

  const mappedPages = job.pages
    .map((page) => page.mapped)
    .filter((page): page is NonNullable<PageResult["mapped"]> => Boolean(page));

  const unsupportedPages = job.pages.filter((page) => page.stage === "unsupported").length;

  return {
      manifest: {
      jobId: job.id,
      dealerName: job.input.dealerName || "Ford Dealer",
      inputMode: job.input.inputMode,
      homepageUrl: job.input.homepageUrl,
      manualUrls: job.input.manualUrls,
      oemPreset: job.input.oemPreset,
      seoLock: job.input.seoLock,
      scrapedAt: job.updatedAt,
      totalUrls: job.input.discoveredUrls.length,
      completedPages: mappedPages.length,
      unsupportedPages,
      discoveredUrls: job.input.discoveredUrls,
      warnings: job.warnings,
    },
    extractedPages,
    mappedPages,
  };
}
