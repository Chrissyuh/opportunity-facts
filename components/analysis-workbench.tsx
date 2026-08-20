"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { opportunityCardSchema, type OpportunityCard } from "@/lib/opportunity/schema";
import {
  BUILDER_STORAGE_EVENT,
  ANALYSIS_URL_HANDOFF_KEY,
  writeBuilderDraftStorage,
} from "@/lib/opportunity/browser-storage";
import type { PastedSourceInput, ReviewedPageSummary } from "@/lib/analysis/pipeline";
import { FactsCard } from "./facts-card";

type Mode = "url" | "text";
type Phase = "idle" | "running" | "complete" | "error" | "unconfigured";

interface AnalysisResponse {
  card: OpportunityCard;
  reviewedPages: ReviewedPageSummary[];
  pageWarnings: Array<{ url: string; code: string; message: string }>;
  evidenceWarnings: Array<{ fieldId: string; sourceId: string; message: string }>;
}

const reviewedPageSchema = z.strictObject({
  id: z.string().min(1),
  url: z.url(),
  title: z.string().min(1),
  pageType: z.literal("user_supplied"),
  accessedAt: z.string().datetime({ offset: true }),
  truncated: z.boolean(),
  truncatedForModel: z.boolean(),
  contentUnavailable: z.boolean(),
});
const warningSchema = z.strictObject({
  url: z.string(),
  code: z.string(),
  message: z.string(),
});
const evidenceWarningSchema = z.strictObject({
  fieldId: z.string(),
  sourceId: z.string(),
  message: z.string(),
});

const blankSource = (): PastedSourceInput => ({
  title: "",
  url: "",
  pageType: "user_supplied",
  text: "",
});

function downloadCard(card: OpportunityCard) {
  const blob = new Blob([`${JSON.stringify(card, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${card.slug}.opportunity-facts.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function parseAnalysisResponse(value: unknown): AnalysisResponse | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const card = opportunityCardSchema.safeParse(record.card);
  const reviewedPages = z.array(reviewedPageSchema).safeParse(record.reviewedPages);
  const pageWarnings = z.array(warningSchema).safeParse(record.pageWarnings ?? []);
  const evidenceWarnings = z.array(evidenceWarningSchema).safeParse(record.evidenceWarnings ?? []);
  if (!card.success || !reviewedPages.success || !pageWarnings.success || !evidenceWarnings.success) return null;
  return {
    card: card.data,
    reviewedPages: reviewedPages.data,
    pageWarnings: pageWarnings.data,
    evidenceWarnings: evidenceWarnings.data,
  };
}

function formatElapsed(seconds: number) {
  if (seconds < 60) return `${seconds} sec elapsed`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")} elapsed`;
}

function sanitizePageWarningUrl(value: string) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return `${parsed.origin}${parsed.pathname}`.slice(0, 320);
  } catch {
    return null;
  }
}

function pageWarningReason(code: string) {
  switch (code) {
    case "TIMEOUT":
      return "The page did not respond before the fetch time limit.";
    case "ABORTED":
      return "The page request ended before a response was available.";
    case "HTTP_STATUS":
    case "INVALID_STATUS":
      return "The site returned a response that could not be reviewed.";
    case "RESPONSE_TOO_LARGE":
      return "The page exceeded the bounded download size.";
    case "UNSUPPORTED_CONTENT_TYPE":
    case "MISSING_CONTENT_TYPE":
    case "UNSUPPORTED_CONTENT_ENCODING":
    case "UNSUPPORTED_CHARSET":
      return "The page format could not be safely converted to visible text.";
    case "CROSS_ORIGIN_REDIRECT":
    case "INVALID_REDIRECT":
    case "REDIRECT_WITHOUT_LOCATION":
    case "TOO_MANY_REDIRECTS":
      return "The page redirect could not be followed within the public-source boundary.";
    case "NETWORK_ERROR":
      return "The page could not be reached from the analysis server.";
    default:
      return "The page could not be acquired within the public-source safety limits.";
  }
}

export function AnalysisWorkbench({
  configured,
  initialUrl = "",
}: {
  configured: boolean;
  initialUrl?: string;
}) {
  const [mode, setMode] = useState<Mode>(initialUrl ? "url" : "url");
  const [url, setUrl] = useState(initialUrl);
  const [sources, setSources] = useState<PastedSourceInput[]>([blankSource()]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [localMessage, setLocalMessage] = useState("");
  const [isConfigured, setIsConfigured] = useState(configured);
  const [requestStartedAt, setRequestStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const activeRequest = useRef<AbortController | null>(null);
  const resultSection = useRef<HTMLElement | null>(null);
  const resultTitle = useRef<HTMLHeadingElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    try {
      const handedOffUrl = sessionStorage.getItem(ANALYSIS_URL_HANDOFF_KEY);
      if (handedOffUrl) queueMicrotask(() => setUrl(handedOffUrl.slice(0, 2_048)));
      sessionStorage.removeItem(ANALYSIS_URL_HANDOFF_KEY);
    } catch {
      // The URL field remains available when session storage is unavailable.
    }
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/analyze", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const payload: unknown = await response.json();
        if (
          payload &&
          typeof payload === "object" &&
          "configured" in payload &&
          typeof payload.configured === "boolean"
        ) {
          setIsConfigured(payload.configured);
        }
      } catch {
        // Keep the server-rendered configuration state when the check is unavailable.
      }
    })();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (phase !== "running" || requestStartedAt === null) return;
    const updateElapsed = () => setElapsedSeconds(Math.floor((Date.now() - requestStartedAt) / 1_000));
    const timer = window.setInterval(updateElapsed, 1_000);
    return () => window.clearInterval(timer);
  }, [phase, requestStartedAt]);

  useEffect(() => () => activeRequest.current?.abort(), []);

  useEffect(() => {
    if (phase !== "complete" || !result) return;
    const frame = window.requestAnimationFrame(() => {
      resultTitle.current?.focus({ preventScroll: true });
      resultSection.current?.scrollIntoView({
        block: "start",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [phase, result]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);
    setLocalMessage("");
    if (!isConfigured) {
      setPhase("unconfigured");
      return;
    }
    const startedAt = Date.now();
    const controller = new AbortController();
    activeRequest.current = controller;
    setRequestStartedAt(startedAt);
    setElapsedSeconds(0);
    setPhase("running");
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify(mode === "url" ? { mode, url } : { mode, sources }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message =
          payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
            ? payload.message
            : "The sources could not be analyzed.";
        throw new Error(message);
      }
      const parsed = parseAnalysisResponse(payload);
      if (!parsed) throw new Error("The server returned an invalid facts-card response.");
      setResult(parsed);
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1_000));
      setPhase("complete");
    } catch (cause) {
      setError(
        controller.signal.aborted
          ? "Analysis was cancelled. Any incomplete output was discarded."
          : cause instanceof Error
            ? cause.message
            : "The sources could not be analyzed.",
      );
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1_000));
      setPhase("error");
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null;
    }
  }

  function cancelAnalysis() {
    activeRequest.current?.abort();
  }

  function updateSource(index: number, patch: Partial<PastedSourceInput>) {
    setSources((current) => current.map((source, sourceIndex) => sourceIndex === index ? { ...source, ...patch } : source));
  }

  function saveDraft(openBuilder = false) {
    if (!result) return;
    if (
      writeBuilderDraftStorage(
        localStorage,
        JSON.stringify(result.card),
        // Model output is a candidate draft, not a human assessment. The
        // builder must require explicit review before attestation/export.
        JSON.stringify([]),
      )
    ) {
      window.dispatchEvent(new Event(BUILDER_STORAGE_EVENT));
      if (openBuilder) {
        router.push("/build");
        return;
      }
      setLocalMessage("Draft saved in this browser and made available in the manual builder.");
      return;
    }
    setLocalMessage("The browser could not save this draft. Export the JSON instead.");
  }

  function preparePastedFallback() {
    if (!result?.pageWarnings.length) return;
    const failedSources = Array.from(new Set(result.pageWarnings
      .map((warning) => sanitizePageWarningUrl(warning.url))
      .filter((warningUrl): warningUrl is string => warningUrl !== null)))
      .slice(0, 7)
      .map((warningUrl) => ({ ...blankSource(), url: warningUrl }));
    setSources(failedSources.length ? failedSources : [blankSource()]);
    setMode("text");
    setLocalMessage("Paste mode is ready for the pages automatic acquisition missed.");
    window.requestAnimationFrame(() => document.getElementById("source-title-0")?.focus());
  }

  return (
    <div className="analysis-layout" data-has-result={result ? "true" : "false"}>
      <section className="analysis-input panel" aria-labelledby="analysis-input-title">
        <div className="analysis-input-header">
          <p className="eyebrow">Source input</p>
          <h2 id="analysis-input-title">Choose how to review the pages.</h2>
          <div className="mode-switch" role="group" aria-label="Source input mode">
            <button type="button" data-active={mode === "url"} aria-pressed={mode === "url"} onClick={() => setMode("url")}>Public URL</button>
            <button type="button" data-active={mode === "text"} aria-pressed={mode === "text"} onClick={() => setMode("text")}>Paste source text</button>
          </div>
        </div>

        <form className="analysis-form stack" onSubmit={submit}>
          {mode === "url" ? (
            <div className="field">
              <label htmlFor="analysis-url">Public opportunity URL</label>
              <input
                id="analysis-url"
                type="url"
                inputMode="url"
                autoComplete="url"
                placeholder="https://program.example/apply"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                required
              />
              <p className="field-help">The server reviews this page and up to six relevant links found on it. It normally stays on the same site; one application link may redirect to a public form host. Pages for a different named program are skipped. It does not run page scripts or crawl the wider web. Automated pages are labeled user supplied until a human verifies their provenance.</p>
            </div>
          ) : (
            <div className="pasted-source-list">
              {sources.map((source, index) => (
                <fieldset className="pasted-source" key={index}>
                  <legend>Source record {index + 1}</legend>
                  <div className="field-grid">
                    <div className="field">
                      <label htmlFor={`source-title-${index}`}>Page title</label>
                      <input id={`source-title-${index}`} value={source.title} onChange={(event) => updateSource(index, { title: event.target.value })} required />
                    </div>
                    <div className="field">
                      <label htmlFor={`source-url-${index}`}>Source URL</label>
                      <input id={`source-url-${index}`} type="url" inputMode="url" value={source.url} onChange={(event) => updateSource(index, { url: event.target.value })} required />
                    </div>
                  </div>
                  <div className="notice">
                    <strong>Source provenance: user supplied.</strong> Pasting a page does not establish that it is official; a human reviewer must verify source identity before changing the review state.
                  </div>
                  <div className="field">
                    <label htmlFor={`source-text-${index}`}>Pasted visible text</label>
                    <textarea id={`source-text-${index}`} value={source.text} onChange={(event) => updateSource(index, { text: event.target.value })} rows={10} required />
                    <p className="field-help">Paste visible source wording only. Do not include student personal information.</p>
                  </div>
                  {sources.length > 1 ? (
                    <button className="text-button" type="button" onClick={() => setSources((current) => current.filter((_, sourceIndex) => sourceIndex !== index))}>Remove source record {index + 1}</button>
                  ) : null}
                </fieldset>
              ))}
              {sources.length < 7 ? (
                <button className="button-quiet" type="button" onClick={() => setSources((current) => [...current, blankSource()])}>Add another source page</button>
              ) : null}
            </div>
          )}

          {error ? <div className="error-summary" role="alert"><strong>Analysis did not complete.</strong> {error}</div> : null}
          <div className="button-row">
            <button className="button" type="submit" disabled={!isConfigured || phase === "running"}>
              {!isConfigured ? "Automatic extraction unavailable" : phase === "running" ? "Reviewing and structuring sources…" : "Start analysis"}
            </button>
            {phase === "running" ? (
              <button className="button-quiet" type="button" onClick={cancelAnalysis}>
                Cancel analysis
              </button>
            ) : null}
          </div>
          <div className="notice">
            <strong>Privacy boundary.</strong> Both URL and paste modes send supplied public source text to OpenAI for this response. Opportunity Facts does not intentionally retain it, but hosting, DNS/network, source-site, and OpenAI logs may exist. Do not submit signed or private URLs, application portals, personal information, or account-only content.
          </div>
        </form>
      </section>

      <aside className="analysis-progress" aria-labelledby="analysis-progress-title">
        <p className="eyebrow">Analysis record</p>
        <h2 id="analysis-progress-title">What the analysis includes</h2>
        <AnalysisRunStatus phase={phase} elapsedSeconds={elapsedSeconds} />
        <ol>
          <PipelineStep number="01" title="Validate source boundary" text="Allow only bounded public HTTP(S) or explicitly pasted text." />
          <PipelineStep number="02" title="Review relevant pages" text="Extract visible text and bounded page metadata; ignore executable scripts, boilerplate, and page instructions." />
          <PipelineStep number="03" title="Extract bounded sections" text="Build summary, identity/cycle, and detailed structures independently so one incomplete section cannot corrupt another." />
          <PipelineStep number="04" title="Validate every excerpt" text="Match citations back to normalized source text before displaying support." />
        </ol>
        {!isConfigured || phase === "unconfigured" ? (
          <div className="configuration-notice">
            <span className="review-badge">Extraction not configured</span>
            <h3>The public product still works.</h3>
            <p>No server API key is available, so URL and pasted-text extraction are both paused. Your input has not been sent.</p>
            <div className="button-row">
              <Link className="button-secondary" href="/opportunities/lantern-bay-robotics-field-lab">Try the sample</Link>
              <Link className="button-quiet" href="/build">Create manually</Link>
            </div>
          </div>
        ) : null}
      </aside>

      {result ? (
        <section ref={resultSection} className="analysis-result" aria-labelledby="analysis-result-title">
          <div className="analysis-result-heading">
            <div>
              <p className="eyebrow">Draft ready · Automated checks applied</p>
              <h2 ref={resultTitle} id="analysis-result-title" tabIndex={-1}>
                Inspect and correct the draft.
              </h2>
            </div>
            <div className="button-row no-print">
              <button className="button" type="button" onClick={() => saveDraft()}>Save locally</button>
              <button className="button-secondary" type="button" onClick={() => saveDraft(true)}>Edit in builder</button>
              <button className="button-quiet" type="button" onClick={() => downloadCard(result.card)}>Export JSON</button>
            </div>
          </div>
          <p className="action-message" role="status" aria-live="polite">{localMessage}</p>
          <div className="notice">
            <strong>This is not human reviewed.</strong> Automatic checks confirm that retained excerpts exist in the fetched text; they do not prove that every interpretation or scope is correct. Missing or inaccessible pages can cause omissions. Check the source identity, meaning, and attachment of every claim before changing the review state. This analysis does not establish truth, legitimacy, prestige, quality, or value.
          </div>
          <div className="reviewed-page-list">
            <h3>Pages fetched for review</h3>
            <ol>
              {result.reviewedPages.map((page) => (
                <li key={page.id}>
                  <span>{page.pageType.replaceAll("_", " ")}</span>
                  <a href={page.url} target="_blank" rel="noreferrer noopener">{page.title} <span aria-hidden="true">↗</span></a>
                  {page.truncated ? <small>Visible text capped during page extraction</small> : null}
                  {page.truncatedForModel ? <small>Text shortened for the shared model-input budget</small> : null}
                  {page.contentUnavailable ? <small>No extractable visible text; absence claims were withheld</small> : null}
                </li>
              ))}
            </ol>
            {result.pageWarnings.length ? (
              <div className="page-warning-panel">
                <details>
                  <summary>{result.pageWarnings.length} discovered page{result.pageWarnings.length === 1 ? " was" : "s were"} not acquired</summary>
                  <p>The draft lists only pages actually checked. Query strings and fragments are removed below.</p>
                  <ul>
                    {result.pageWarnings.map((warning, index) => (
                      <li key={`${warning.url}-${warning.code}-${index}`}>
                        <strong>{sanitizePageWarningUrl(warning.url) ?? "Discovered page URL unavailable"}</strong>
                        <span>{pageWarningReason(warning.code)}</span>
                      </li>
                    ))}
                  </ul>
                </details>
                <p>When a public page blocks automatic access, paste its visible wording instead. Do not paste account-only content or personal information.</p>
                <button className="button-secondary" type="button" onClick={preparePastedFallback}>Paste text for failed pages</button>
              </div>
            ) : null}
            {result.evidenceWarnings.some((warning) => warning.fieldId.startsWith("model.")) ? (
              <div className="notice" role="status">
                <strong>Part of the automated extraction did not complete.</strong> Independently completed sections were retained; the affected section remains missing or uncertain and needs manual review.
              </div>
            ) : null}
            {result.evidenceWarnings.length ? <div className="notice"><strong>{result.evidenceWarnings.length} automated candidate warning{result.evidenceWarnings.length === 1 ? " was" : "s were"} recorded.</strong> Unsupported citations, mismatched subjects, and unsafe scopes were withheld; facts retain only other validated support or an explicit uncertainty state.</div> : null}
          </div>
          <FactsCard card={result.card} embedded />
        </section>
      ) : null}
    </div>
  );
}

function AnalysisRunStatus({ phase, elapsedSeconds }: { phase: Phase; elapsedSeconds: number }) {
  const status = phase === "running"
    ? {
        title: "Analysis in progress",
        text: "Source acquisition, extraction, and excerpt checks run server-side. Per-stage updates are not streamed, so keep this tab open.",
      }
    : phase === "complete"
      ? { title: "Draft response received", text: "Review the acquired-page record and any warnings before trusting individual claims." }
      : phase === "error"
        ? { title: "No draft returned", text: "The error above explains what stopped this attempt; incomplete output is not presented as a finished card." }
        : phase === "unconfigured"
          ? { title: "Automatic extraction unavailable", text: "No source input has been sent." }
          : { title: "Ready to analyze", text: "Start with a public page or paste visible source wording." };
  return (
    <div className="analysis-run-status" data-state={phase}>
      <span className="analysis-run-indicator" aria-hidden="true" />
      <div>
        <h3 aria-live="polite">{status.title}</h3>
        <p>{status.text}</p>
        {phase === "running" || phase === "complete" || phase === "error" ? (
          <small aria-hidden="true">{formatElapsed(elapsedSeconds)}</small>
        ) : null}
      </div>
    </div>
  );
}

function PipelineStep({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <li>
      <span>{number}</span>
      <div><h3>{title}</h3><p>{text}</p></div>
    </li>
  );
}
