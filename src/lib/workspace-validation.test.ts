import { describe, expect, it } from "vitest";

import { buildNeedsReviewWarnings, isOutOfScopePage, validatePairing } from "@/lib/workspace-validation";

describe("workspace validation", () => {
  it("warns when confidence is below threshold", () => {
    const result = validatePairing({
      confidence: 0.42,
      templatePath: "service.html",
      alternatives: [],
      reasons: [],
    });

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.needsReview).toBe(true);
  });

  it("marks unsupported page types as out of scope", () => {
    expect(isOutOfScopePage("unsupported_vehicle_vdp")).toBe(true);
    expect(isOutOfScopePage("service")).toBe(false);
  });

  it("builds review warnings from ambiguity notes and template alternatives", () => {
    const warnings = buildNeedsReviewWarnings({
      page: {
        extracted: {
          classification: {
            ambiguity_notes: ["Source content overlaps multiple destinations."],
          },
        },
      } as never,
      pairing: {
        confidence: 0.76,
        templatePath: "service.html",
        alternatives: ["contact.html"],
        reasons: [],
      } as never,
    });

    expect(warnings).toEqual(
      expect.arrayContaining([
        "Source content overlaps multiple destinations.",
        "Alternative destination templates detected: contact.html.",
      ]),
    );
  });
});
