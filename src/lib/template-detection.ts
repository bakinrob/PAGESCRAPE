import { readFile } from "node:fs/promises";
import path from "node:path";

import { load } from "cheerio";

import { readStoredTemplatePackage } from "@/lib/job-store";
import type { SupportedPageType } from "@/lib/types";

export interface TemplateBrandInference {
  brand?: string;
  oem?: string;
  source: "manifest" | "heuristic" | "fallback";
  confidence: number;
  reasons: string[];
}

export interface TemplatePageAlternative {
  pageType: SupportedPageType;
  confidence: number;
}

export interface TemplateFileDetection {
  path: string;
  pageType: SupportedPageType | null;
  confidence: number;
  reasons: string[];
  brand?: TemplateBrandInference;
  alternatives: TemplatePageAlternative[];
}

export interface TemplatePackageDetection {
  packageId: string;
  brand?: TemplateBrandInference;
  files: TemplateFileDetection[];
}

export interface TemplateFileInput {
  path: string;
  html: string;
  manifest?: {
    brand?: string;
    oem?: string;
  };
}

const PAGE_TYPE_RULES: Record<SupportedPageType, string[]> = {
  homepage: ["home", "homepage", "index", "welcome"],
  about: ["about", "about us", "our story", "history", "who we are"],
  staff: ["staff", "team", "our team", "meet the team", "people"],
  contact: ["contact", "contact us", "get in touch", "visit us", "directions", "location"],
  hours: ["hours", "store hours", "opening hours", "business hours"],
  service: ["service", "service center", "service centre", "maintenance", "repair", "oil change"],
  finance: ["finance", "financing", "credit", "apply for financing", "payment"],
  specials: ["specials", "offers", "incentives", "deals"],
  trade_appraisal: ["trade", "trade in", "trade-in", "value your trade", "appraisal"],
  research_model: ["research", "compare", "specs", "overview", "model research"],
  local_seo_landing: ["landing", "local", "near me", "dealer in", "dealer near"],
};

const BRAND_ALIASES = [
  { brand: "Ford", aliases: ["ford", "ford motor", "ford motor company"] },
  { brand: "Honda", aliases: ["honda"] },
  { brand: "Toyota", aliases: ["toyota"] },
  { brand: "Chevrolet", aliases: ["chevrolet", "chevy"] },
  { brand: "GMC", aliases: ["gmc"] },
  { brand: "Buick", aliases: ["buick"] },
  { brand: "Cadillac", aliases: ["cadillac"] },
  { brand: "Nissan", aliases: ["nissan"] },
  { brand: "Hyundai", aliases: ["hyundai"] },
  { brand: "Kia", aliases: ["kia"] },
  { brand: "Subaru", aliases: ["subaru"] },
  { brand: "Mazda", aliases: ["mazda"] },
  { brand: "Volkswagen", aliases: ["volkswagen", "vw"] },
  { brand: "Audi", aliases: ["audi"] },
  { brand: "BMW", aliases: ["bmw"] },
  { brand: "Mercedes-Benz", aliases: ["mercedes-benz", "mercedes benz", "mercedes"] },
  { brand: "Lexus", aliases: ["lexus"] },
  { brand: "Acura", aliases: ["acura"] },
  { brand: "Jeep", aliases: ["jeep"] },
  { brand: "Ram", aliases: ["ram"] },
  { brand: "Dodge", aliases: ["dodge"] },
  { brand: "Chrysler", aliases: ["chrysler"] },
  { brand: "Lincoln", aliases: ["lincoln"] },
  { brand: "Genesis", aliases: ["genesis"] },
  { brand: "Volvo", aliases: ["volvo"] },
  { brand: "Porsche", aliases: ["porsche"] },
  { brand: "Land Rover", aliases: ["land rover", "range rover"] },
  { brand: "Jaguar", aliases: ["jaguar"] },
  { brand: "Mini", aliases: ["mini"] },
] as const;

const SOURCE_WEIGHTS = {
  filename: 1.2,
  title: 1.5,
  h1: 1.6,
  nav: 0.95,
  hero: 0.85,
  logoAlt: 1.1,
  assetPath: 0.85,
} as const;

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isPhraseMatch(source: string, phrase: string) {
  const normalizedSource = normalizeText(source);
  const normalizedPhrase = normalizeText(phrase);
  return normalizedSource.includes(normalizedPhrase);
}

function uniqueStrings(values: string[]) {
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index);
}

function pickBestBrand(signals: Array<{ source: keyof typeof SOURCE_WEIGHTS; text: string }>) {
  const candidates = new Map<
    string,
    { brand: string; source: TemplateBrandInference["source"]; score: number; reasons: string[] }
  >();

  for (const signal of signals) {
    for (const candidate of BRAND_ALIASES) {
      for (const alias of candidate.aliases) {
        if (!isPhraseMatch(signal.text, alias)) {
          continue;
        }

        const existing = candidates.get(candidate.brand);
        const nextScore = (existing?.score ?? 0) + SOURCE_WEIGHTS[signal.source];
        const nextSource: TemplateBrandInference["source"] =
          signal.source === "filename" || signal.source === "assetPath"
            ? "heuristic"
            : "heuristic";
        const nextReasons = uniqueStrings([
          ...(existing?.reasons ?? []),
          `${signal.source} matched "${alias}"`,
        ]);

        candidates.set(candidate.brand, {
          brand: candidate.brand,
          source: nextSource,
          score: nextScore,
          reasons: nextReasons,
        });
      }
    }
  }

  const best = [...candidates.values()].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return left.brand.localeCompare(right.brand);
  })[0];

  if (!best) {
    return undefined;
  }

  return {
    brand: best.brand,
    oem: best.brand,
    source: best.source,
    confidence: Math.min(0.99, Number((best.score / (best.score + 0.75)).toFixed(2))),
    reasons: best.reasons,
  } satisfies TemplateBrandInference;
}

function extractSignals(input: TemplateFileInput) {
  const $ = load(input.html);
  const title = $("title").first().text().trim();
  const h1 = $("h1").first().text().trim();
  const navLabels = uniqueStrings(
    $("nav")
      .map((_, element) => $(element).text().trim())
      .get()
      .slice(0, 3),
  ).join(" ");
  const heroNode =
    $('[class*="hero"], [id*="hero"]').first().text().trim() ||
    $("main p").first().text().trim() ||
    $("section").first().text().trim();
  const logoAlt = uniqueStrings(
    $("img")
      .map((_, element) => {
        const alt = ($(element).attr("alt") || "").trim();
        const src = ($(element).attr("src") || "").trim();
        const className = ($(element).attr("class") || "").trim();
        if (
          /logo|brand/i.test(alt) ||
          /logo|brand/i.test(src) ||
          /logo|brand/i.test(className)
        ) {
          return alt || src || className;
        }
        return "";
      })
      .get(),
  ).join(" ");
  const assetPaths = uniqueStrings(
    $("img[src], source[src], link[href]")
      .map((_, element) => {
        const source = ($(element).attr("src") || $(element).attr("href") || "").trim();
        return /[a-z0-9]/i.test(source) ? source : "";
      })
      .get(),
  ).join(" ");

  return {
    filename: input.path,
    title,
    h1,
    navLabels,
    heroNode,
    logoAlt,
    assetPaths,
  };
}

function scorePageType(pageType: SupportedPageType, text: string, weight: number) {
  let score = 0;
  const reasons: string[] = [];

  for (const token of PAGE_TYPE_RULES[pageType]) {
    if (isPhraseMatch(text, token)) {
      score += weight;
      reasons.push(`matched "${token}"`);
    }
  }

  return { score, reasons };
}

function rankPageTypes(signals: ReturnType<typeof extractSignals>) {
  const scored = new Map<SupportedPageType, { score: number; reasons: string[] }>();
  const sources: Array<{ key: keyof typeof SOURCE_WEIGHTS; text: string }> = [
    { key: "filename", text: signals.filename },
    { key: "title", text: signals.title },
    { key: "h1", text: signals.h1 },
    { key: "nav", text: signals.navLabels },
    { key: "hero", text: signals.heroNode },
  ];

  for (const type of Object.keys(PAGE_TYPE_RULES) as SupportedPageType[]) {
    scored.set(type, { score: 0, reasons: [] });
  }

  for (const source of sources) {
    for (const type of Object.keys(PAGE_TYPE_RULES) as SupportedPageType[]) {
      const result = scorePageType(type, source.text, SOURCE_WEIGHTS[source.key]);
      if (result.score === 0) {
        continue;
      }

      const current = scored.get(type);
      if (!current) continue;

      current.score += result.score;
      current.reasons.push(
        ...result.reasons.map((reason) => `${source.key} ${reason}`),
      );
    }
  }

  const ranked = [...scored.entries()]
    .filter(([, result]) => result.score > 0)
    .sort((left, right) => {
      if (right[1].score !== left[1].score) {
        return right[1].score - left[1].score;
      }
      return left[0].localeCompare(right[0]);
    });

  const [topEntry, secondEntry] = ranked;
  const topScore = topEntry?.[1].score ?? 0;
  const secondScore = secondEntry?.[1].score ?? 0;
  const pageType = topEntry ? topEntry[0] : null;
  const confidence = pageType
    ? Math.min(
        0.99,
        Number(((topScore + 0.25) / (topScore + secondScore + 0.75)).toFixed(2)),
      )
    : 0;

  const alternatives = ranked.slice(1, 4).map(([type, result]) => ({
    pageType: type,
    confidence: Number((result.score / Math.max(topScore, 1)).toFixed(2)),
  }));

  return {
    pageType,
    confidence,
    reasons: topEntry ? uniqueStrings(topEntry[1].reasons) : [],
    alternatives,
  };
}

export function classifyTemplateFile(
  input: TemplateFileInput,
  options?: { manifest?: { brand?: string; oem?: string } },
): TemplateFileDetection {
  const signals = extractSignals(input);
  const ranking = rankPageTypes(signals);
  const manifest = input.manifest ?? options?.manifest;
  const manifestBrand = manifest?.brand?.trim();
  const manifestOem = manifest?.oem?.trim();

  const brand =
    manifestBrand || manifestOem
      ? {
          brand: manifestBrand || manifestOem,
          oem: manifestOem || manifestBrand,
          source: "manifest" as const,
          confidence: 1,
          reasons: ["manifest brand/oem"],
        }
      : pickBestBrand([
          { source: "title", text: signals.title },
          { source: "h1", text: signals.h1 },
          { source: "nav", text: signals.navLabels },
          { source: "hero", text: signals.heroNode },
          { source: "logoAlt", text: signals.logoAlt },
          { source: "assetPath", text: signals.assetPaths },
        ]);

  return {
    path: input.path,
    pageType: ranking.pageType,
    confidence: ranking.confidence,
    reasons: ranking.reasons,
    brand,
    alternatives: ranking.alternatives,
  };
}

export async function detectTemplateFiles(packageId: string): Promise<TemplatePackageDetection> {
  const stored = await readStoredTemplatePackage(packageId);
  if (!stored) {
    throw new Error(`Template package "${packageId}" was not found.`);
  }

  const files: TemplateFileDetection[] = [];
  for (const file of stored.files.filter((entry) => entry.kind === "html")) {
    const htmlPath = path.join(stored.extractedRoot, file.path);
    const html = await readFile(htmlPath, "utf8");
    files.push(
      classifyTemplateFile(
        {
          path: file.path,
          html,
        },
        {
          manifest: {
            brand: stored.templatePackage.inferredBrand,
            oem: stored.templatePackage.inferredOem,
          },
        },
      ),
    );
  }

  const brand =
    stored.templatePackage.inferredBrand || stored.templatePackage.inferredOem
      ? {
          brand: stored.templatePackage.inferredBrand || stored.templatePackage.inferredOem,
          oem: stored.templatePackage.inferredOem || stored.templatePackage.inferredBrand,
          source: "manifest" as const,
          confidence: 1,
          reasons: ["manifest brand/oem"],
        }
      : files.find((file) => file.brand)?.brand;

  return {
    packageId: stored.packageId,
    brand,
    files,
  };
}
