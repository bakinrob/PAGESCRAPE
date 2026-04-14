import type { TemplateFileDetection } from "@/lib/template-detection";
import type { SupportedPageType, TemplateTemplateMatch } from "@/lib/types";

export interface TemplatePairingSourcePage {
  pageId: string;
  pageType: SupportedPageType;
  confidence: number;
  reasons: string[];
}

type TemplatePairingFile = Pick<
  TemplateFileDetection,
  "path" | "pageType" | "confidence" | "reasons" | "alternatives"
>;

function uniqueStrings(values: string[]) {
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index);
}

function formatTemplateLabel(template: TemplatePairingFile) {
  const pageType = template.pageType ?? "unknown";
  return `${template.path} (${pageType}, ${(template.confidence * 100).toFixed(0)}% confidence)`;
}

function buildCandidateReasons(
  sourcePage: TemplatePairingSourcePage,
  templateFile: TemplatePairingFile,
  mode: "exact" | "fallback",
) {
  return uniqueStrings([
    mode === "exact"
      ? `exact page-type match for ${sourcePage.pageType}`
      : `nearest confidence fallback for ${sourcePage.pageType}`,
    `source confidence ${(sourcePage.confidence * 100).toFixed(0)}%`,
    `template confidence ${(templateFile.confidence * 100).toFixed(0)}%`,
    ...sourcePage.reasons.map((reason) => `source: ${reason}`),
    ...templateFile.reasons.map((reason) => `template: ${reason}`),
  ]);
}

function scoreExactTemplate(
  sourcePage: TemplatePairingSourcePage,
  templateFile: TemplatePairingFile,
) {
  return {
    confidence: Number((((sourcePage.confidence + templateFile.confidence) / 2) || 0).toFixed(2)),
    distance: Math.abs(sourcePage.confidence - templateFile.confidence),
    templateFile,
  };
}

function scoreFallbackTemplate(
  sourcePage: TemplatePairingSourcePage,
  templateFile: TemplatePairingFile,
) {
  const distance = Math.abs(sourcePage.confidence - templateFile.confidence);
  return {
    confidence: Number(Math.max(0, 1 - distance).toFixed(2)),
    distance,
    templateFile,
  };
}

function rankTemplates(
  sourcePage: TemplatePairingSourcePage,
  templateFiles: TemplatePairingFile[],
) {
  const exactMatches = templateFiles
    .filter((templateFile) => templateFile.pageType === sourcePage.pageType)
    .map((templateFile) => scoreExactTemplate(sourcePage, templateFile))
    .sort((left, right) => {
      if (right.templateFile.confidence !== left.templateFile.confidence) {
        return right.templateFile.confidence - left.templateFile.confidence;
      }

      return left.templateFile.path.localeCompare(right.templateFile.path);
    });

  const fallbackMatches = templateFiles
    .map((templateFile) => scoreFallbackTemplate(sourcePage, templateFile))
    .sort((left, right) => {
      if (left.distance !== right.distance) {
        return left.distance - right.distance;
      }

      if (right.templateFile.confidence !== left.templateFile.confidence) {
        return right.templateFile.confidence - left.templateFile.confidence;
      }

      return left.templateFile.path.localeCompare(right.templateFile.path);
    });

  const mode: "exact" | "fallback" = exactMatches.length > 0 ? "exact" : "fallback";

  return {
    mode,
    ranked:
      exactMatches.length > 0
        ? [
            ...exactMatches,
            ...fallbackMatches.filter(
              (candidate) =>
                !exactMatches.some(
                  (exactCandidate) => exactCandidate.templateFile.path === candidate.templateFile.path,
                ),
            ),
          ]
        : fallbackMatches,
  };
}

export function pairSourcePagesToTemplates(
  sourcePages: TemplatePairingSourcePage[],
  templateFiles: TemplatePairingFile[],
): TemplateTemplateMatch[] {
  if (sourcePages.length === 0 || templateFiles.length === 0) {
    return [];
  }

  return sourcePages
    .map((sourcePage) => {
      const ranked = rankTemplates(sourcePage, templateFiles);
      const selected = ranked.ranked[0];

      if (!selected) {
        return undefined;
      }

      return {
        pageId: sourcePage.pageId,
        sourcePageType: sourcePage.pageType,
        templatePath: selected.templateFile.path,
        confidence: selected.confidence,
        reasons: buildCandidateReasons(sourcePage, selected.templateFile, ranked.mode),
        alternatives: ranked.ranked
          .slice(1, 4)
          .map((candidate) => formatTemplateLabel(candidate.templateFile)),
      } satisfies TemplateTemplateMatch;
    })
    .filter((match): match is TemplateTemplateMatch => Boolean(match));
}
