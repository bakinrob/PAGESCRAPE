import { load } from "cheerio";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";

import { classifyPage } from "@/lib/classification";
import { slotDefinitions } from "@/lib/preset";
import { loadSkillSchema } from "@/lib/skill-pack";
import type {
  ClassificationResult,
  ExtractedLink,
  ExtractedMedia,
  ExtractedPagePayload,
  ExtractedSection,
  MappedPagePayload,
  MappedSection,
  PageResult,
  SeoPayload,
  SeoStatus,
  SupportedPageType,
} from "@/lib/types";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";

const NAV_DISCOVERY_PAGE_TYPES: SupportedPageType[] = [
  "about",
  "staff",
  "contact",
  "hours",
  "service",
  "finance",
  "specials",
  "trade_appraisal",
];

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

let extractedValidatorPromise:
  | Promise<ReturnType<Ajv2020["compile"]>>
  | undefined;
let mappedValidatorPromise:
  | Promise<ReturnType<Ajv2020["compile"]>>
  | undefined;

async function getExtractedValidator() {
  extractedValidatorPromise ??= loadSkillSchema("extracted-page.schema.json").then(
    (schema) => ajv.compile(schema),
  );
  return extractedValidatorPromise;
}

async function getMappedValidator() {
  mappedValidatorPromise ??= loadSkillSchema("mapped-page.schema.json").then(
    (schema) => ajv.compile(schema),
  );
  return mappedValidatorPromise;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function canonicalizeUrl(rawUrl: string, baseUrl?: string) {
  const resolved = new URL(rawUrl, baseUrl);
  resolved.hash = "";
  resolved.search = "";

  if (resolved.pathname !== "/" && resolved.pathname.endsWith("/")) {
    resolved.pathname = resolved.pathname.slice(0, -1);
  }

  return resolved.toString();
}

function isSkippableHref(href: string) {
  const lowered = href.toLowerCase();
  return (
    lowered.startsWith("#") ||
    lowered.startsWith("javascript:") ||
    lowered.startsWith("mailto:") ||
    lowered.startsWith("tel:")
  );
}

function collectUniqueText(values: Array<string | undefined | null>, limit = 8) {
  const seen = new Set<string>();
  const collected: string[] = [];

  for (const value of values) {
    const clean = value?.replace(/\s+/g, " ").trim();
    if (!clean || seen.has(clean)) {
      continue;
    }

    seen.add(clean);
    collected.push(clean);

    if (collected.length >= limit) {
      break;
    }
  }

  return collected;
}

function looksBlocked(status: number, html: string) {
  const lowered = html.toLowerCase();
  return (
    status >= 400 ||
    lowered.includes("attention required") ||
    lowered.includes("cloudflare") ||
    lowered.includes("sorry, you have been blocked") ||
    lowered.includes("access denied")
  );
}

async function fetchDirect(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT,
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    },
    cache: "no-store",
  });

  const html = await response.text();

  return {
    html,
    status: response.status,
    finalUrl: response.url,
  };
}

async function captureWithBrowser(
  url: string,
  options: { captureScreenshot: boolean } = { captureScreenshot: true },
) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({
      userAgent: USER_AGENT,
      viewport: { width: 1440, height: 960 },
      colorScheme: "dark",
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25_000 });
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => null);

    const html = await page.content();
    const screenshot = options.captureScreenshot
      ? await page.screenshot({
          type: "jpeg",
          quality: 58,
          fullPage: false,
        })
      : undefined;

    await page.close();

    return {
      html,
      screenshotDataUrl: screenshot
        ? `data:image/jpeg;base64,${screenshot.toString("base64")}`
        : undefined,
    };
  } finally {
    await browser.close();
  }
}

async function getSourceMaterial(
  url: string,
  options: { capturePreview?: boolean } = {},
) {
  const warnings: string[] = [];
  const capturePreview = options.capturePreview ?? false;

  try {
    const direct = await fetchDirect(url);

    if (!looksBlocked(direct.status, direct.html)) {
      let screenshotDataUrl: string | undefined;

      if (capturePreview) {
        try {
          const browserCapture = await captureWithBrowser(url, { captureScreenshot: true });
          screenshotDataUrl = browserCapture.screenshotDataUrl;
        } catch {
          warnings.push("Browser preview capture failed; using direct HTML only.");
        }
      }

      return {
        html: direct.html,
        sourceUrl: direct.finalUrl || url,
        accessMethod: "direct_http" as const,
        screenshotDataUrl,
        warnings,
      };
    }

    warnings.push("Direct fetch was blocked or incomplete; switched to browser-rendered fallback.");
  } catch (error) {
    warnings.push(`Direct fetch failed: ${error instanceof Error ? error.message : "unknown error"}`);
  }

  const browserCapture = await captureWithBrowser(url, {
    captureScreenshot: capturePreview,
  });

  return {
    html: browserCapture.html,
    sourceUrl: url,
    accessMethod: "browser_rendered" as const,
    screenshotDataUrl: browserCapture.screenshotDataUrl,
    warnings,
  };
}

export async function captureSourcePreview(url: string) {
  const sourceMaterial = await getSourceMaterial(url, { capturePreview: true });

  return {
    sourceUrl: sourceMaterial.sourceUrl,
    accessMethod: sourceMaterial.accessMethod,
    screenshotDataUrl: sourceMaterial.screenshotDataUrl,
    warnings: sourceMaterial.warnings,
  };
}

export function inferDealerNameFromHomepage(homepageUrl: string) {
  const hostname = new URL(homepageUrl).hostname.replace(/^www\./, "");
  const primary = hostname.split(".")[0] ?? hostname;
  return titleCase(primary.replace(/[-_]+/g, " "));
}

function extractDiscoverableNavLinks($: ReturnType<typeof load>, homepageUrl: string) {
  const homepage = new URL(homepageUrl);
  const candidates = new Map<string, { url: string; text: string; area: string }>();

  const selectors = [
    { selector: "header a", area: "header" },
    { selector: "nav a, [role='navigation'] a", area: "nav" },
    { selector: "footer a", area: "footer" },
  ] as const;

  selectors.forEach(({ selector, area }) => {
    $(selector)
      .slice(0, 80)
      .each((_, element) => {
        const href = $(element).attr("href")?.trim();
        const text = $(element).text().replace(/\s+/g, " ").trim();

        if (!href || !text || isSkippableHref(href)) {
          return;
        }

        const resolved = canonicalizeUrl(href, homepageUrl);
        const parsed = new URL(resolved);
        if (parsed.origin !== homepage.origin) {
          return;
        }

        if (!candidates.has(resolved)) {
          candidates.set(resolved, { url: resolved, text, area });
        }
      });
  });

  return Array.from(candidates.values());
}

export async function discoverPagesFromHomepage(homepageUrl: string) {
  const sourceMaterial = await getSourceMaterial(homepageUrl);
  const $ = load(sourceMaterial.html);
  const warnings = [...sourceMaterial.warnings];
  const canonicalHomepage = canonicalizeUrl(sourceMaterial.sourceUrl || homepageUrl);
  const discoveredByType = new Map<SupportedPageType, string>();
  const navCandidates = extractDiscoverableNavLinks($, canonicalHomepage);

  discoveredByType.set("homepage", canonicalHomepage);

  for (const candidate of navCandidates) {
    const classification = classifyPage(candidate.url, candidate.text, candidate.text);

    if (!classification.supported) {
      continue;
    }

    if (!NAV_DISCOVERY_PAGE_TYPES.includes(classification.page_type as SupportedPageType)) {
      continue;
    }

    const pageType = classification.page_type as SupportedPageType;
    if (!discoveredByType.has(pageType)) {
      discoveredByType.set(pageType, candidate.url);
    }
  }

  const discoveredUrls = Array.from(discoveredByType.values());

  if (discoveredUrls.length === 1) {
    warnings.push("Only the homepage was discovered from main navigation and footer links.");
  } else {
    warnings.push(`Discovered ${discoveredUrls.length - 1} supporting pages from site navigation.`);
  }

  return {
    homepageUrl: canonicalHomepage,
    discoveredUrls,
    warnings,
    accessMethod: sourceMaterial.accessMethod,
  };
}

function extractSeoPayload($: ReturnType<typeof load>, sourceUrl: string, seoLock: boolean): SeoPayload {
  const title = $("title").first().text().replace(/\s+/g, " ").trim();
  const h1 = $("h1").first().text().replace(/\s+/g, " ").trim();
  const metaDescription =
    $('meta[name="description"]').attr("content")?.replace(/\s+/g, " ").trim() ?? "";
  const canonicalUrl = $('link[rel="canonical"]').attr("href")?.trim() ?? sourceUrl;
  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim() ?? title;
  const ogDescription =
    $('meta[property="og:description"]').attr("content")?.trim() ?? metaDescription;
  const ogImage = $('meta[property="og:image"]').attr("content")?.trim() ?? "";

  return {
    locked: seoLock,
    title,
    meta_description: metaDescription,
    h1,
    canonical_url: canonicalUrl,
    og_title: ogTitle,
    og_description: ogDescription,
    og_image: ogImage,
  };
}

function extractNavSample($: ReturnType<typeof load>) {
  return collectUniqueText(
    $("nav a, header a")
      .map((_, element) => $(element).text())
      .get(),
    14,
  );
}

function extractHeadingSample($: ReturnType<typeof load>) {
  return collectUniqueText(
    $("main h2, main h3, article h2, article h3, h2, h3")
      .map((_, element) => $(element).text())
      .get(),
    12,
  );
}

function extractSummaryParagraphs($: ReturnType<typeof load>) {
  return collectUniqueText(
    $("main p, article p, p")
      .map((_, element) => $(element).text())
      .get()
      .filter((text) => text.replace(/\s+/g, " ").trim().length > 48),
    6,
  );
}

function inferLinkKind(text: string, href: string): ExtractedLink["kind"] {
  const normalized = `${text} ${href}`.toLowerCase();

  if (
    normalized.includes("schedule") ||
    normalized.includes("apply") ||
    normalized.includes("trade") ||
    normalized.includes("contact") ||
    normalized.includes("shop")
  ) {
    return "cta";
  }

  if (normalized.includes("privacy") || normalized.includes("terms") || normalized.includes("adchoices")) {
    return "policy";
  }

  if (normalized.includes("footer")) {
    return "footer";
  }

  if (href.startsWith("http")) {
    return "external_reference";
  }

  return "navigation";
}

function extractLinks($: ReturnType<typeof load>, sourceUrl: string) {
  const base = new URL(sourceUrl);
  const rawLinks = $("a[href]")
    .map((_, element) => {
      const href = $(element).attr("href")?.trim();
      const text = $(element).text().replace(/\s+/g, " ").trim();
      if (!href || !text) {
        return null;
      }

      const resolved = href.startsWith("http") ? href : new URL(href, base).toString();
      return {
        href: resolved,
        text,
      };
    })
    .get()
    .filter(Boolean) as Array<{ href: string; text: string }>;

  const unique = new Map<string, ExtractedLink>();

  rawLinks.slice(0, 48).forEach((link) => {
    const key = `${link.href}:${link.text}`;
    if (unique.has(key)) {
      return;
    }

    unique.set(key, {
      href: link.href,
      text: link.text,
      kind: inferLinkKind(link.text, link.href),
      internal: link.href.startsWith(base.origin),
      purpose: link.text,
    });
  });

  return Array.from(unique.values());
}

function extractMedia($: ReturnType<typeof load>, seo: SeoPayload) {
  const media = new Map<string, ExtractedMedia>();

  $("img[src]")
    .slice(0, 12)
    .each((_, element) => {
      const url = $(element).attr("src")?.trim();
      if (!url) {
        return;
      }

      media.set(url, {
        url,
        alt: $(element).attr("alt")?.trim(),
        role: "generic",
        source_hint: "img",
      });
    });

  if (seo.og_image) {
    media.set(seo.og_image, {
      url: seo.og_image,
      role: "og",
      source_hint: "og:image",
    });
  }

  return Array.from(media.values());
}

function extractSections($: ReturnType<typeof load>, title: string, h1: string) {
  const sections: ExtractedSection[] = [];
  const headingNodes = $("main h2, main h3, article h2, article h3, h2, h3").slice(0, 10);

  headingNodes.each((index, element) => {
    const label = $(element).text().replace(/\s+/g, " ").trim();
    if (!label) {
      return;
    }

    const siblingTexts = collectUniqueText(
      $(element)
        .nextUntil("h2, h3")
        .find("p, li")
        .map((_, node) => $(node).text())
        .get(),
      5,
    );

    const section: ExtractedSection = {
      section_key: `${slugify(label) || "section"}-${index + 1}`,
      section_label: label,
      order: index,
      text_blocks: siblingTexts.length ? siblingTexts : [],
      proof_points: siblingTexts.slice(0, 2),
      ctas: [],
    };

    sections.push(section);
  });

  if (sections.length > 0) {
    return sections;
  }

  const summary = extractSummaryParagraphs($);

  return [
    {
      section_key: "intro-1",
      section_label: h1 || title || "Page Overview",
      order: 0,
      text_blocks: summary,
      proof_points: summary.slice(0, 2),
      ctas: [],
    },
  ];
}

function buildSeoValidation(
  classification: ClassificationResult,
  seo: SeoPayload,
  sourceUrl: string,
  accessMethod: string,
  warnings: string[],
) {
  const missingFields = [
    ["title", seo.title],
    ["meta_description", seo.meta_description],
    ["h1", seo.h1],
    ["canonical_url", seo.canonical_url],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  const seoWarnings = [...warnings];
  let seoStatus: SeoStatus = "green";

  if (accessMethod !== "direct_http") {
    seoWarnings.push("Metadata came from browser-rendered fallback.");
    seoStatus = "yellow";
  }

  if (seo.canonical_url && seo.canonical_url !== sourceUrl) {
    seoWarnings.push("Canonical URL differs from fetched source URL.");
    seoStatus = "yellow";
  }

  if (!classification.supported) {
    seoWarnings.push("Unsupported page type is excluded from mapped output.");
  }

  if (missingFields.length > 0) {
    seoWarnings.push("One or more SEO fields were missing in the source page.");
    seoStatus = "yellow";
  }

  return {
    seo_status: seoStatus,
    warnings: seoWarnings,
    errors: [] as string[],
    missing_fields: missingFields,
  };
}

function validateSchemaErrors(errors: unknown) {
  if (!Array.isArray(errors)) {
    return [];
  }

  return errors.map((error) => {
    if (typeof error !== "object" || !error) {
      return "Unknown validation issue";
    }

    const instancePath = "instancePath" in error && typeof error.instancePath === "string" ? error.instancePath : "<root>";
    const message = "message" in error && typeof error.message === "string" ? error.message : "validation issue";
    return `${instancePath}: ${message}`;
  });
}

function contentScore(section: ExtractedSection, keywords: string[]) {
  const haystack = `${section.section_label} ${section.text_blocks.join(" ")} ${section.proof_points.join(" ")}`.toLowerCase();
  const keywordScore = keywords.reduce(
    (sum, keyword) => sum + (haystack.includes(keyword.toLowerCase()) ? 3 : 0),
    0,
  );
  const textBonus = section.text_blocks.length > 0 ? 2 : 0;
  const proofBonus = section.proof_points.length > 0 ? 1 : 0;
  const emptyPenalty =
    section.text_blocks.length === 0 && section.proof_points.length === 0 ? -2 : 0;
  return keywordScore + textBonus + proofBonus + emptyPenalty;
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function uniqueByValue<T>(items: T[], keyFor: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyFor(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function splitSummary(summary: string) {
  return summary
    .split(/(?<=[.!?])\s+/)
    .map((value) => value.replace(/\s+/g, " ").trim())
    .filter((value) => value.length > 20)
    .slice(0, 5);
}

function sectionLines(section?: ExtractedSection) {
  if (!section) return [];
  const lines = uniqueByValue(
    [section.section_label, ...section.text_blocks, ...section.proof_points].filter(Boolean),
    (value) => normalizeText(value),
  );
  return lines.filter((value) => value.length > 0);
}

function pickLinks(
  extracted: ExtractedPagePayload,
  keywords: string[],
  limit: number,
  options?: { internalOnly?: boolean; kind?: Array<ExtractedLink["kind"]> },
) {
  const normalizedKeywords = keywords.map(normalizeText);
  const kindFilter = options?.kind;

  const matches = extracted.links
    .filter((link) => {
      if (options?.internalOnly && !link.internal) return false;
      if (kindFilter && !kindFilter.includes(link.kind)) return false;
      const haystack = normalizeText(`${link.text} ${link.href} ${link.purpose ?? ""}`);
      return normalizedKeywords.some((keyword) => haystack.includes(keyword));
    })
    .sort((left, right) => {
      const leftCtaBoost = left.kind === "cta" ? 1 : 0;
      const rightCtaBoost = right.kind === "cta" ? 1 : 0;
      return rightCtaBoost - leftCtaBoost;
    });

  return uniqueByValue(matches, (link) => `${link.href}:${link.text}`).slice(0, limit);
}

function pickHeroMedia(extracted: ExtractedPagePayload, limit = 2) {
  const ranked = [...extracted.media]
    .filter((item) => !normalizeText(item.alt || item.url).includes("logo"))
    .map((item) => {
      const haystack = normalizeText(`${item.alt || ""} ${item.url}`);
      let score = 0;
      if (item.role === "og") score += 4;
      if (/(service|advantage|tradition|anniversary|truck|mustang|bronco|explorer|maverick|offer|banner|ford)/.test(haystack)) score += 3;
      if (/(logo|icon)/.test(haystack)) score -= 5;
      return { item, score };
    })
    .sort((left, right) => right.score - left.score);

  return uniqueByValue(ranked.map((entry) => entry.item), (item) => item.url)
    .slice(0, limit)
    .map((item) => item.url);
}

function mapLinksToCtas(links: ExtractedLink[], limit: number) {
  return uniqueByValue(
    links.map(({ href, text }) => ({ href, label: text })),
    (cta) => `${cta.href}:${cta.label}`,
  ).slice(0, limit);
}

function contactContent(extracted: ExtractedPagePayload) {
  const telLinks = extracted.links.filter((link) => link.href.startsWith("tel:")).slice(0, 4);
  const directionsLink =
    extracted.links.find((link) => /directions|map/i.test(link.text)) ||
    extracted.links.find((link) => /maps\.google/.test(link.href));
  const addressLink = extracted.links.find(
    (link) =>
      /(road|rd\.|street|st\.|avenue|ave\.|drive|dr\.|lane|ln\.|ann arbor|michigan|mi\b)/i.test(link.text) &&
      !link.href.startsWith("tel:"),
  );

  const blocks: MappedSection["content_blocks"] = [];
  if (addressLink) {
    blocks.push({ type: "address_block", value: addressLink.text });
  }
  if (telLinks.length > 0) {
    blocks.push({ type: "phone_block", value: telLinks.map((link) => link.text).join("\n") });
  }
  if (directionsLink) {
    blocks.push({ type: "paragraph", value: `${directionsLink.text} available from the original page.` });
  }

  const ctas = mapLinksToCtas(
    uniqueByValue(
      [
        ...(directionsLink ? [directionsLink] : []),
        ...pickLinks(extracted, ["contact", "visit", "hours"], 3),
      ],
      (link) => `${link.href}:${link.text}`,
    ),
    3,
  );

  return { blocks, ctas };
}

function buildSectionBlocks(section?: ExtractedSection, fallbackHeading?: string) {
  const lines = sectionLines(section);
  if (lines.length === 0) return [];

  const [first, ...rest] = lines;
  return [
    { type: "heading" as const, value: first || fallbackHeading || "Source section" },
    ...rest.slice(0, 3).map((value) => ({ type: "paragraph" as const, value })),
  ];
}

function buildSlotContent(
  pageType: SupportedPageType,
  definition: (typeof slotDefinitions)[SupportedPageType][number],
  extracted: ExtractedPagePayload,
  selected?: ExtractedSection,
) {
  const summaryLines = splitSummary(extracted.content.summary);
  const selectedBlocks = buildSectionBlocks(selected, extracted.seo.h1 || extracted.seo.title);
  const defaultCtas = mapLinksToCtas(extracted.links.filter((link) => link.kind === "cta"), 3);
  const contactInfo = contactContent(extracted);

  switch (definition.slotKey) {
    case "hero_offer_strip":
      return {
        content_blocks: [
          { type: "heading" as const, value: extracted.seo.h1 || extracted.seo.title },
          {
            type: "paragraph" as const,
            value: selected?.text_blocks[0] || extracted.seo.meta_description || summaryLines[0] || "Source hero copy available in extracted output.",
          },
        ],
        ctas: mapLinksToCtas(
          uniqueByValue(
            [
              ...pickLinks(extracted, ["special", "offer", "contact", "directions", "schedule"], 4),
              ...extracted.links.filter((link) => link.kind === "cta"),
            ],
            (link) => `${link.href}:${link.text}`,
          ),
          3,
        ),
        media_refs: pickHeroMedia(extracted, 1),
        mapping_notes: ["Built from locked SEO fields, offer/navigation links, and the strongest hero media."],
      };
    case "inventory_shortcuts": {
      const inventoryLinks = pickLinks(
        extracted,
        ["new", "used", "certified", "work truck", "inventory", "special", "under 25"],
        6,
        { internalOnly: false },
      );
      return {
        content_blocks: [
          { type: "heading" as const, value: "Shop Ford inventory" },
          { type: "bullet_list" as const, value: inventoryLinks.map((link) => link.text).join("\n") },
        ],
        ctas: mapLinksToCtas(inventoryLinks, 4),
        media_refs: pickHeroMedia(extracted, 3),
        mapping_notes: ["Built from main inventory/navigation links discovered on the source homepage."],
      };
    }
    case "primary_cta_row": {
      const ctaLinks = pickLinks(extracted, ["schedule", "service", "trade", "finance", "contact", "directions"], 6);
      return {
        content_blocks: [
          { type: "heading" as const, value: "Primary shopper actions" },
          { type: "bullet_list" as const, value: ctaLinks.map((link) => link.text).join("\n") },
        ],
        ctas: mapLinksToCtas(ctaLinks, 4),
        media_refs: [],
        mapping_notes: ["Built from high-priority CTA links on the source page."],
      };
    }
    case "model_lineup": {
      const modelLinks = uniqueByValue(
        extracted.links.filter((link) =>
          /(bronco|explorer|escape|mustang|maverick|f-150|super duty|expedition|ranger|mach-e)/i.test(link.text),
        ),
        (link) => `${link.href}:${link.text}`,
      ).slice(0, 8);
      return {
        content_blocks: [
          { type: "heading" as const, value: "Popular Ford models" },
          { type: "bullet_list" as const, value: modelLinks.map((link) => link.text.replace(/^New Ford\s+/i, "")).join("\n") },
        ],
        ctas: mapLinksToCtas(modelLinks, 4),
        media_refs: pickHeroMedia(extracted, 4),
        mapping_notes: ["Built from model and offer links surfaced in the source navigation."],
      };
    }
    case "trust_value_props": {
      const trustLines =
        summaryLines.filter((line) =>
          /(trusted|since|family|tradition|customers first|warranty|inspection|roadside|rewards|blue advantage)/i.test(line),
        ) || [];
      const values = trustLines.length > 0 ? trustLines : summaryLines.slice(0, 3);
      return {
        content_blocks: [
          { type: "heading" as const, value: `Why choose ${extracted.dealer_name}` },
          { type: "bullet_list" as const, value: values.join("\n") },
        ],
        ctas: defaultCtas.slice(0, 2),
        media_refs: pickHeroMedia(extracted, 1),
        mapping_notes: ["Built from the extracted homepage summary and trust-oriented source language."],
      };
    }
    case "reviews_or_social_proof": {
      const reviewLine =
        summaryLines.find((line) => /(review|everyone is saying|customer|customers first|testimonial)/i.test(line)) ||
        summaryLines[0];
      return {
        content_blocks: [
          { type: "heading" as const, value: "Customer proof" },
          { type: "review_snippet" as const, value: reviewLine || "Customer proof remains available in the extracted source output." },
        ],
        ctas: [],
        media_refs: [],
        mapping_notes: ["Built from review and customer-proof language found in the source summary."],
      };
    }
    case "service_finance_support": {
      const supportLinks = pickLinks(extracted, ["service", "parts", "finance", "payment", "schedule"], 6);
      return {
        content_blocks: [
          { type: "heading" as const, value: "Ownership support" },
          {
            type: "paragraph" as const,
            value:
              selected?.text_blocks[0] ||
              summaryLines.find((line) => /(service|finance|support|payment)/i.test(line)) ||
              "Service, finance, and owner support links were preserved from the source homepage.",
          },
          { type: "bullet_list" as const, value: supportLinks.map((link) => link.text).join("\n") },
        ],
        ctas: mapLinksToCtas(supportLinks, 3),
        media_refs: pickHeroMedia(extracted, 1),
        mapping_notes: ["Built from service and finance support links plus extracted support copy."],
      };
    }
    case "about_local_market":
      return {
        content_blocks: [
          { type: "heading" as const, value: extracted.seo.h1 || extracted.dealer_name },
          {
            type: "paragraph" as const,
            value:
              selected?.text_blocks[0] ||
              extracted.seo.meta_description ||
              summaryLines.find((line) => /(ann arbor|michigan|serving|community|history)/i.test(line)) ||
              summaryLines[0] ||
              "Local market positioning preserved from the source page.",
          },
        ],
        ctas: mapLinksToCtas(pickLinks(extracted, ["about", "contact", "directions"], 3), 2),
        media_refs: pickHeroMedia(extracted, 1),
        mapping_notes: ["Built from localized SEO copy and about/navigation signals from the source site."],
      };
    case "contact_hours_map":
    case "address_and_map":
    case "contact_footer":
      return {
        content_blocks: [
          { type: "heading" as const, value: `Visit ${extracted.dealer_name}` },
          ...contactInfo.blocks,
        ],
        ctas: contactInfo.ctas,
        media_refs: [],
        mapping_notes: ["Built from address, directions, and department phone links found on the source page."],
      };
    case "department_contacts":
      return {
        content_blocks: [
          { type: "heading" as const, value: "Department contacts" },
          ...(contactInfo.blocks.filter((block) => block.type === "phone_block") || []),
        ],
        ctas: contactInfo.ctas,
        media_refs: [],
        mapping_notes: ["Built from phone and department contact links on the source page."],
      };
    case "hours_table":
    case "hours_linkout_or_embed":
      return {
        content_blocks: [
          { type: "heading" as const, value: "Hours and visit information" },
          {
            type: "bullet_list" as const,
            value: uniqueByValue(
              [
                ...pickLinks(extracted, ["hours", "service", "sales", "parts"], 5).map((link) => link.text),
                ...contactInfo.blocks.filter((block) => block.type === "phone_block").map((block) => block.value),
              ],
              (value) => normalizeText(value),
            ).join("\n"),
          },
        ],
        ctas: mapLinksToCtas(pickLinks(extracted, ["hours", "visit", "directions"], 3), 2),
        media_refs: [],
        mapping_notes: ["Built from hours- and visit-related source links."],
      };
    case "schedule_service_cta":
    case "finance_application_cta":
    case "valuation_cta":
    case "contact_cta":
    case "directions_cta": {
      const links = pickLinks(
        extracted,
        definition.slotKey === "schedule_service_cta"
          ? ["schedule", "service", "appointment"]
          : definition.slotKey === "finance_application_cta"
            ? ["apply", "finance", "pre-approved", "application"]
            : definition.slotKey === "valuation_cta"
              ? ["trade", "value", "cash offer", "appraisal"]
              : definition.slotKey === "directions_cta"
                ? ["directions", "visit", "map"]
                : ["contact", "call", "email", "visit"],
        4,
      );
      return {
        content_blocks: [
          {
            type: "heading" as const,
            value:
              definition.label === "Contact CTA"
                ? `Connect with ${extracted.dealer_name}`
                : definition.label,
          },
          {
            type: "bullet_list" as const,
            value: links.map((link) => link.text).join("\n"),
          },
        ],
        ctas: mapLinksToCtas(links, 3),
        media_refs: [],
        mapping_notes: ["Built from task-oriented CTA links discovered on the source page."],
      };
    }
    default:
      if (selectedBlocks.length > 0) {
        return {
          content_blocks: selectedBlocks,
          ctas: selected?.ctas ?? [],
          media_refs: pickHeroMedia(extracted, 1),
          mapping_notes: [`Built from source section "${selected?.section_label ?? definition.label}".`],
        };
      }
      return undefined;
  }
}

function fallbackContent(
  fallbackType: string | undefined,
  extracted: ExtractedPagePayload,
): { contentBlocks: MappedSection["content_blocks"]; ctas: MappedSection["ctas"]; mediaRefs: string[] } {
  const introSection = extracted.content.sections[0];
  const contactLink = extracted.links.find(
    (link) => link.kind === "cta" || link.text.toLowerCase().includes("contact"),
  );
  const genericBlocks = sectionLines(introSection).slice(0, 3);

  if (fallbackType === "hero") {
    return {
      contentBlocks: [
        { type: "heading", value: extracted.seo.h1 || extracted.seo.title },
        {
          type: "paragraph",
          value:
            extracted.seo.meta_description ||
            genericBlocks[0] ||
            "Source copy available in extracted payload.",
        },
      ],
      ctas: mapLinksToCtas(extracted.links.filter((link) => link.kind === "cta"), 2),
      mediaRefs: pickHeroMedia(extracted, 1),
    };
  }

  if (fallbackType === "contact") {
    const contactInfo = contactContent(extracted);
    return {
      contentBlocks: contactInfo.blocks.length
        ? [{ type: "heading", value: `Visit ${extracted.dealer_name}` }, ...contactInfo.blocks]
        : genericBlocks.map((block) => ({ type: "paragraph" as const, value: block })),
      ctas: contactInfo.ctas.length
        ? contactInfo.ctas
        : contactLink
          ? [{ href: contactLink.href, label: contactLink.text }]
          : [],
      mediaRefs: [],
    };
  }

  if (fallbackType === "reviews") {
    return {
      contentBlocks: [
        {
          type: "review_snippet",
          value:
            splitSummary(extracted.content.summary).find((line) => /(review|customer|testimonial)/i.test(line)) ||
            genericBlocks[0] ||
            "Social proof should be preserved from the source if available.",
        },
      ],
      ctas: [],
      mediaRefs: [],
    };
  }

  return {
    contentBlocks: genericBlocks.map((block, index) => ({
      type: index === 0 ? ("heading" as const) : ("paragraph" as const),
      value: block,
    })),
    ctas: mapLinksToCtas(extracted.links.filter((link) => link.kind === "cta"), 1),
    mediaRefs: pickHeroMedia(extracted, 1),
  };
}

function mapExtractedToPreset(
  extracted: ExtractedPagePayload,
  presetId: string = "ford-varsity",
): MappedPagePayload | undefined {
  if (!extracted.classification.supported) {
    return undefined;
  }

  const pageType = extracted.classification.page_type as SupportedPageType;
  const definitions = slotDefinitions[pageType];
  const unusedSections = new Map(extracted.content.sections.map((section) => [section.section_key, section]));
  const warnings = [...extracted.validation.warnings];

  const sections: MappedSection[] = definitions.map((definition) => {
    let selected: ExtractedSection | undefined;
    let bestScore = -1;

    for (const section of unusedSections.values()) {
      const score = contentScore(section, definition.keywords);
      if (score > bestScore) {
        bestScore = score;
        selected = section;
      }
    }

    if (selected && bestScore > 0) {
      unusedSections.delete(selected.section_key);
      const built = buildSlotContent(pageType, definition, extracted, selected);
      return {
        slot_key: definition.slotKey,
        label: definition.label,
        required: definition.required,
        status: "mapped",
        source_section_keys: [selected.section_key],
        content_blocks:
          built?.content_blocks && built.content_blocks.length > 0
            ? built.content_blocks
            : buildSectionBlocks(selected, definition.label),
        ctas: built?.ctas ?? selected.ctas,
        media_refs:
          built?.media_refs && built.media_refs.length > 0
            ? built.media_refs
            : pickHeroMedia(extracted, 2),
        mapping_notes: [
          `Matched from source section "${selected.section_label}" with score ${bestScore}.`,
          ...(built?.mapping_notes ?? []),
        ],
      };
    }

    const builtFromSignals = buildSlotContent(pageType, definition, extracted);
    if (builtFromSignals && (builtFromSignals.content_blocks.length > 0 || builtFromSignals.ctas.length > 0)) {
      warnings.push(`${definition.label} was rebuilt from source signals and locked metadata.`);
      return {
        slot_key: definition.slotKey,
        label: definition.label,
        required: definition.required,
        status: "mapped",
        source_section_keys: [],
        content_blocks: builtFromSignals.content_blocks,
        ctas: builtFromSignals.ctas,
        media_refs: builtFromSignals.media_refs,
        mapping_notes: builtFromSignals.mapping_notes,
      };
    }

    const fallback = fallbackContent(definition.fallbackType, extracted);
    if (fallback.contentBlocks.length > 0 || fallback.ctas.length > 0) {
      warnings.push(`${definition.label} used fallback content derived from extracted source metadata.`);
      return {
        slot_key: definition.slotKey,
        label: definition.label,
        required: definition.required,
        status: "mapped",
        source_section_keys: [],
        content_blocks: fallback.contentBlocks,
        ctas: fallback.ctas,
        media_refs: fallback.mediaRefs,
        mapping_notes: ["Filled with conservative fallback content from SEO/source summary."],
      };
    }

    if (definition.required) {
      warnings.push(`${definition.label} has no trustworthy source content.`);
      return {
        slot_key: definition.slotKey,
        label: definition.label,
        required: definition.required,
        status: "empty_with_warning",
        source_section_keys: [],
        content_blocks: [],
        ctas: [],
        media_refs: [],
        mapping_notes: ["Required slot left empty because no trustworthy content was found."],
      };
    }

    return {
      slot_key: definition.slotKey,
      label: definition.label,
      required: definition.required,
      status: "not_present_in_source",
      source_section_keys: [],
      content_blocks: [],
      ctas: [],
      media_refs: [],
      mapping_notes: ["Optional slot not present in source."],
    };
  });

  return {
    dealer_name: extracted.dealer_name,
    oem_preset: presetId,
    source_url: extracted.source.url,
    page_type: pageType,
    template: {
      preset: presetId,
      page_layout: pageType,
      version: "v1",
    },
    seo: extracted.seo,
    sections,
    validation: {
      seo_status: extracted.validation.seo_status,
      warnings,
      errors: [],
    },
    confidence_notes: extracted.confidence_notes,
  };
}

export async function processUrl(input: {
  dealerName: string;
  url: string;
  seoLock: boolean;
  oemPreset?: string;
  updateStage?: (stage: PageResult["stage"], label: string) => void;
}): Promise<PageResult> {
  const presetId = input.oemPreset || "ford-varsity";
  const pageId = slugify(input.url) || crypto.randomUUID();
  input.updateStage?.("fetching", "Fetching source");

  try {
    const sourceMaterial = await getSourceMaterial(input.url, { capturePreview: false });
    const $ = load(sourceMaterial.html);
    const seo = extractSeoPayload($, sourceMaterial.sourceUrl, input.seoLock);
    const classification = classifyPage(sourceMaterial.sourceUrl, seo.title, seo.h1);

    input.updateStage?.("classifying", "Classifying page");

    const summaryParagraphs = extractSummaryParagraphs($);
    const extractedSections = extractSections($, seo.title, seo.h1);
    const links = extractLinks($, sourceMaterial.sourceUrl);
    const media = extractMedia($, seo);

    input.updateStage?.("extracting", "Extracting structured content");

    const extracted: ExtractedPagePayload = {
      dealer_name: input.dealerName,
      source: {
        url: sourceMaterial.sourceUrl,
        source_path: new URL(sourceMaterial.sourceUrl).pathname,
        access_method: sourceMaterial.accessMethod,
        fetched_at: new Date().toISOString(),
      },
      classification,
      seo,
      content: {
        summary: summaryParagraphs.join(" ").slice(0, 420),
        sections: extractedSections.map((section) => ({
          ...section,
          ctas:
            section.ctas.length > 0
              ? section.ctas
              : links
                  .filter((link) => link.kind === "cta")
                  .slice(0, 2)
                  .map((link) => ({ href: link.href, label: link.text })),
        })),
      },
      links,
      media,
      validation: buildSeoValidation(
        classification,
        seo,
        sourceMaterial.sourceUrl,
        sourceMaterial.accessMethod,
        sourceMaterial.warnings,
      ),
      confidence_notes: [
        ...classification.ambiguity_notes,
        ...(sourceMaterial.accessMethod !== "direct_http"
          ? ["Source page required browser-rendered fallback."]
          : []),
      ],
    };

    input.updateStage?.("mapping", `Mapping to ${presetId}`);
    const mapped = mapExtractedToPreset(extracted, presetId);

    input.updateStage?.("validating", "Validating payloads");
    const extractedValidator = await getExtractedValidator();
    const extractedValid = extractedValidator(extracted);
    if (!extractedValid) {
      extracted.validation.errors.push(...validateSchemaErrors(extractedValidator.errors));
    }

    if (mapped) {
      const mappedValidator = await getMappedValidator();
      const mappedValid = mappedValidator(mapped);
      if (!mappedValid) {
        mapped.validation.errors.push(...validateSchemaErrors(mappedValidator.errors));
      }
    }

    return {
      id: pageId,
      url: input.url,
      stage: classification.supported ? "complete" : "unsupported",
      statusLabel: classification.supported ? "Ready for review" : "Unsupported for v1",
      sourceSnapshot: {
        screenshotDataUrl: sourceMaterial.screenshotDataUrl,
        headingSample: extractHeadingSample($),
        navSample: extractNavSample($),
        summaryText: summaryParagraphs,
      },
      extracted,
      mapped,
    };
  } catch (error) {
    return {
      id: pageId,
      url: input.url,
      stage: "error",
      statusLabel: "Failed",
      error: error instanceof Error ? error.message : "Unknown scraping error",
    };
  }
}
