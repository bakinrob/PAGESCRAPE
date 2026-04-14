import JSZip from "jszip";

import type {
  ExportBundle,
  ExtractedPagePayload,
  MappedContentBlock,
  MappedPagePayload,
  MappedSection,
} from "@/lib/types";

const FORD_OVAL_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 256" role="img" aria-labelledby="title desc"><title id="title">Ford Oval</title><desc id="desc">Blue oval badge used as a Ford brand mark</desc><defs><linearGradient id="fordBlue" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#0058a8" /><stop offset="100%" stop-color="#003478" /></linearGradient></defs><ellipse cx="256" cy="128" rx="244" ry="116" fill="#ffffff" /><ellipse cx="256" cy="128" rx="236" ry="108" fill="url(#fordBlue)" /><ellipse cx="256" cy="128" rx="214" ry="86" fill="none" stroke="#ffffff" stroke-width="10" opacity="0.95" /><text x="256" y="148" fill="#ffffff" font-family="Brush Script MT, Segoe Script, cursive" font-size="88" font-weight="700" text-anchor="middle">Ford</text></svg>';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function renderBlock(block: MappedContentBlock) {
  const value = escapeHtml(block.value).replace(/\n/g, "<br />");

  switch (block.type) {
    case "heading":
      return `<h3>${value}</h3>`;
    case "bullet_list": {
      const items = block.value
        .split(/\n|-/)
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => `<li>${escapeHtml(item)}</li>`)
        .join("");
      return `<ul>${items}</ul>`;
    }
    case "review_snippet":
      return `<blockquote>${value}</blockquote>`;
    case "address_block":
    case "phone_block":
      return `<div class="detail-block">${value}</div>`;
    default:
      return `<p>${value}</p>`;
  }
}

function renderCtas(section: MappedSection) {
  if (section.ctas.length === 0) return "";

  return `<div class="cta-row">${section.ctas
    .slice(0, 4)
    .map((cta) => `<a class="cta" href="${escapeHtml(cta.href)}">${escapeHtml(cta.label)}</a>`)
    .join("")}</div>`;
}

function renderSection(section: MappedSection) {
  const media = section.media_refs[0]
    ? `<img class="section-media" src="${escapeHtml(section.media_refs[0])}" alt="${escapeHtml(section.label)}" />`
    : "";

  return `
    <section class="slot">
      ${media}
      <div class="section-meta">
        <span>${escapeHtml(section.label)}</span>
        <span>${escapeHtml(section.status.replaceAll("_", " "))}</span>
      </div>
      <div class="slot-body">
        ${section.content_blocks.map(renderBlock).join("")}
        ${renderCtas(section)}
      </div>
    </section>
  `;
}

function firstLines(section: MappedSection | undefined, limit = 3) {
  if (!section) return [];

  return section.content_blocks
    .filter((block) =>
      ["paragraph", "phone_block", "address_block", "review_snippet"].includes(block.type),
    )
    .flatMap((block) => block.value.split(/\n/))
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function firstImage(section: MappedSection | undefined) {
  return section?.media_refs[0] || "";
}

function renderMappedPageHtml(mapped: MappedPagePayload) {
  const title = mapped.seo.title || mapped.seo.h1 || mapped.source_url;
  const description = mapped.seo.meta_description || "";
  const heroSection = mapped.sections[0];
  const contactSection =
    mapped.sections.find((section) => section.slot_key.includes("contact")) ||
    mapped.sections.find((section) => section.slot_key.includes("address")) ||
    mapped.sections.find((section) => section.slot_key.includes("footer"));
  const heroCtas = heroSection?.ctas.slice(0, 2) ?? [];
  const topLines = firstLines(contactSection, 3);
  const heroImage = firstImage(heroSection);
  const brandName = escapeHtml(mapped.dealer_name || "Ford Dealer");

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta property="og:title" content="${escapeHtml(mapped.seo.og_title || title)}" />
    <meta property="og:description" content="${escapeHtml(mapped.seo.og_description || description)}" />
    ${mapped.seo.og_image ? `<meta property="og:image" content="${escapeHtml(mapped.seo.og_image)}" />` : ""}
    ${mapped.seo.canonical_url ? `<link rel="canonical" href="${escapeHtml(mapped.seo.canonical_url)}" />` : ""}
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@600;700;800&display=swap" rel="stylesheet" />
    <style>
      :root {
        color-scheme: light;
        --bg: #f4f6f9;
        --panel: #ffffff;
        --panel-soft: #f3f4f5;
        --text: #16181d;
        --muted: #5c6778;
        --line: #e1e5ec;
        --accent: #0072ce;
        --brand: #003478;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Barlow, ui-sans-serif, system-ui, sans-serif;
        background:
          radial-gradient(circle at top left, rgba(0, 114, 206, 0.08), transparent 24%),
          linear-gradient(180deg, #f7f8fb, #eef2f7 38%, #f7f8fb);
        color: var(--text);
      }
      .page {
        width: min(1240px, calc(100vw - 40px));
        margin: 32px auto 72px;
      }
      .topbar {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        gap: 10px 18px;
        min-height: 38px;
        padding: 10px 18px;
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 20px 20px 0 0;
        background: #16181d;
        color: rgba(255,255,255,0.82);
        font-size: 0.74rem;
        font-weight: 600;
        letter-spacing: 0.03em;
        text-transform: uppercase;
      }
      .topbar-group {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
      }
      .hero-shell {
        overflow: hidden;
        border-radius: 0 0 28px 28px;
        border: 1px solid var(--line);
        border-top: 0;
        background: #0f1420;
        box-shadow: 0 30px 70px rgba(15,23,42,0.09);
      }
      .brand-row {
        display: flex;
        align-items: center;
        gap: 14px;
        min-height: 82px;
        padding: 0 28px;
        background: rgba(255,255,255,0.96);
        border-bottom: 1px solid rgba(225,229,236,0.92);
      }
      .brand-row img {
        width: 72px;
        height: auto;
      }
      .brand-copy {
        display: flex;
        flex-direction: column;
        line-height: 0.86;
      }
      .brand-copy strong {
        font-family: "Barlow Condensed", Barlow, sans-serif;
        font-size: 2rem;
        font-weight: 800;
        letter-spacing: -0.04em;
        color: var(--brand);
      }
      .brand-copy span {
        margin-top: 4px;
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.18em;
        font-size: 0.72rem;
        font-weight: 700;
      }
      .hero {
        position: relative;
        overflow: hidden;
        padding: 44px 28px 52px;
        background:
          linear-gradient(90deg, rgba(0, 16, 39, 0.84), rgba(0, 16, 39, 0.34) 58%),
          ${heroImage ? `url("${escapeHtml(heroImage)}") center / cover no-repeat` : "linear-gradient(135deg, #0a2a5c, #00152f 68%)"};
        color: #ffffff;
      }
      .eyebrow {
        display: inline-flex;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.18);
        color: #8bd4ff;
        background: rgba(255,255,255,0.1);
        text-transform: uppercase;
        letter-spacing: 0.18em;
        font-size: 12px;
        font-weight: 700;
      }
      h1 {
        margin: 18px 0 0;
        font-family: "Barlow Condensed", Barlow, sans-serif;
        font-size: clamp(2.6rem, 5vw, 4.2rem);
        line-height: 0.98;
        text-transform: uppercase;
        color: #ffffff;
      }
      .hero p {
        margin: 18px 0 0;
        max-width: 70ch;
        line-height: 1.85;
        color: rgba(255,255,255,0.84);
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
        gap: 20px;
        margin-top: 24px;
      }
      .slot {
        overflow: hidden;
        border-radius: 24px;
        border: 1px solid var(--line);
        background: var(--panel);
      }
      .section-media {
        display: block;
        width: 100%;
        height: 240px;
        object-fit: cover;
        background: #dfe6ef;
      }
      .section-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding: 18px 20px 0;
      }
      .section-meta span {
        border-radius: 999px;
        border: 1px solid var(--line);
        padding: 7px 12px;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.16em;
        color: var(--brand);
        background: var(--panel-soft);
      }
      .slot-body { padding: 18px 20px 22px; }
      h3 {
        margin: 8px 0 0;
        font-family: "Barlow Condensed", Barlow, sans-serif;
        font-size: 1.7rem;
        line-height: 1.12;
        text-transform: uppercase;
      }
      p, li, blockquote, .detail-block {
        color: var(--muted);
        line-height: 1.8;
        font-size: 0.98rem;
      }
      ul {
        margin: 14px 0 0;
        padding-left: 18px;
      }
      blockquote, .detail-block {
        margin: 14px 0 0;
        border-radius: 16px;
        border: 1px solid var(--line);
        padding: 14px 16px;
        background: var(--panel-soft);
      }
      .cta-row {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 18px;
      }
      .cta {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 44px;
        padding: 0 18px;
        border-radius: 999px;
        border: 1px solid var(--accent);
        background: var(--accent);
        color: white;
        text-decoration: none;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        font-size: 12px;
      }
      .footer-note {
        margin-top: 26px;
        padding: 18px 20px;
        border-radius: 20px;
        border: 1px solid var(--line);
        background: var(--panel);
        color: var(--muted);
        font-size: 0.95rem;
        line-height: 1.8;
      }
      @media (max-width: 760px) {
        .page {
          width: min(1240px, calc(100vw - 24px));
          margin-top: 18px;
        }
        .brand-row {
          padding-inline: 18px;
        }
        .hero {
          padding-inline: 18px;
        }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <header class="topbar">
        <div class="topbar-group">${topLines.map((line) => `<span>${escapeHtml(line)}</span>`).join("")}</div>
        <div class="topbar-group"><span>Provider-ready HTML export</span><span>${escapeHtml(mapped.page_type)}</span></div>
      </header>
      <section class="hero-shell">
        <div class="brand-row">
          <img src="../ford-oval.svg" alt="Ford" />
          <div class="brand-copy">
            <strong>${brandName.toUpperCase()}</strong>
            <span>Ford template rebuild</span>
          </div>
        </div>
        <div class="hero">
          <span class="eyebrow">${escapeHtml(mapped.template.preset)} - ${escapeHtml(mapped.page_type)}</span>
          <h1>${escapeHtml(mapped.seo.h1 || mapped.seo.title)}</h1>
          <p>${escapeHtml(description)}</p>
          ${heroCtas.length > 0 ? `<div class="cta-row">${heroCtas.map((cta) => `<a class="cta" href="${escapeHtml(cta.href)}">${escapeHtml(cta.label)}</a>`).join("")}</div>` : ""}
        </div>
      </section>
      <section class="grid">
        ${mapped.sections.map(renderSection).join("")}
      </section>
      <div class="footer-note">
        Rebuilt from ${escapeHtml(mapped.source_url)} with preserved SEO metadata. Provider-ready HTML export - adapt into the destination CMS or template system.
      </div>
    </main>
  </body>
</html>`;
}

function filenameBase(bundle: ExportBundle) {
  return (
    slugify(bundle.manifest.dealerName || bundle.manifest.homepageUrl || "ford-dealer") ||
    "ford-dealer"
  );
}

function buildAssetsManifest(extractedPages: ExtractedPagePayload[], mappedPages: MappedPagePayload[]) {
  return extractedPages.map((page) => {
    const mapped = mappedPages.find((candidate) => candidate.source_url === page.source.url);
    return {
      sourceUrl: page.source.url,
      pageType: page.classification.page_type,
      sourceAccess: page.source.access_method,
      seo: page.seo,
      extractedAssets: page.media,
      mappedAssetRefs: mapped?.sections.flatMap((section) => section.media_refs) ?? [],
    };
  });
}

export async function buildHtmlExportArchive(bundle: ExportBundle) {
  const zip = new JSZip();
  const base = filenameBase(bundle);
  const assetsManifest = buildAssetsManifest(bundle.extractedPages, bundle.mappedPages);

  zip.file(
    "README.txt",
    [
      "Ford static page migration bundle",
      "",
      "Contents:",
      "- pages/: provider-ready HTML for each supported rebuilt page",
      "- data/manifest.json: overall job manifest",
      "- data/extracted-pages.json: structured source extraction",
      "- data/mapped-pages.json: template-mapped output",
      "- data/assets-manifest.json: referenced image/meta assets per page",
      "",
      "This bundle is designed for an engineer to adapt into the destination CMS/template system.",
    ].join("\n"),
  );

  zip.file("data/manifest.json", JSON.stringify(bundle.manifest, null, 2));
  zip.file("data/extracted-pages.json", JSON.stringify(bundle.extractedPages, null, 2));
  zip.file("data/mapped-pages.json", JSON.stringify(bundle.mappedPages, null, 2));
  zip.file("data/assets-manifest.json", JSON.stringify(assetsManifest, null, 2));
  zip.file("pages/ford-oval.svg", FORD_OVAL_SVG);

  bundle.mappedPages.forEach((page) => {
    const pageName =
      slugify(`${page.page_type}-${page.seo.h1 || page.seo.title || page.source_url}`) ||
      page.page_type;
    zip.file(`pages/${pageName}.html`, renderMappedPageHtml(page));
  });

  const content = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

  return {
    filename: `${base}-template-rebuild-bundle.zip`,
    content,
  };
}
