# Ford Dealer Scraper Wizard

Ford-only, local-demo-first Next.js POC for scraping dealer-authored CMS pages, validating SEO lock, previewing a Varsity-style rebuild, and exporting a JSON bundle.

## What it does

- Guides the user through one wizard flow: `Setup -> Scrape -> Review -> Export`
- Scrapes real Ford dealer URLs with `direct_http` first
- Falls back to `browser_rendered` capture when dealer sites block direct scraping
- Classifies only supported CMS pages for v1:
  - `homepage`
  - `about`
  - `staff`
  - `contact`
  - `hours`
  - `service`
  - `finance`
  - `specials`
  - `trade_appraisal`
  - `research_model`
  - `local_seo_landing`
- Explicitly rejects:
  - `unsupported_inventory_srp`
  - `unsupported_vehicle_vdp`
  - `unsupported_checkout`
  - `unsupported_other`
- Preserves SEO fields under lock:
  - `title`
  - `meta_description`
  - `h1`
  - `canonical_url`
  - `og_title`
  - `og_description`
  - `og_image`
- Exports schema-validated extracted and mapped payloads

## Source of truth

This app depends on the sibling Ford skill pack:

- `../ford-dealer-template-migration`

It loads the existing schemas from:

- `../ford-dealer-template-migration/assets/extracted-page.schema.json`
- `../ford-dealer-template-migration/assets/mapped-page.schema.json`

The page taxonomy and mapping rules were ported from the same skill pack so the app and skill stay aligned.

## Run locally

Install dependencies:

```bash
npm install
npx playwright install chromium
```

Start in development:

```bash
npm run dev
```

Or build and run production:

```bash
npm run build
npm run start -- --port 3005
```

Open:

- `http://localhost:3000` for dev
- `http://localhost:3005` for the production start command above

## Main files

- [src/app/page.tsx](./src/app/page.tsx)
- [src/components/ford-scraper-app.tsx](./src/components/ford-scraper-app.tsx)
- [src/components/template-preview.tsx](./src/components/template-preview.tsx)
- [src/lib/pipeline.ts](./src/lib/pipeline.ts)
- [src/lib/classification.ts](./src/lib/classification.ts)
- [src/lib/preset.ts](./src/lib/preset.ts)
- [src/lib/job-store.ts](./src/lib/job-store.ts)

## API routes

- `POST /api/jobs`
  - Starts a scrape job
- `GET /api/jobs/:jobId`
  - Polls job state
- `GET /api/jobs/:jobId/export`
  - Downloads the JSON export bundle

## Job flow

1. Accept dealer name, URLs, SEO lock state, and preset.
2. Fetch source HTML with direct HTTP.
3. If blocked, retry via Playwright browser rendering.
4. Extract SEO, sections, links, and media.
5. Classify the page type.
6. Validate SEO status.
7. Map supported pages into the `ford-varsity` slot model.
8. Validate extracted and mapped payloads against the skill-pack schemas.
9. Return review-ready page objects and export bundle data.

## Export bundle

The export contains:

- `manifest`
- `extractedPages`
- `mappedPages`

Unsupported URLs still appear in `extractedPages`, but they are excluded from `mappedPages`.

## Notes

- This is intentionally a single monolith with in-memory job state for demo speed.
- No auth, database, or job persistence is included in v1.
- The browser fallback path is important for Ford/Dealer Inspire sites that block raw requests.
