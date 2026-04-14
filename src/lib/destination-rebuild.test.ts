import { describe, expect, it } from "vitest";

import { rebuildDestinationHtml } from "@/lib/destination-rebuild";

describe("rebuildDestinationHtml", () => {
  it("injects mapped seo, hero, cta, and contact content into the template", () => {
    const result = rebuildDestinationHtml({
      templateHtml: `
        <html>
          <head>
            <title>Template Title</title>
          </head>
          <body>
            <header class="hero">
              <h1>Placeholder Heading</h1>
              <p>Placeholder intro.</p>
              <a class="primary-cta" href="/inventory">View Inventory</a>
            </header>
            <main>
              <section class="content">
                <h2>Content heading</h2>
                <p>Content copy.</p>
              </section>
            </main>
            <footer class="contact">
              <p>Contact details.</p>
            </footer>
          </body>
        </html>
      `,
      templatePath: "templates/home.html",
      confidence: 0.84,
      mappedPage: {
        dealer_name: "Demo Dealer",
        oem_preset: "dealer-static-reference",
        source_url: "https://example.com/",
        page_type: "homepage",
        template: {
          preset: "dealer-static-reference",
          page_layout: "home",
          version: "1",
        },
        seo: {
          locked: false,
          title: "Demo Dealer | New and Used Cars",
          meta_description: "Shop new and used vehicles.",
          h1: "Welcome to Demo Dealer",
          canonical_url: "https://example.com/",
          og_title: "Demo Dealer",
          og_description: "Shop new and used vehicles.",
          og_image: "https://example.com/og.jpg",
        },
        sections: [
          {
            slot_key: "hero",
            label: "Hero",
            required: true,
            status: "mapped",
            source_section_keys: ["hero"],
            content_blocks: [
              { type: "heading", value: "Welcome to Demo Dealer" },
              { type: "paragraph", value: "Shop new and used vehicles." },
            ],
            ctas: [{ label: "Browse inventory", href: "/inventory/new" }],
            media_refs: [],
          },
          {
            slot_key: "contact",
            label: "Contact",
            required: false,
            status: "mapped",
            source_section_keys: ["contact"],
            content_blocks: [{ type: "address_block", value: "123 Main St" }],
            ctas: [{ label: "Call sales", href: "tel:5551234567" }],
            media_refs: [],
          },
        ],
        validation: {
          seo_status: "green",
          warnings: [],
          errors: [],
        },
        confidence_notes: [],
      },
    });

    expect(result.templatePath).toBe("templates/home.html");
    expect(result.confidence).toBe(0.84);
    expect(result.html).toContain("<title>Demo Dealer | New and Used Cars</title>");
    expect(result.html).toContain("Welcome to Demo Dealer");
    expect(result.html).toContain('href="/inventory/new"');
    expect(result.html).toContain("123 Main St");
    expect(result.html).toContain('href="tel:5551234567"');
  });
});
