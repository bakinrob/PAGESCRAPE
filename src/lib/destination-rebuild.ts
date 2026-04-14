import { load } from "cheerio";

import type { MappedPagePayload, RebuiltPagePayload } from "@/lib/types";

export interface DestinationRebuildInput {
  templateHtml: string;
  templatePath: string;
  confidence: number;
  mappedPage: MappedPagePayload;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeHref(value: string) {
  const href = value.trim();
  if (!href) return "#";
  if (
    href.startsWith("/") ||
    href.startsWith("#") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:")
  ) {
    return href;
  }

  try {
    const parsed = new URL(href);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {
    return "#";
  }

  return "#";
}

function ensureHead($: ReturnType<typeof load>) {
  const head = $("head").first();
  if (head.length > 0) {
    return head;
  }

  const html = $("html").first();
  if (html.length > 0) {
    html.prepend("<head></head>");
    return $("head").first();
  }

  $.root().prepend("<html><head></head><body></body></html>");
  return $("head").first();
}

function ensureBody($: ReturnType<typeof load>) {
  const body = $("body").first();
  if (body.length > 0) {
    return body;
  }

  const html = $("html").first();
  if (html.length > 0) {
    html.append("<body></body>");
    return $("body").first();
  }

  $.root().append("<html><head></head><body></body></html>");
  return $("body").first();
}

function firstExistingSelection($: ReturnType<typeof load>, selectors: string[]) {
  for (const selector of selectors) {
    const selection = $(selector).first();
    if (selection.length > 0) {
      return selection;
    }
  }

  return null;
}

function findSection(
  mappedPage: MappedPagePayload,
  slotKeys: string[],
  labels: string[],
) {
  return mappedPage.sections.find((section) => {
    const slotKey = section.slot_key.toLowerCase();
    const label = section.label.toLowerCase();
    return slotKeys.some((candidate) => slotKey.includes(candidate)) ||
      labels.some((candidate) => label.includes(candidate));
  });
}

function buildSectionMarkup(section: MappedPagePayload["sections"][number]) {
  const heading =
    section.content_blocks.find((block) => block.type === "heading")?.value ||
    section.label ||
    section.slot_key;
  const paragraphs = section.content_blocks
    .filter((block) => block.type === "paragraph")
    .map((block) => `<p>${escapeHtml(block.value)}</p>`)
    .join("");
  const lists = section.content_blocks
    .filter((block) => block.type === "bullet_list")
    .map((block) => {
      const items = block.value
        .split(/\r?\n+/)
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => `<li>${escapeHtml(item)}</li>`)
        .join("");
      return items ? `<ul>${items}</ul>` : "";
    })
    .join("");
  const contactBlocks = section.content_blocks
    .filter((block) => ["address_block", "hours_table", "phone_block"].includes(block.type))
    .map((block) => `<div class="rebuild-block rebuild-${block.type}">${escapeHtml(block.value)}</div>`)
    .join("");
  const ctas = section.ctas
    .map((cta) => `<a class="rebuild-cta" href="${escapeHtml(sanitizeHref(cta.href))}">${escapeHtml(cta.label)}</a>`)
    .join("");

  return [
    `<section data-template-slot="${escapeHtml(section.slot_key)}">`,
    `<h2>${escapeHtml(heading)}</h2>`,
    paragraphs,
    lists,
    contactBlocks,
    ctas ? `<div class="rebuild-ctas">${ctas}</div>` : "",
    `</section>`,
  ].join("");
}

function updateHead($: ReturnType<typeof load>, mappedPage: MappedPagePayload) {
  const head = ensureHead($);
  const seo = mappedPage.seo;

  if (seo.title) {
    const title = head.find("title").first();
    if (title.length > 0) {
      title.text(seo.title);
    } else {
      const titleNode = $("<title></title>");
      titleNode.text(seo.title);
      head.append(titleNode);
    }
  }

  const metaPairs: Array<[string, string, string]> = [
    ["name", "description", seo.meta_description],
    ["property", "og:title", seo.og_title || seo.title],
    ["property", "og:description", seo.og_description || seo.meta_description],
    ["property", "og:image", seo.og_image],
    ["property", "og:type", "website"],
  ];

  for (const [attr, key, value] of metaPairs) {
    if (!value) continue;
    const selector = `meta[${attr}="${key}"]`;
    const meta = head.find(selector).first();
    if (meta.length > 0) {
      meta.attr("content", value);
      continue;
    }
    const metaNode = $("<meta />");
    metaNode.attr(attr, key);
    metaNode.attr("content", value);
    head.append(metaNode);
  }

  if (seo.canonical_url) {
    const canonical = head.find('link[rel="canonical"]').first();
    if (canonical.length > 0) {
      canonical.attr("href", seo.canonical_url);
    } else {
      const canonicalNode = $("<link />");
      canonicalNode.attr("rel", "canonical");
      canonicalNode.attr("href", seo.canonical_url);
      head.append(canonicalNode);
    }
  }
}

function updateHeroRegion($: ReturnType<typeof load>, mappedPage: MappedPagePayload) {
  const heroSection =
    findSection(mappedPage, ["hero", "masthead", "banner"], ["hero", "masthead", "banner"]) ??
    mappedPage.sections[0];
  if (!heroSection) {
    return;
  }

  let hero = firstExistingSelection($, [
    '[class*="hero"]',
    '[id*="hero"]',
    '[class*="masthead"]',
    '[class*="banner"]',
  ]);

  if (!hero) {
    const body = ensureBody($);
    const main = firstExistingSelection($, ["main", "article", '[role="main"]']) ?? body;
    const generatedHero = $("<section data-rebuild-generated=\"hero\"></section>");
    main.prepend(generatedHero);
    hero = generatedHero;
  }

  const headingText =
    heroSection.content_blocks.find((block) => block.type === "heading")?.value ||
    mappedPage.seo.h1;
  const paragraphText =
    heroSection.content_blocks.find((block) => block.type === "paragraph")?.value ||
    mappedPage.seo.meta_description;
  const cta = heroSection.ctas[0];

  const heroHeading = hero.find("h1").first();
  if (heroHeading.length > 0) {
    heroHeading.text(headingText);
  } else {
    const headingNode = $("<h1></h1>");
    headingNode.text(headingText);
    hero.prepend(headingNode);
  }

  if (paragraphText) {
    const heroParagraph = hero.find("p").first();
    if (heroParagraph.length > 0) {
      heroParagraph.text(paragraphText);
    } else {
      const paragraphNode = $("<p></p>");
      paragraphNode.text(paragraphText);
      hero.append(paragraphNode);
    }
  }

  if (cta) {
    const heroCta = hero.find("a, button").first();
    if (heroCta.length > 0) {
      heroCta.text(cta.label);
      heroCta.attr("href", sanitizeHref(cta.href));
    } else {
      const ctaNode = $("<a></a>");
      ctaNode.addClass("rebuild-cta");
      ctaNode.attr("href", sanitizeHref(cta.href));
      ctaNode.text(cta.label);
      hero.append(ctaNode);
    }
  }
}

function isContactSection(section: MappedPagePayload["sections"][number]) {
  const key = section.slot_key.toLowerCase();
  const label = section.label.toLowerCase();
  return (
    key.includes("contact") ||
    key.includes("hours") ||
    label.includes("contact") ||
    label.includes("hours")
  );
}

function appendSupportingSections($: ReturnType<typeof load>, mappedPage: MappedPagePayload) {
  const contentSections = mappedPage.sections.filter((section) => {
    const key = section.slot_key.toLowerCase();
    return !key.includes("hero") && !isContactSection(section);
  });

  const contactSections = mappedPage.sections.filter(isContactSection);

  const main = firstExistingSelection($, ["main", "article", '[role="main"]']);
  const body = ensureBody($);
  const contentTarget = main ?? body;

  for (const section of contentSections) {
    contentTarget.append(buildSectionMarkup(section));
  }

  if (contactSections.length > 0) {
    const footerOrContact = firstExistingSelection($, ["footer", '[class*="contact"]', '[id*="contact"]']) ?? body;
    for (const section of contactSections) {
      footerOrContact.append(buildSectionMarkup(section));
    }
  }
}

export function rebuildDestinationHtml(input: DestinationRebuildInput): RebuiltPagePayload {
  const $ = load(input.templateHtml);

  updateHead($, input.mappedPage);
  updateHeroRegion($, input.mappedPage);
  appendSupportingSections($, input.mappedPage);

  return {
    templatePath: input.templatePath,
    html: $.html(),
    confidence: input.confidence,
  };
}
