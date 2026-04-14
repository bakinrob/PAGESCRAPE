import type { PageResult, TemplateTemplateMatch } from "@/lib/types";

export interface InspectorEntry {
  label: string;
  value: string;
}

export interface InspectorAsset {
  title: string;
  subtitle?: string;
  detail: string;
}

export interface InspectorSection {
  key: "template-match" | "assets" | "seo" | "source-signals" | "warnings";
  title: string;
  entries?: InspectorEntry[];
  badges?: string[];
  assets?: InspectorAsset[];
  messages?: string[];
}

export function buildInspectorModel(input: {
  page: PageResult;
  pairing?: TemplateTemplateMatch;
  previewWarnings?: string[];
  jobWarnings?: string[];
}) {
  const extracted = input.page.extracted;
  const warnings = [
    ...(extracted?.validation.warnings ?? []),
    ...(input.previewWarnings ?? []),
    ...(input.jobWarnings ?? []),
  ].filter((warning, index, list) => warning && list.indexOf(warning) === index);

  const sections: InspectorSection[] = [
    {
      key: "template-match",
      title: "Template Match",
      entries: [
        {
          label: "Template",
          value:
            input.pairing?.templatePath ||
            input.page.rebuilt?.templatePath ||
            "Awaiting destination match",
        },
        {
          label: "Confidence",
          value: input.pairing
            ? `${Math.round(input.pairing.confidence * 100)}%`
            : input.page.rebuilt
              ? `${Math.round(input.page.rebuilt.confidence * 100)}%`
              : "Unavailable",
        },
        {
          label: "Reasons",
          value: input.pairing?.reasons.length
            ? input.pairing.reasons.slice(0, 3).join(" • ")
            : "No pairing rationale captured.",
        },
      ],
      badges: input.pairing?.alternatives.slice(0, 4) ?? [],
    },
    {
      key: "assets",
      title: "Assets",
      assets:
        extracted?.media.slice(0, 10).map((asset) => ({
          title: asset.alt || asset.role,
          subtitle: asset.role,
          detail: asset.url,
        })) ?? [],
    },
    {
      key: "seo",
      title: "SEO",
      entries: [
        { label: "Title", value: extracted?.seo.title || "Unavailable" },
        { label: "Meta", value: extracted?.seo.meta_description || "Unavailable" },
        { label: "H1", value: extracted?.seo.h1 || "Unavailable" },
        { label: "Canonical", value: extracted?.seo.canonical_url || input.page.url },
        { label: "OG title", value: extracted?.seo.og_title || "Unavailable" },
        { label: "OG description", value: extracted?.seo.og_description || "Unavailable" },
      ],
    },
    {
      key: "source-signals",
      title: "Source Signals",
      assets:
        extracted?.links.slice(0, 10).map((link) => ({
          title: link.text || link.href,
          subtitle: link.kind,
          detail: link.href,
        })) ?? [],
    },
    {
      key: "warnings",
      title: "Warnings",
      messages: warnings,
    },
  ];

  return { sections };
}
