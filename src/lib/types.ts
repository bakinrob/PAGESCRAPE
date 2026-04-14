export const SUPPORTED_PAGE_TYPES = [
  "homepage",
  "about",
  "staff",
  "contact",
  "hours",
  "service",
  "finance",
  "specials",
  "trade_appraisal",
  "research_model",
  "local_seo_landing",
] as const;

export const UNSUPPORTED_PAGE_TYPES = [
  "unsupported_inventory_srp",
  "unsupported_vehicle_vdp",
  "unsupported_checkout",
  "unsupported_other",
] as const;

export type SupportedPageType = (typeof SUPPORTED_PAGE_TYPES)[number];
export type UnsupportedPageType = (typeof UNSUPPORTED_PAGE_TYPES)[number];
export type PageType = SupportedPageType | UnsupportedPageType;
export type AccessMethod = "direct_http" | "browser_rendered" | "manual_review";
export type SeoStatus = "green" | "yellow" | "red";
export type JobStatus = "idle" | "queued" | "scraping" | "complete" | "error";
export type InputMode = "homepage" | "manual_urls";
export type PageStage =
  | "discovering"
  | "queued"
  | "fetching"
  | "classifying"
  | "extracting"
  | "mapping"
  | "validating"
  | "complete"
  | "unsupported"
  | "error";

export type LinkKind =
  | "navigation"
  | "cta"
  | "footer"
  | "policy"
  | "external_reference"
  | "form_action"
  | "utility";

export type MediaRole =
  | "hero"
  | "logo"
  | "offer"
  | "trust"
  | "staff"
  | "location"
  | "gallery"
  | "og"
  | "generic";

export type ContentBlockType =
  | "heading"
  | "paragraph"
  | "bullet_list"
  | "hours_table"
  | "review_snippet"
  | "address_block"
  | "phone_block";

export interface SourceMeta {
  url: string;
  source_path: string;
  access_method: AccessMethod;
  fetched_at: string;
}

export interface ClassificationResult {
  page_type: PageType;
  supported: boolean;
  confidence: number;
  matched_signals: string[];
  ambiguity_notes: string[];
}

export interface SeoPayload {
  locked: boolean;
  title: string;
  meta_description: string;
  h1: string;
  canonical_url: string;
  og_title: string;
  og_description: string;
  og_image: string;
}

export interface ExtractedLink {
  href: string;
  text: string;
  kind: LinkKind;
  internal: boolean;
  purpose?: string;
}

export interface ExtractedMedia {
  url: string;
  alt?: string;
  role: MediaRole;
  source_hint?: string;
}

export interface ExtractedCta {
  label: string;
  href: string;
}

export interface ExtractedSection {
  section_key: string;
  section_label: string;
  order: number;
  text_blocks: string[];
  proof_points: string[];
  ctas: ExtractedCta[];
}

export interface ExtractedPagePayload {
  dealer_name: string;
  source: SourceMeta;
  classification: ClassificationResult;
  seo: SeoPayload;
  content: {
    summary: string;
    sections: ExtractedSection[];
  };
  links: ExtractedLink[];
  media: ExtractedMedia[];
  validation: {
    seo_status: SeoStatus;
    warnings: string[];
    errors: string[];
    missing_fields: string[];
  };
  confidence_notes: string[];
}

export interface MappedContentBlock {
  type: ContentBlockType;
  value: string;
}

export interface MappedSection {
  slot_key: string;
  label: string;
  required: boolean;
  status: "mapped" | "empty_with_warning" | "not_present_in_source";
  source_section_keys: string[];
  content_blocks: MappedContentBlock[];
  ctas: ExtractedCta[];
  media_refs: string[];
  mapping_notes?: string[];
}

export interface MappedPagePayload {
  dealer_name: string;
  oem_preset: string;
  source_url: string;
  page_type: SupportedPageType;
  template: {
    preset: string;
    page_layout: string;
    version: string;
  };
  seo: SeoPayload;
  sections: MappedSection[];
  validation: {
    seo_status: SeoStatus;
    warnings: string[];
    errors: string[];
  };
  confidence_notes: string[];
}

export interface SourceSnapshot {
  screenshotDataUrl?: string;
  headingSample: string[];
  navSample: string[];
  summaryText: string[];
}

export interface PageResult {
  id: string;
  url: string;
  stage: PageStage;
  statusLabel: string;
  error?: string;
  sourceSnapshot?: SourceSnapshot;
  extracted?: ExtractedPagePayload;
  mapped?: MappedPagePayload;
}

export interface JobInput {
  inputMode: InputMode;
  dealerName?: string;
  homepageUrl: string;
  manualUrls: string[];
  discoveredUrls: string[];
  seoLock: boolean;
  oemPreset: string;
}

export interface TemplatePackageFile {
  path: string;
  kind: "html" | "css" | "js" | "asset" | "other";
  size: number;
}

export interface TemplatePackageState {
  id: string;
  filename: string;
  uploadedAt: string;
  manifestPath?: string;
  files: TemplatePackageFile[];
  inferredBrand?: string;
  inferredOem?: string;
}

export interface TemplateTemplateMatch {
  pageId: string;
  sourcePageType: SupportedPageType;
  templatePath: string;
  confidence: number;
  reasons: string[];
  alternatives: string[];
}

export interface JobState {
  id: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  input: JobInput;
  progress: {
    completed: number;
    total: number;
  };
  pages: PageResult[];
  templatePackage?: TemplatePackageState;
  templateDetection?: {
    status: "idle" | "processing" | "ready" | "error";
    warnings: string[];
  };
  destinationBrand?: {
    brand?: string;
    oem?: string;
    source: "manifest" | "heuristic" | "fallback";
    confidence: number;
  };
  pairings: TemplateTemplateMatch[];
  warnings: string[];
  error?: string;
}

export interface ExportBundle {
  manifest: {
    jobId: string;
    dealerName: string;
    inputMode: InputMode;
    homepageUrl: string;
    manualUrls: string[];
    oemPreset: string;
    seoLock: boolean;
    scrapedAt: string;
    totalUrls: number;
    completedPages: number;
    unsupportedPages: number;
    discoveredUrls: string[];
    warnings: string[];
  };
  extractedPages: ExtractedPagePayload[];
  mappedPages: MappedPagePayload[];
}
