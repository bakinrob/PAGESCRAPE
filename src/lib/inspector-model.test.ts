import { describe, expect, it } from "vitest";

import { buildInspectorModel } from "@/lib/inspector-model";

describe("inspector model", () => {
  it("includes template match, seo, assets, and warnings", () => {
    const model = buildInspectorModel({ page: { url: "https://example.com" } as never });

    expect(model.sections.map((section) => section.key)).toEqual(
      expect.arrayContaining(["template-match", "assets", "seo", "source-signals", "warnings"]),
    );
  });
});
