"use client";

import { useEffect, useEffectEvent, useMemo, useState, startTransition } from "react";
import {
  Download,
  ExternalLink,
  ImageIcon,
  LoaderCircle,
  Maximize2,
  PanelRightOpen,
  Search,
  Sparkles,
  X,
} from "lucide-react";

import { TemplatePreview } from "@/components/template-preview";
import type { InputMode, JobState, PageResult } from "@/lib/types";

const sampleHomepage = "https://www.varsityford.com/";
const sampleManualUrls = [
  "https://www.varsityford.com/about-us/",
  "https://www.varsityford.com/contact-us/",
  "https://www.varsityford.com/service/",
  "https://www.varsityford.com/finance/",
].join("\n");

type PreviewState = {
  screenshotDataUrl?: string;
  status: "idle" | "pending" | "ready" | "error";
  warnings: string[];
};

function hostLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function stageTone(page: PageResult) {
  switch (page.stage) {
    case "complete":
      return "border-emerald-500/30 bg-emerald-500/12 text-emerald-200";
    case "unsupported":
      return "border-amber-500/30 bg-amber-500/12 text-amber-100";
    case "error":
      return "border-rose-500/30 bg-rose-500/12 text-rose-200";
    default:
      return "border-sky-500/30 bg-sky-500/12 text-sky-100";
  }
}

function previewLabel(preview?: PreviewState) {
  switch (preview?.status) {
    case "ready":
      return "Preview ready";
    case "pending":
      return "Preview loading";
    case "error":
      return "Preview failed";
    default:
      return "Preview queued";
  }
}

function SourcePanel({
  page,
  preview,
  fullscreen = false,
}: {
  page: PageResult;
  preview?: PreviewState;
  fullscreen?: boolean;
}) {
  const screenshot = page.sourceSnapshot?.screenshotDataUrl || preview?.screenshotDataUrl;
  const title = page.extracted?.seo.h1 || page.extracted?.seo.title || page.url;
  const summary = page.extracted?.content.summary || "Structured summary will appear after extraction completes.";
  const signals = [
    ...new Set([
      ...(page.sourceSnapshot?.navSample ?? []).slice(0, 3),
      ...(page.sourceSnapshot?.headingSample ?? []).slice(0, 2),
    ]),
  ].slice(0, 4);
  const screenshotHeight = fullscreen ? "max-h-[62dvh] min-h-[24rem] w-full" : "h-[27rem] w-full";

  return (
    <section className={`overflow-hidden rounded-[1.6rem] border border-white/10 bg-slate-950/85 ${fullscreen ? "flex h-full min-h-0 flex-col" : ""}`}>
      <div className="border-b border-white/8 px-5 py-4">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-sky-300">Source Page</p>
        <h2 className="mt-3 text-2xl font-semibold text-white">{title}</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-400">
          <span className="truncate">{page.url}</span>
          <a href={page.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sky-300 transition hover:text-sky-200">
            Open live page
            <ExternalLink className="size-3.5" />
          </a>
        </div>
      </div>

      <div className={`p-4 ${fullscreen ? "min-h-0 flex-1 overflow-auto" : ""}`}>
        {screenshot ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={screenshot}
            alt={`Source preview for ${page.url}`}
            className={`${screenshotHeight} rounded-[1.3rem] border border-white/8 object-cover object-top`}
          />
        ) : (
          <div className={`flex ${screenshotHeight} items-center justify-center rounded-[1.3rem] border border-dashed border-white/10 bg-slate-900 text-sm text-slate-400`}>
            {preview?.status === "pending" ? (
              <>
                <LoaderCircle className="mr-2 size-4 animate-spin" />
                Capturing source preview
              </>
            ) : (
              <>
                <ImageIcon className="mr-2 size-4" />
                Source screenshot will appear here
              </>
            )}
          </div>
        )}

        <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-slate-400">Source Summary</p>
            <p className="mt-3 text-sm leading-7 text-slate-300">{summary}</p>
          </div>
          <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-slate-400">Source Signals</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {signals.length > 0 ? (
                signals.map((signal) => (
                  <span key={signal} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-300">
                    {signal}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-500">Signal extraction will appear here.</span>
              )}
            </div>
            <p className="mt-4 text-sm text-slate-400">{previewLabel(preview)}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function InspectorDrawer({
  page,
  preview,
  open,
  onClose,
  jobWarnings,
}: {
  page: PageResult | null;
  preview?: PreviewState;
  open: boolean;
  onClose: () => void;
  jobWarnings: string[];
}) {
  if (!page) return null;

  const extracted = page.extracted;
  const warnings = [
    ...(extracted?.validation.warnings ?? []),
    ...(preview?.warnings ?? []),
    ...jobWarnings,
  ].filter((warning, index, list) => warning && list.indexOf(warning) === index);

  return (
    <>
      <div className={`fixed inset-0 z-40 bg-slate-950/45 transition-opacity ${open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`} onClick={onClose} />
      <aside className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-[28rem] flex-col border-l border-white/10 bg-[#07111c] shadow-[0_0_40px_rgba(0,0,0,0.4)] transition-transform ${open ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex items-start justify-between gap-4 border-b border-white/8 px-5 py-5">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-sky-300">Inspector</p>
            <h3 className="mt-2 text-xl font-semibold text-white">{extracted?.seo.h1 || extracted?.seo.title || page.url}</h3>
            <p className="mt-2 text-sm text-slate-400">{page.url}</p>
          </div>
          <button type="button" onClick={onClose} className="secondary-button !px-3 !py-3">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-sky-300">Assets</p>
            <div className="mt-4 space-y-3">
              {extracted?.media.length ? extracted.media.slice(0, 10).map((asset) => (
                <div key={asset.url} className="rounded-[1rem] border border-white/8 bg-black/20 p-3">
                  <p className="text-sm font-medium text-white">{asset.alt || asset.role}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{asset.role}</p>
                  <p className="mt-2 break-all text-xs leading-6 text-slate-400">{asset.url}</p>
                </div>
              )) : <p className="text-sm text-slate-500">No extracted assets for this page.</p>}
            </div>
          </div>

          <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-sky-300">SEO</p>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <p><span className="text-slate-500">Title:</span> {extracted?.seo.title || "Unavailable"}</p>
              <p><span className="text-slate-500">Meta:</span> {extracted?.seo.meta_description || "Unavailable"}</p>
              <p><span className="text-slate-500">H1:</span> {extracted?.seo.h1 || "Unavailable"}</p>
              <p className="break-all"><span className="text-slate-500">Canonical:</span> {extracted?.seo.canonical_url || page.url}</p>
              <p><span className="text-slate-500">OG title:</span> {extracted?.seo.og_title || "Unavailable"}</p>
              <p><span className="text-slate-500">OG description:</span> {extracted?.seo.og_description || "Unavailable"}</p>
            </div>
          </div>

          <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-sky-300">Source Signals</p>
            <div className="mt-4 space-y-3">
              {(extracted?.links.slice(0, 10) ?? []).map((link) => (
                <div key={`${link.href}-${link.text}`} className="rounded-[1rem] border border-white/8 bg-black/20 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-white">{link.text}</p>
                    <span className="text-[0.65rem] uppercase tracking-[0.18em] text-slate-500">{link.kind}</span>
                  </div>
                  <p className="mt-2 break-all text-xs leading-6 text-slate-400">{link.href}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-sky-300">Warnings</p>
            <div className="mt-4 space-y-3">
              {warnings.length > 0 ? warnings.slice(0, 10).map((warning) => (
                <div key={warning} className="rounded-[1rem] border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-100">
                  {warning}
                </div>
              )) : <p className="text-sm text-slate-500">No warnings for this page.</p>}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

export function FordScraperApp() {
  const [inputMode, setInputMode] = useState<InputMode>("homepage");
  const [homepageUrl, setHomepageUrl] = useState(sampleHomepage);
  const [manualUrls, setManualUrls] = useState(sampleManualUrls);
  const [job, setJob] = useState<JobState | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [previewByUrl, setPreviewByUrl] = useState<Record<string, PreviewState>>({});
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [compareFullscreen, setCompareFullscreen] = useState(false);

  const selectedPage = useMemo(
    () => job?.pages.find((page) => page.id === selectedPageId) ?? job?.pages[0] ?? null,
    [job, selectedPageId],
  );

  const selectedPageWithPreview = useMemo(() => {
    if (!selectedPage) return null;
    const preview = previewByUrl[selectedPage.url];
    if (!preview?.screenshotDataUrl || selectedPage.sourceSnapshot?.screenshotDataUrl) return selectedPage;

    return {
      ...selectedPage,
      sourceSnapshot: {
        headingSample: selectedPage.sourceSnapshot?.headingSample ?? [],
        navSample: selectedPage.sourceSnapshot?.navSample ?? [],
        summaryText: selectedPage.sourceSnapshot?.summaryText ?? [],
        screenshotDataUrl: preview.screenshotDataUrl,
      },
    };
  }, [previewByUrl, selectedPage]);

  const selectedPreview = selectedPageWithPreview ? previewByUrl[selectedPageWithPreview.url] : undefined;

  const pollJob = useEffectEvent(async () => {
    if (!job?.id) return;
    const response = await fetch(`/api/jobs/${job.id}`, { cache: "no-store" });
    if (!response.ok) return;
    const nextJob = (await response.json()) as JobState;
    setJob(nextJob);
    if (!selectedPageId && nextJob.pages[0]) {
      setSelectedPageId(nextJob.pages[0].id);
    }
  });

  const queuePreview = useEffectEvent(async (url: string) => {
    const current = previewByUrl[url];
    if (current && ["pending", "ready"].includes(current.status)) return;

    setPreviewByUrl((state) => ({
      ...state,
      [url]: { screenshotDataUrl: state[url]?.screenshotDataUrl, status: "pending", warnings: state[url]?.warnings ?? [] },
    }));

    try {
      const response = await fetch("/api/source-preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const payload = (await response.json()) as { screenshotDataUrl?: string; warnings?: string[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Preview capture failed.");

      setPreviewByUrl((state) => ({
        ...state,
        [url]: {
          screenshotDataUrl: payload.screenshotDataUrl,
          status: payload.screenshotDataUrl ? "ready" : "error",
          warnings: payload.warnings ?? [],
        },
      }));
    } catch (error) {
      setPreviewByUrl((state) => ({
        ...state,
        [url]: {
          screenshotDataUrl: state[url]?.screenshotDataUrl,
          status: "error",
          warnings: [...(state[url]?.warnings ?? []), error instanceof Error ? error.message : "Preview capture failed."],
        },
      }));
    }
  });

  useEffect(() => {
    if (!job?.id || ["queued", "scraping"].includes(job.status)) {
      void pollJob();
      const interval = window.setInterval(() => {
        startTransition(() => {
          void pollJob();
        });
      }, 1800);
      return () => window.clearInterval(interval);
    }
  }, [job?.id, job?.status]);

  useEffect(() => {
    if (!job?.pages.length || selectedPageId) return;
    setSelectedPageId(job.pages[0].id);
  }, [job?.pages, selectedPageId]);

  useEffect(() => {
    const pages = job?.pages.filter((page) => page.stage === "complete") ?? [];
    if (pages.length === 0) return;

    const ordered = [...pages].sort((left, right) => {
      if (left.url === job?.input.homepageUrl) return -1;
      if (right.url === job?.input.homepageUrl) return 1;
      return 0;
    });

    let cancelled = false;
    void (async () => {
      for (const page of ordered) {
        if (cancelled) break;
        const preview = previewByUrl[page.url];
        if (preview && ["pending", "ready"].includes(preview.status)) continue;
        await queuePreview(page.url);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [job?.id, job?.input.homepageUrl, job?.pages, previewByUrl]);

  useEffect(() => {
    if (!compareFullscreen) return;

    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;

    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCompareFullscreen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [compareFullscreen]);

  const handleStartScrape = async () => {
    setFormError(null);
    setSubmitting(true);
    setPreviewByUrl({});
    setInspectorOpen(false);
    setCompareFullscreen(false);

    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          inputMode,
          homepageUrl: homepageUrl.trim(),
          manualUrls: manualUrls
            .split(/\r?\n/)
            .map((value) => value.trim())
            .filter(Boolean),
          seoLock: true,
          oemPreset: "ford-varsity",
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        setFormError(payload.error || "Unable to start the rebuild job.");
        return;
      }

      setJob(payload as JobState);
      setSelectedPageId(null);
    } finally {
      setSubmitting(false);
    }
  };

  const isProcessing = !!job && ["queued", "scraping"].includes(job.status);
  const isReviewReady = !!job && !["queued", "scraping"].includes(job.status) && job.pages.length > 0;

  return (
    <main className="page-shell">
      <div className="mx-auto max-w-[1680px]">
        {!job ? (
          <section className="rounded-[2rem] border border-white/8 bg-[#06101b] shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <div className="grid min-h-[84vh] gap-10 px-6 py-8 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:px-10">
              <div className="flex flex-col justify-center">
                <span className="eyebrow">
                  <Sparkles className="size-3.5" />
                  Page Migration Workspace
                </span>
                <h1 className="mt-6 max-w-4xl text-5xl font-semibold leading-[0.95] text-white sm:text-6xl">
                  Rebuild static dealer pages into a provider-ready Ford template.
                </h1>
                <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
                  Paste one homepage for the guided discovery flow, or switch to exact URLs when you
                  want to target specific static pages. SEO-critical fields stay preserved
                  automatically.
                </p>
                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  {[
                    "Homepage, about, contact, service, finance, and other static CMS pages",
                    "Side-by-side source vs rebuilt template review",
                    "Per-page inspector for assets, SEO, source signals, and warnings",
                    "Engineer-facing HTML bundle export for handoff",
                  ].map((item) => (
                    <div key={item} className="rounded-[1.2rem] border border-white/10 bg-white/[0.03] p-4 text-sm leading-7 text-slate-300">
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center">
                <div className="w-full rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
                  <div className="inline-flex rounded-full border border-white/10 bg-slate-950/60 p-1">
                    <button type="button" onClick={() => setInputMode("homepage")} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${inputMode === "homepage" ? "bg-sky-500 text-white" : "text-slate-300"}`}>
                      Homepage
                    </button>
                    <button type="button" onClick={() => setInputMode("manual_urls")} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${inputMode === "manual_urls" ? "bg-sky-500 text-white" : "text-slate-300"}`}>
                      Advanced exact URLs
                    </button>
                  </div>

                  <div className="mt-6 space-y-5">
                    {inputMode === "homepage" ? (
                      <label className="block">
                        <span className="mb-2 block text-sm font-semibold text-slate-200">Homepage URL</span>
                        <input className="field-input" value={homepageUrl} onChange={(event) => setHomepageUrl(event.target.value)} placeholder="https://www.varsityford.com/" />
                        <p className="mt-3 text-sm leading-7 text-slate-400">
                          The app will discover main static pages from navigation and footer links,
                          then rebuild them into the Ford Varsity template.
                        </p>
                      </label>
                    ) : (
                      <label className="block">
                        <span className="mb-2 block text-sm font-semibold text-slate-200">Exact static page URLs</span>
                        <textarea className="field-input min-h-[220px] resize-y" value={manualUrls} onChange={(event) => setManualUrls(event.target.value)} placeholder={`https://www.varsityford.com/about-us/\nhttps://www.varsityford.com/service/`} />
                        <p className="mt-3 text-sm leading-7 text-slate-400">
                          Use one URL per line for specific static migration targets. Inventory,
                          VDP, checkout, and feed-driven pages remain out of scope.
                        </p>
                      </label>
                    )}

                    {formError ? <div className="rounded-[1.2rem] border border-rose-500/30 bg-rose-500/12 p-4 text-sm text-rose-100">{formError}</div> : null}

                    <div className="flex flex-wrap gap-3">
                      <button type="button" onClick={handleStartScrape} disabled={submitting} className="primary-button">
                        {submitting ? <LoaderCircle className="size-4 animate-spin" /> : <Search className="size-4" />}
                        {submitting ? "Starting rebuild" : "Start rebuild"}
                      </button>
                      <button type="button" onClick={() => { setHomepageUrl(sampleHomepage); setManualUrls(sampleManualUrls); }} className="secondary-button">
                        Load sample inputs
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {isProcessing && job ? (
          <section className="rounded-[2rem] border border-white/8 bg-[#06101b] px-6 py-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:px-8">
            <div className="mx-auto max-w-[1440px] space-y-6">
              <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-6">
                <div className="flex flex-wrap items-start justify-between gap-6">
                  <div className="max-w-4xl">
                    <p className="text-[0.72rem] font-semibold uppercase tracking-[0.26em] text-sky-300">
                      Static page migration in progress
                    </p>
                    <h1 className="mt-4 text-4xl font-semibold text-white">{hostLabel(job.input.homepageUrl)}</h1>
                    <p className="mt-4 text-base leading-8 text-slate-300">
                      {job.input.inputMode === "homepage"
                        ? "Discovering static pages from the homepage, then rebuilding them into the destination Ford template."
                        : "Processing the selected static page URLs, then rebuilding them into the destination Ford template."}{" "}
                      Source screenshots continue loading in the background and do not block completion.
                    </p>
                  </div>
                  <div className="rounded-full border border-sky-500/30 bg-sky-500/12 px-4 py-2 text-sm text-sky-100">
                    {job.progress.completed} / {job.progress.total || "?"} pages ready
                  </div>
                </div>
                <div className="mt-6 h-3 overflow-hidden rounded-full bg-white/8">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#1f6fff,#53bdfd)] transition-all"
                    style={{ width: `${(job.progress.completed / Math.max(job.progress.total, 1)) * 100}%` }}
                  />
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
                <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-5">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.26em] text-sky-300">
                    {job.input.inputMode === "homepage" ? "Discovered migration targets" : "Selected migration targets"}
                  </p>
                  <div className="mt-4 space-y-3">
                    {(job.input.discoveredUrls.length
                      ? job.input.discoveredUrls
                      : [job.input.inputMode === "homepage" ? "Finding homepage and supporting static pages..." : "Preparing exact page targets..."]).map((url) => (
                      <div key={url} className="rounded-[1.2rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-200">
                        {url}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3">
                  {job.pages.map((page) => (
                    <div key={page.id} className="rounded-[1.3rem] border border-white/10 bg-white/[0.04] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {page.extracted?.classification.page_type || "Discovered page"}
                          </p>
                          <p className="mt-1 text-sm text-slate-400">{page.url}</p>
                        </div>
                        <span className={`rounded-full border px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.18em] ${stageTone(page)}`}>
                          {page.stage}
                        </span>
                      </div>
                      <p className="mt-3 text-sm text-slate-400">{page.statusLabel}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {isReviewReady && selectedPageWithPreview && job ? (
          <section className="space-y-6">
            <div className="rounded-[1.8rem] border border-white/8 bg-[#06101b] px-6 py-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:px-8">
              <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                <div className="max-w-4xl">
                  <span className="eyebrow">
                    <Sparkles className="size-3.5" />
                    Page Migration Workspace
                  </span>
                  <h1 className="mt-5 text-4xl font-semibold text-white sm:text-5xl">
                    {selectedPageWithPreview.extracted?.seo.h1 || selectedPageWithPreview.extracted?.seo.title || selectedPageWithPreview.url}
                  </h1>
                  <p className="mt-4 max-w-3xl text-base leading-8 text-slate-300">
                    Review the current source page on the left and the rebuilt Ford Varsity template
                    page on the right. Use the inspector for assets, SEO, source signals, and
                    warnings tied to this same migration target.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={() => setInspectorOpen(true)} className="secondary-button">
                    <PanelRightOpen className="size-4" />
                    Inspector
                  </button>
                  <button type="button" onClick={() => setCompareFullscreen(true)} className="secondary-button">
                    <Maximize2 className="size-4" />
                    Compare full screen
                  </button>
                  <a className="primary-button" href={`/api/jobs/${job.id}/export`}>
                    <Download className="size-4" />
                    Export HTML bundle
                  </a>
                  <a className="secondary-button" href={`/api/jobs/${job.id}/export?format=json`}>
                    <Download className="size-4" />
                    Export JSON
                  </a>
                </div>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
              <aside className="rounded-[1.6rem] border border-white/8 bg-[#06101b] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.25)]">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.26em] text-sky-300">
                  {job.input.inputMode === "homepage" ? "Static pages" : "Selected pages"}
                </p>
                <div className="mt-4 space-y-3">
                  {job.pages.map((page) => {
                    const preview = previewByUrl[page.url];
                    const isSelected = selectedPageWithPreview.id === page.id;
                    return (
                      <button
                        key={page.id}
                        type="button"
                        onClick={() => {
                          setSelectedPageId(page.id);
                          setInspectorOpen(false);
                        }}
                        className={`w-full rounded-[1.2rem] border px-4 py-4 text-left transition ${
                          isSelected ? "border-sky-400/40 bg-sky-500/12" : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">{page.extracted?.classification.page_type || "Pending"}</p>
                            <p className="mt-1 line-clamp-2 text-xs leading-6 text-slate-400">{page.url}</p>
                          </div>
                          <span className={`rounded-full border px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.18em] ${stageTone(page)}`}>
                            {page.stage}
                          </span>
                        </div>
                        <p className="mt-3 text-xs text-slate-500">{previewLabel(preview)}</p>
                      </button>
                    );
                  })}
                </div>
              </aside>

              <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <SourcePanel page={selectedPageWithPreview} preview={selectedPreview} />

                <section className="overflow-hidden rounded-[1.6rem] border border-white/10 bg-slate-950/85 shadow-[0_24px_80px_rgba(0,0,0,0.25)]">
                  <div className="border-b border-white/8 px-5 py-4">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-sky-300">Rebuilt Template Page</p>
                    <h2 className="mt-3 text-2xl font-semibold text-white">
                      {selectedPageWithPreview.mapped?.seo.title || selectedPageWithPreview.extracted?.seo.title || selectedPageWithPreview.url}
                    </h2>
                    <p className="mt-3 text-sm leading-7 text-slate-400">
                      This side follows the Ford Varsity template contract rather than a generic
                      preview stack. SEO fields are preserved automatically from the source page.
                    </p>
                  </div>

                  <div className="p-4">
                    <TemplatePreview mapped={selectedPageWithPreview.mapped} sourceUrl={selectedPageWithPreview.url} />
                  </div>
                </section>
              </div>
            </div>
          </section>
        ) : null}
      </div>

      <InspectorDrawer page={selectedPageWithPreview} preview={selectedPreview} open={inspectorOpen} onClose={() => setInspectorOpen(false)} jobWarnings={job?.warnings ?? []} />

      {compareFullscreen && selectedPageWithPreview ? (
        <div className="fixed inset-0 z-50 bg-[#02060c] p-3 sm:p-4">
          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[1.8rem] border border-white/10 bg-[#050c16]">
            <div className="shrink-0 border-b border-white/8 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-sky-300">Compare full screen</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  {selectedPageWithPreview.extracted?.seo.h1 || selectedPageWithPreview.extracted?.seo.title || selectedPageWithPreview.url}
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  Escape closes compare mode. Each pane now scrolls independently for a cleaner review.
                </p>
              </div>
              <button type="button" onClick={() => setCompareFullscreen(false)} className="secondary-button">
                <X className="size-4" />
                Close
              </button>
            </div>
            </div>

            <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <SourcePanel page={selectedPageWithPreview} preview={selectedPreview} fullscreen />
              <section className="flex min-h-0 flex-col overflow-hidden rounded-[1.6rem] border border-white/10 bg-slate-950/85">
                <div className="shrink-0 border-b border-white/8 px-5 py-4">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-sky-300">Rebuilt Template Page</p>
                  <h2 className="mt-3 text-2xl font-semibold text-white">
                    {selectedPageWithPreview.mapped?.seo.title || selectedPageWithPreview.extracted?.seo.title || selectedPageWithPreview.url}
                  </h2>
                </div>
                <div className="min-h-0 flex-1 overflow-auto p-4">
                  <TemplatePreview mapped={selectedPageWithPreview.mapped} sourceUrl={selectedPageWithPreview.url} />
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
