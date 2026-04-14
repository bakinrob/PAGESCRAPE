import { UNSUPPORTED_PAGE_TYPES, type PageResult, type PageType, type TemplateTemplateMatch } from "@/lib/types";

const LOW_CONFIDENCE_THRESHOLD = 0.7;
const REVIEW_CONFIDENCE_THRESHOLD = 0.82;

export function isOutOfScopePage(pageType: PageType) {
  return UNSUPPORTED_PAGE_TYPES.includes(pageType as (typeof UNSUPPORTED_PAGE_TYPES)[number]);
}

export function validatePairing(pairing: Pick<TemplateTemplateMatch, "confidence" | "templatePath" | "alternatives" | "reasons">) {
  const warnings: string[] = [];
  const lowConfidence = pairing.confidence < LOW_CONFIDENCE_THRESHOLD;
  const needsReview = lowConfidence || pairing.alternatives.length > 0 || pairing.confidence < REVIEW_CONFIDENCE_THRESHOLD;

  if (lowConfidence) {
    warnings.push(
      `Template match for ${pairing.templatePath} is low confidence at ${Math.round(pairing.confidence * 100)}%.`,
    );
  }

  if (pairing.alternatives.length > 0) {
    warnings.push(
      `Alternative destination templates detected: ${pairing.alternatives.slice(0, 3).join(", ")}.`,
    );
  }

  if (pairing.reasons.some((reason) => reason.includes("nearest confidence fallback"))) {
    warnings.push(`Fallback pairing was used for ${pairing.templatePath}.`);
  }

  return {
    lowConfidence,
    needsReview,
    warnings,
  };
}

export function buildNeedsReviewWarnings(input: {
  page: PageResult;
  pairing?: TemplateTemplateMatch;
}) {
  const warnings = [...(input.page.extracted?.classification.ambiguity_notes ?? [])];

  if (input.pairing) {
    warnings.push(...validatePairing(input.pairing).warnings);
  }

  return warnings.filter((warning, index, list) => warning && list.indexOf(warning) === index);
}
