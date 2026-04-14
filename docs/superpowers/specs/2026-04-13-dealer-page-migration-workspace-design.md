# Dealer Page Migration Workspace Design

Date: 2026-04-13
Repo: `ford-scraper-wizard`
Status: Approved design, ready for implementation planning after user review

## Summary

Reposition the current Ford scraper demo into an OEM-agnostic provider-facing `Dealer Page Migration Workspace`.

The product is not a generic scraper and not a template-authoring studio. It is a migration system for dealer website providers that:

- ingests legacy dealer static pages
- ingests a destination template package as a `.zip`
- detects destination page templates automatically
- maps source page content into the destination template structure
- preserves SEO-critical fields automatically
- exports provider-ready HTML, assets, and a validation manifest

The first presentation target is Ford, using Varsity Ford as the proof-of-concept source site and a Ford-style destination template package, but the product architecture must remain OEM-agnostic. Ford is the first reference implementation, not the product boundary.

## Product Framing

### What this is

A migration workspace for automotive website providers switching a dealer from one website/CMS/template system to another.

The workspace must be able to ingest a destination template package for any OEM or dealer brand and infer the right destination structure from that package rather than assuming Ford-specific output.

### What this is not

- not a full website builder
- not a consumer-facing site editor
- not an inventory migration engine
- not a VDP/SRP/feed reconstruction system
- not a pure AI page generator

### Positioning sentence

`Bring in the legacy static dealer pages and the destination template package. The workspace rebuilds the dealer's static site layer into the new provider structure and exports a provider-ready handoff bundle.`

## Product Scope

### Supported page types

- homepage
- about
- service
- finance
- contact
- hours
- specials
- trade appraisal
- other static CMS pages with stable source HTML

### Explicitly excluded

- inventory search results pages
- vehicle detail pages
- SRPs
- feed-driven content areas
- checkout or payment flows
- authenticated customer tools

### Guardrail principle

The system should only rebuild pages it can classify and map safely. Unsafe or ambiguous pages should be marked for review rather than silently fabricated.

## User Goals

### Primary buyer goal

Reduce manual migration effort when a dealer changes website providers or template systems.

### Demo goal

Show a polished flow that is understandable in under 30 seconds and credible to both business stakeholders and the receiving engineering/content team.

### Operator goal

Run a migration job without having to hand-author placeholders or rework the destination template package first.

## Recommended Product Shape

Use a `migration workspace` rather than a wizard or template studio.

### Rejected alternatives

#### Guided wizard

Pros:

- easy for first-time users

Cons:

- too click-heavy for sales demos
- weak for side-by-side review
- hides the relationship between source pages, destination templates, and export artifacts

#### Template studio

Pros:

- powerful long term

Cons:

- expands scope into authoring and editing
- distracts from the migration story
- too large for the current presentation and build cycle

### Recommended structure

- screen 1: orientation
- screen 2: main migration workspace

## Screen Architecture

### Orientation Screen

Purpose: frame the product clearly and start a job.

### Main content

- title: `Static Page Migration for Dealer Website Providers`
- source input block
- destination template package upload block
- compact supported-scope summary
- short explainer row for the migration flow
- one primary call to action: `Start migration workspace`

### Source input

Support both:

- homepage URL
- exact static page URLs

Homepage remains the cleanest default for presentation, but exact URLs must remain available because the buyer explicitly asked for targeted page migration.

### Template package upload

Primary input mode:

- one `.zip` upload

The zip may contain:

- `*.html`
- `*.css`
- `*.js`
- `assets/`
- optional `manifest.json`

### Orientation copy principles

- provider-facing language
- no visible `SEO lock` terminology
- no generic scraping language
- emphasize handoff and migration

### Main Workspace

Purpose: run the job, inspect detection, review rebuilds, and export artifacts.

### Layout

- left rail: source pages and status
- top bar: job identity and global actions
- center compare canvas: source page vs rebuilt destination page
- right inspector: technical details and warnings

### Left rail

Each page entry should show:

- page label or type
- source URL
- status
- detected destination template match
- warning badge if present

### Top bar

Include:

- dealer/job name
- uploaded template package name
- primary export action
- compare fullscreen action
- inspector toggle

### Compare canvas

Two persistent panes:

- `Source Page`
- `Rebuilt Destination Page`

The rebuilt pane should look publishable, not like a slot-card preview.

### Inspector

The inspector should be page-scoped and non-blocking.

Sections:

- `Template Match`
- `Assets`
- `SEO`
- `Source Signals`
- `Warnings`

The inspector replaces older bottom-of-screen clutter and should not dominate the primary comparison.

## Core Workflow

1. User starts a job from the orientation screen.
2. System ingests source URLs and template package zip.
3. System extracts and indexes source pages.
4. System extracts and indexes template package files.
5. System classifies both sides by page type.
6. System pairs each source page to the best destination template.
7. System rebuilds mapped content into the destination HTML structure.
8. User reviews source vs rebuilt pages.
9. User inspects warnings, template matches, and SEO fields if needed.
10. User exports the provider-ready handoff bundle.

## Template Package Engine

### Input Contract

The template package should not require a manifest to work.

### Required behavior

- ingest one `.zip`
- extract it into a job workspace
- index all HTML files
- detect shared assets and shared layout files
- infer package brand/OEM signals from filenames, headings, asset paths, metadata, and optional manifest content
- support optional `manifest.json` when provided

### Manifest behavior

- if a manifest exists, it acts as an override and hint source
- if no manifest exists, heuristics are the primary detection mechanism

This keeps the product usable for real agency handoffs, which often do not arrive as perfectly prepared placeholder systems.

### Template Detection

Each HTML file in the uploaded package should be classified into likely page types using:

- filename patterns
- `<title>`
- primary headings
- nav labels
- hero copy
- repeated structural markers
- internal links

Expected output:

- `homepage -> home.html`
- `service -> service.html`
- `contact -> contact-us.html`
- etc.

The system should also identify:

- likely shared asset directories
- shared CSS or layout dependencies
- likely OEM or brand identity for the destination package
- duplicate or ambiguous candidate templates

### Source Page Detection

Source pages should use the existing classification approach already present in the current Ford demo as the starting point for a normalized static-page taxonomy:

- homepage
- about
- service
- finance
- contact
- hours
- specials
- trade appraisal
- other static page types when safely inferable

The current classification work can be reused, but it must feed the new template-package pairing system rather than only a hardcoded in-app template renderer. Source classification should remain normalized across OEMs even if Ford is the first deeply modeled example.

### Pairing Logic

The system should create a pairing between:

- classified source page
- classified destination template page

### Pairing rules

- prefer exact page-type matches
- fall back to nearest template candidate when no exact match exists
- surface ambiguity clearly in the inspector
- never silently pretend a low-confidence match is safe

### Confidence model

Each pairing should carry:

- best candidate
- confidence
- reasons for the match
- alternative candidates when confidence is low

## Rebuild Engine

### Content Injection Strategy

The rebuild engine should be structure-aware rather than placeholder-required.

It should:

- read the destination HTML structure
- infer likely target regions
- inject mapped source content into the matched regions

Optional placeholders can improve precision when present, but placeholders are not a requirement for product viability.

### Injected content categories

- hero copy and hero media
- section headings and body content
- CTA labels and links
- contact fields
- hours
- address and location blocks
- trust content and summary copy
- metadata and social fields

### Rebuild principle

The resulting page should feel like the uploaded destination template with migrated dealer content inside it, not like an AI recreation of the destination layout. The destination brand and OEM should come from the uploaded package, not from a hardcoded Ford assumption.

## SEO Preservation

SEO preservation should be automatic and mostly invisible in the main UI.

### Preserve by default

- title
- meta description
- H1
- canonical URL
- OG fields when present

### UI treatment

- do not expose a visible `SEO lock` feature in the main workflow
- show preserved values and mismatches only in the inspector or warnings

## Error Handling and Guardrails

### Failure philosophy

Never silently invent missing content.

### Rules

- if source content is missing, show an explicit empty state
- if template matching is ambiguous, show the best match and confidence
- if a page cannot be rebuilt safely, mark it `Needs review`
- if a page is out of scope, exclude it from rebuilt output

### Unsafe cases

- inventory/SRP/VDP/feed-driven pages
- source pages with insufficient trustworthy structure
- template packages with no usable HTML candidates

## Export Contract

Primary export is a provider handoff bundle.

### Output bundle contents

- rebuilt page HTML files
- copied or referenced template assets
- preserved metadata
- source-to-destination mapping manifest
- validation and warning manifest

### Export intent

The bundle should be understandable and adaptable by an engineer integrating it into the destination provider CMS/template system.

### Secondary export

Structured JSON may remain available for debugging and internal inspection, but it is not the headline deliverable.

## Data and Job Model

At a high level, the system should track:

- job metadata
- source inputs
- uploaded package metadata
- extracted package files
- source page classification
- template file classification
- pairing decisions
- rebuild outputs
- warnings and validation events

The exact implementation schema is deferred to planning, but the design assumes these concerns are tracked separately rather than merged into one loose job blob.

The model should also track:

- destination package brand/OEM identity
- whether that identity came from a manifest or heuristics
- any brand/OEM ambiguity warnings

## Presentation Requirements

The presentation should demonstrate this sequence:

1. show the orientation screen
2. start from a homepage or exact static URLs
3. upload a destination template package zip
4. enter the migration workspace
5. select one page and compare source vs rebuilt output
6. open the inspector
7. export the handoff bundle

This sequence tells the right story:

- legacy pages in
- provider template package in
- rebuilt static pages out

## Testing and Verification

### Product-level checks

- orientation screen explains the product quickly
- template package upload is understandable and stable
- source pages are classified correctly
- destination templates are detected with usable confidence
- pairing logic surfaces ambiguity instead of hiding it
- rebuilt pages look like destination pages rather than dev previews
- export bundle is coherent for engineering handoff

### Scope checks

- unsupported inventory-like pages are excluded
- missing source content becomes explicit empty states
- ambiguous template packages create warnings rather than false success

### Demo checks

- homepage flow is polished
- at least one inner page type such as service, about, or contact also demonstrates well
- compare fullscreen is stable and presentation-safe

## Success Criteria

The project is successful when:

- the product can be described as a dealer static-page migration workspace
- the UI looks like a provider tool rather than a scraper experiment
- template package upload feels like a first-class capability
- the same engine can target multiple OEMs or dealer brands by swapping destination packages
- rebuilt pages are clearly tied to uploaded destination templates
- exported output looks credible to the receiving engineering team

## Implementation Notes For Planning

The likely delivery sequence should be:

1. reshape the app shell into orientation + migration workspace
2. add real template package upload and extraction
3. add template detection and template-map generation
4. connect source classification to template pairing
5. replace hardcoded template rendering with destination-template rebuild rendering
6. upgrade export to emit package-driven provider handoff output
7. polish compare, inspector, and presentation flow

This sequence preserves momentum while moving from the current Ford demo toward an OEM-agnostic migration product.
