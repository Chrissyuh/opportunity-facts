"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { opportunityCardSchema, type OpportunityCard } from "@/lib/opportunity/schema";
import { ATTENTION_CATEGORIES, type AttentionItem } from "@/lib/analysis/attention";
import { FIELD_IDS, type FieldId } from "@/lib/opportunity/fields";
import {
  BUILDER_STORAGE_EVENT,
  ANALYSIS_URL_HANDOFF_KEY,
  writeBuilderDraftStorage,
} from "@/lib/opportunity/browser-storage";
import type { PastedSourceInput, ReviewedPageSummary } from "@/lib/analysis/pipeline";
import type { AnalysisProgressEvent } from "@/lib/analysis/progress";
import { ANALYZER_VERSION } from "@/lib/analysis/analyzer-version";
import { OpportunityOverview } from "./opportunity-overview";

const AnalyzedFullRecord = dynamic(() =>
  import("./analyzed-full-record").then((module) => module.AnalyzedFullRecord));

type Mode = "url" | "text";
type Phase = "idle" | "running" | "complete" | "insufficient" | "error" | "unconfigured";
type ExtendedPhase = "idle" | "running" | "complete" | "error";
type ResearchDepth = "normal" | "extended";
type ResearchMetadata = {
  depth: ResearchDepth;
  extendedAvailable: boolean;
  sessionId: string | null;
  assessedFieldIds: FieldId[];
  completedSections?: Array<"details" | "financial">;
  failedSections?: Array<"details" | "financial">;
  reused?: boolean;
};
type FailureSuppression = { bypass: boolean; allowLocalSuppression: boolean };
type QualityFailure = {
  reasons: Array<{ title: string; explanation: string }>;
  expiresAt: string;
  cached: boolean;
  cacheEligible: boolean;
  allowLocalSuppression: boolean;
  result: AnalysisResponse | null;
};
const LOCAL_QUALITY_PREFIX = "opportunity-facts:quality-failure:";
const LOCAL_RETRY_COOLDOWN_MS = 10 * 60 * 1_000;

interface AnalysisResponse {
  card: OpportunityCard;
  reviewedPages: ReviewedPageSummary[];
  pageWarnings: Array<{ url: string; code: string; message: string }>;
  evidenceWarnings: Array<{ fieldId: string; sourceId: string; message: string }>;
  attentionItems: AttentionItem[];
  research: ResearchMetadata;
  failureSuppression: FailureSuppression;
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
const attentionItemSchema = z.strictObject({
  id: z.string(), category: z.enum(ATTENTION_CATEGORIES), priority: z.enum(["high", "medium", "low"]),
  title: z.string(), explanation: z.string(), fieldIds: z.array(z.enum(FIELD_IDS)), claimIds: z.array(z.string()),
  sourceIds: z.array(z.string()), suggestedNextStep: z.string().nullable(), origin: z.enum(["model_grounded", "deterministic_fallback"]),
});
const researchSchema = z.object({
  depth: z.enum(["normal", "extended"]),
  extendedAvailable: z.boolean(),
  sessionId: z.string().min(1).nullable(),
  assessedFieldIds: z.array(z.enum(FIELD_IDS)).optional(),
  completedSections: z.array(z.enum(["details", "financial"])).optional(),
  failedSections: z.array(z.enum(["details", "financial"])).optional(),
  reused: z.boolean().optional(),
});
const failureSuppressionSchema = z.strictObject({
  bypass: z.boolean(),
  allowLocalSuppression: z.boolean(),
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
  const attentionItems = z.array(attentionItemSchema).safeParse(record.attentionItems ?? []);
  if (!card.success || !reviewedPages.success || !pageWarnings.success || !evidenceWarnings.success || !attentionItems.success) return null;
  const research = researchSchema.safeParse(record.research);
  const failureSuppression = failureSuppressionSchema.safeParse(record.failureSuppression);
  return {
    card: card.data,
    reviewedPages: reviewedPages.data,
    pageWarnings: pageWarnings.data,
    evidenceWarnings: evidenceWarnings.data,
    attentionItems: attentionItems.data,
    research: research.success
      ? { ...research.data, assessedFieldIds: research.data.assessedFieldIds ?? [...FIELD_IDS] }
      : { depth: "normal", extendedAvailable: false, sessionId: null, assessedFieldIds: [...FIELD_IDS] },
    failureSuppression: failureSuppression.success
      ? failureSuppression.data
      : { bypass: false, allowLocalSuppression: true },
  };
}

function parseQualityFailure(value: unknown): QualityFailure | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.kind !== "quality_failure") return null;
  const quality = record.quality;
  if (!quality || typeof quality !== "object") return null;
  const qualityRecord = quality as Record<string, unknown>;
  const reasons = Array.isArray(qualityRecord.reasons)
    ? qualityRecord.reasons.flatMap((reason) =>
      reason && typeof reason === "object" && "explanation" in reason && typeof reason.explanation === "string"
        ? [{
            title: "title" in reason && typeof reason.title === "string" ? reason.title : "Source quality issue",
            explanation: reason.explanation,
          }]
        : [])
      .slice(0, 3)
    : [];
  const suppression = failureSuppressionSchema.safeParse(record.failureSuppression);
  return {
    reasons,
    expiresAt: typeof qualityRecord.expiresAt === "string"
      ? qualityRecord.expiresAt
      : new Date(Date.now() + LOCAL_RETRY_COOLDOWN_MS).toISOString(),
    cached: record.cached === true,
    cacheEligible: record.cacheEligible === true,
    allowLocalSuppression: suppression.success
      ? suppression.data.allowLocalSuppression
      : true,
    result: parseAnalysisResponse(record.incompleteResult ?? record.result),
  };
}

function parseStoredQualityFailure(value: string): QualityFailure | null {
  try {
    const record = JSON.parse(value) as unknown;
    if (!record || typeof record !== "object") return null;
    const stored = record as Record<string, unknown>;
    const reasons = Array.isArray(stored.reasons)
      ? stored.reasons.flatMap((reason) =>
        reason && typeof reason === "object" && typeof (reason as { title?: unknown }).title === "string" && typeof (reason as { explanation?: unknown }).explanation === "string"
          ? [{ title: (reason as { title: string }).title, explanation: (reason as { explanation: string }).explanation }]
          : [])
      : [];
    if (typeof stored.expiresAt !== "string" || Date.parse(stored.expiresAt) <= Date.now()) return null;
    return {
      reasons,
      expiresAt: stored.expiresAt,
      cached: true,
      cacheEligible: stored.cacheEligible === true,
      allowLocalSuppression: stored.allowLocalSuppression !== false,
      result: parseAnalysisResponse(stored.result),
    };
  } catch {
    return null;
  }
}

async function readAnalysisStream(response: Response, onProgress: (event: AnalysisProgressEvent) => void): Promise<unknown> {
  if (!response.ok) return response.json();
  if (!response.headers.get("content-type")?.includes("application/x-ndjson")) return response.json();
  const reader = response.body?.getReader();
  if (!reader) throw new Error("The research stream was unavailable.");
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const message = JSON.parse(line) as { type: string; event?: AnalysisProgressEvent; result?: unknown; message?: string };
      if (message.type === "progress" && message.event) onProgress(message.event);
      if (message.type === "error") throw new Error(message.message ?? "The sources could not be analyzed.");
      if (message.type === "complete") return message.result;
    }
    if (done) break;
  }
  throw new Error("The research stream ended before a complete result arrived.");
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
  const [progressEvents, setProgressEvents] = useState<AnalysisProgressEvent[]>([]);
  const [qualityFailure, setQualityFailure] = useState<QualityFailure | null>(null);
  const [qualityOverrideConfirmation, setQualityOverrideConfirmation] = useState(false);
  const [qualityOverride, setQualityOverride] = useState(false);
  const [extendedPhase, setExtendedPhase] = useState<ExtendedPhase>("idle");
  const [extendedError, setExtendedError] = useState("");
  const [extendedProgressEvents, setExtendedProgressEvents] = useState<AnalysisProgressEvent[]>([]);
  const [extendedStartedAt, setExtendedStartedAt] = useState<number | null>(null);
  const [extendedElapsedSeconds, setExtendedElapsedSeconds] = useState(0);
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

  useEffect(() => {
    if (extendedPhase !== "running" || extendedStartedAt === null) return;
    const updateElapsed = () => setExtendedElapsedSeconds(Math.floor((Date.now() - extendedStartedAt) / 1_000));
    const timer = window.setInterval(updateElapsed, 1_000);
    return () => window.clearInterval(timer);
  }, [extendedPhase, extendedStartedAt]);

  useEffect(() => () => activeRequest.current?.abort(), []);

  useEffect(() => {
    if ((phase !== "complete" && !qualityOverride) || !result) return;
    const frame = window.requestAnimationFrame(() => {
      resultTitle.current?.focus({ preventScroll: true });
      resultSection.current?.scrollIntoView({
        block: "start",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [phase, qualityOverride, result]);

  async function allowsRememberedFailure(canonicalUrl: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/analyze?suppressionUrl=${encodeURIComponent(canonicalUrl)}`, {
        cache: "no-store",
      });
      if (!response.ok) return false;
      const payload: unknown = await response.json();
      if (!payload || typeof payload !== "object") return false;
      const suppression = failureSuppressionSchema.safeParse((payload as Record<string, unknown>).failureSuppression);
      return suppression.success && suppression.data.allowLocalSuppression;
    } catch {
      // A configuration check failure must not let stale browser state block a
      // host that the server may now require to receive a fresh analysis.
      return false;
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setQualityOverrideConfirmation(false);
    setQualityOverride(false);
    setExtendedPhase("idle");
    setExtendedError("");
    setExtendedProgressEvents([]);
    setLocalMessage("");
    if (!isConfigured) {
      setPhase("unconfigured");
      return;
    }
    if (mode === "url") {
      try {
        const canonical = new URL(url).href;
        const storageKey = `${LOCAL_QUALITY_PREFIX}${ANALYZER_VERSION}:${canonical}`;
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const parsed = parseStoredQualityFailure(stored);
          if (parsed && await allowsRememberedFailure(canonical)) {
            setQualityFailure(parsed);
            setResult(parsed.result);
            setPhase("insufficient");
            return;
          }
          localStorage.removeItem(storageKey);
        }
      } catch { /* Server validation provides the user-facing URL error. */ }
    }
    setResult(null);
    setQualityFailure(null);
    const startedAt = Date.now();
    const controller = new AbortController();
    activeRequest.current = controller;
    setRequestStartedAt(startedAt);
    setElapsedSeconds(0);
    setPhase("running");
    setProgressEvents([]);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify(mode === "url" ? { mode, url } : { mode, sources }),
      });
      const payload: unknown = await readAnalysisStream(response, (progressEvent) => {
        if (progressEvent.type !== "heartbeat") setProgressEvents((current) => [...current, progressEvent]);
      });
      if (!response.ok) {
        const message =
          payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
            ? payload.message
            : "The sources could not be analyzed.";
        throw new Error(message);
      }
      const failure = parseQualityFailure(payload);
      if (failure) {
        setQualityFailure(failure);
        setResult(failure.result);
        if (mode === "url") {
          const storageKey = `${LOCAL_QUALITY_PREFIX}${ANALYZER_VERSION}:${new URL(url).href}`;
          try {
            if (failure.allowLocalSuppression) {
              const localExpiry = failure.cacheEligible
                ? failure.expiresAt
                : new Date(Date.now() + LOCAL_RETRY_COOLDOWN_MS).toISOString();
              localStorage.setItem(storageKey, JSON.stringify({ ...failure, expiresAt: localExpiry }));
            } else {
              localStorage.removeItem(storageKey);
            }
          } catch { /* Browser storage is an optimization; server policy remains authoritative. */ }
        }
        setPhase("insufficient");
        return;
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

  async function runExtendedResearch() {
    const sessionId = result?.research.sessionId;
    if (!result || !result.research.extendedAvailable || !sessionId) return;
    const startedAt = Date.now();
    const controller = new AbortController();
    activeRequest.current = controller;
    setExtendedStartedAt(startedAt);
    setExtendedElapsedSeconds(0);
    setExtendedError("");
    setExtendedProgressEvents([]);
    setExtendedPhase("running");
    try {
      const response = await fetch("/api/analyze/extended", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify({ sessionId }),
      });
      const payload: unknown = await readAnalysisStream(response, (progressEvent) => {
        if (progressEvent.type !== "heartbeat") {
          setExtendedProgressEvents((current) => [...current, progressEvent]);
        }
      });
      if (!response.ok) {
        const message = payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
          ? payload.message
          : "Extended Research could not complete.";
        throw new Error(message);
      }
      const parsed = parseAnalysisResponse(payload);
      if (!parsed) throw new Error("The server returned an invalid Extended Research response.");
      setResult(parsed);
      setExtendedElapsedSeconds(Math.floor((Date.now() - startedAt) / 1_000));
      setExtendedPhase("complete");
    } catch (cause) {
      setExtendedError(
        controller.signal.aborted
          ? "Extended Research was cancelled. Your original overview is unchanged."
          : cause instanceof Error
            ? cause.message
            : "Extended Research could not complete.",
      );
      setExtendedElapsedSeconds(Math.floor((Date.now() - startedAt) / 1_000));
      setExtendedPhase("error");
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null;
    }
  }

  function cancelExtendedResearch() {
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

  const resultIsVisible = result !== null && (phase !== "insufficient" || qualityOverride);

  return (
    <div className="analysis-layout" data-has-result={resultIsVisible ? "true" : "false"}>
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
              <details className="analysis-boundary"><summary>How URL analysis works</summary><p>The server reviews this page and up to six relevant links found on it. It normally stays on the same site; one application link may redirect to a public form host. Pages for a different named program are skipped. It does not run page scripts or crawl the wider web. Automated pages are labeled user supplied until a human verifies their provenance.</p></details>
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
            <button className="button" type="submit" disabled={!isConfigured || phase === "running" || extendedPhase === "running"}>
              {!isConfigured ? "Automatic extraction unavailable" : phase === "running" ? "Researching sources…" : "Analyze"}
            </button>
            {phase === "running" ? (
              <button className="button-quiet" type="button" onClick={cancelAnalysis}>
                Cancel analysis
              </button>
            ) : null}
          </div>
          <details className="analysis-boundary"><summary>Privacy and source boundaries</summary><p>Both URL and paste modes send supplied public source text to OpenAI for this response. Opportunity Facts does not intentionally retain it, but hosting, DNS/network, source-site, and OpenAI logs may exist. Do not submit signed or private URLs, application portals, personal information, or account-only content.</p></details>
        </form>
      </section>

      <aside className="analysis-progress" aria-labelledby="analysis-progress-title">
        <p className="eyebrow">Analysis record</p>
        <h2 id="analysis-progress-title">What the analysis includes</h2>
        <AnalysisRunStatus phase={phase} elapsedSeconds={elapsedSeconds} events={progressEvents} />
        <ol>
          <PipelineStep number="01" title="Validate source boundary" text="Allow only bounded public HTTP(S) or explicitly pasted text." />
          <PipelineStep number="02" title="Review relevant pages" text="Extract visible text and bounded page metadata; ignore executable scripts, boilerplate, and page instructions." />
          <PipelineStep number="03" title="Answer practical questions" text="Focus on the decision-useful facts a student needs first." />
          <PipelineStep number="04" title="Validate every excerpt" text="Match citations back to normalized source text before displaying support." />
        </ol>
        {!isConfigured || phase === "unconfigured" ? (
          <div className="configuration-notice">
            <span className="review-badge">Extraction not configured</span>
            <h3>The public product still works.</h3>
            <p>No server API key is available, so URL and pasted-text extraction are both paused. Your input has not been sent.</p>
            <div className="button-row">
              <Link className="button-secondary" href="/opportunities/breakthrough-junior-challenge-2026">Open a reference example</Link>
              <Link className="button-quiet" href="/build">Create manually</Link>
            </div>
          </div>
        ) : null}
      </aside>

      {phase === "insufficient" && qualityFailure && !qualityOverride ? <section className="analysis-insufficient" aria-labelledby="analysis-insufficient-title">
        <p className="eyebrow">Reliable result withheld</p><h2 id="analysis-insufficient-title">We couldn’t build a reliable Opportunity Facts card from this page.</h2>
        <p>Too much important information was missing, ambiguous, inaccessible, or internally incomplete.</p>
        {qualityFailure.reasons.length ? <ul>{qualityFailure.reasons.slice(0, 3).map((reason) => <li key={`${reason.title}:${reason.explanation}`}><strong>{reason.title}</strong><span>{reason.explanation}</span></li>)}</ul> : null}
        {qualityFailure.cached ? <p><strong>We already checked this unchanged page.</strong> No new model analysis was started.</p> : null}
        <div className="button-row">
          <button className="button-secondary" type="button" onClick={() => { setQualityFailure(null); setResult(null); setPhase("idle"); document.getElementById("analysis-url")?.focus(); }}>Try another official page</button>
          <button className="button-quiet" type="button" onClick={() => { setMode("text"); setQualityFailure(null); setResult(null); setPhase("idle"); }}>Add source text</button>
          <button className="button-quiet" type="button" onClick={() => { setUrl(""); setQualityFailure(null); setResult(null); setPhase("idle"); window.requestAnimationFrame(() => document.getElementById("analysis-url")?.focus()); }}>Analyze another opportunity</button>
          {qualityFailure.result ? <button className="button-quiet" type="button" onClick={() => setQualityOverrideConfirmation(true)}>{qualityFailure.cached ? "View previous incomplete result" : "View incomplete result anyway"}</button> : null}
        </div>
        {qualityOverrideConfirmation && qualityFailure.result ? (
          <div className="quality-override-confirmation" role="alert">
            <h3>Before you open this unfinished draft</h3>
            <p>This result failed Opportunity Facts’ quality checks. Important facts may be missing, ambiguous, or structurally incomplete. Treat it as an unfinished AI draft and verify claims against the attached sources.</p>
            <div className="button-row">
              <button className="button-warning" type="button" onClick={() => { setResult(qualityFailure.result); setQualityOverride(true); }}>View incomplete result</button>
              <button className="button-quiet" type="button" onClick={() => setQualityOverrideConfirmation(false)}>Keep it hidden</button>
            </div>
          </div>
        ) : null}
      </section> : null}

      {resultIsVisible && result ? (
        <section ref={resultSection} className="analysis-result" aria-labelledby="analysis-result-title">
          {qualityOverride ? (
            <div className="quality-override-warning" role="status">
              <strong>Incomplete result · quality gate overridden</strong>
              <span>Important facts may be missing, ambiguous, or structurally incomplete. Verify every claim against its attached source.</span>
            </div>
          ) : null}
          <div className="analysis-result-heading">
            <div>
              <p className="eyebrow">{qualityOverride ? "Unfinished AI draft" : result.research.depth === "extended" ? "Extended Research complete" : "Overview ready · Automated checks applied"}</p>
              <h2 ref={resultTitle} id="analysis-result-title" tabIndex={-1}>
                {qualityOverride ? "Inspect this incomplete result carefully." : "Your opportunity overview is ready."}
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
          {!qualityOverride && (result.research.extendedAvailable || extendedPhase !== "idle") ? (
            <ExtendedResearchPanel
              phase={extendedPhase}
              elapsedSeconds={extendedElapsedSeconds}
              events={extendedProgressEvents}
              error={extendedError}
              partial={Boolean(result.research.failedSections?.length)}
              onStart={() => void runExtendedResearch()}
              onCancel={cancelExtendedResearch}
            />
          ) : null}
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
          <OpportunityOverview
            card={result.card}
            embedded
            attentionItems={result.attentionItems}
            attentionLimit={result.research.depth === "extended" ? 5 : 3}
            fullEvidenceAvailable={result.research.depth === "extended"}
            assessedFieldIds={result.research.assessedFieldIds}
          />
          {result.research.depth === "extended" ? (
            <details className="analysis-full-record">
              <summary>
                <span><strong>Full Record</strong><small>Search every retained fact, structure, source, and evidence attachment.</small></span>
                <span>Open research workspace</span>
              </summary>
              <div className="analysis-full-record-content">
                <AnalyzedFullRecord card={result.card} assessedFieldIds={result.research.assessedFieldIds} />
              </div>
            </details>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function progressEventPresentation(event: AnalysisProgressEvent): { label: string; active: boolean } | null {
  if (event.type === "source_acquired") return { label: `${event.title} reviewed`, active: false };
  if (event.type === "source_failed") return { label: "A discovered page could not be acquired", active: false };
  if (event.type === "cycle_resolved") return { label: event.status === "resolved" ? `${event.label ?? "Cycle"} identified` : "Cycle needs clarification", active: false };
  if (event.type === "normal_model_started") return { label: "Answering the practical questions", active: true };
  if (event.type === "normal_model_completed") return { label: "Practical questions reviewed", active: false };
  if (event.type === "normal_model_failed") return { label: "The compact research response did not complete", active: false };
  if (event.type === "family_started") return { label: `Reviewing ${event.family.replaceAll("_", " ")}`, active: true };
  if (event.type === "family_completed") return { label: `${event.family.replaceAll("_", " ")} review complete`, active: false };
  if (event.type === "family_failed") return { label: `${event.family.replaceAll("_", " ")} review could not complete`, active: false };
  if (event.type === "validated_fact") return { label: `${event.label}: ${event.displayValue}`, active: false };
  if (event.type === "validation_complete") return { label: `${event.retained} supported facts retained; ${event.withheld} withheld`, active: false };
  if (event.type === "attention_ready") return { label: `${event.count} item${event.count === 1 ? "" : "s"} need attention`, active: false };
  if (event.type === "quality_complete") return { label: "Result quality checked", active: false };
  if (event.type === "extended_started") return { label: "Extended Research started", active: true };
  if (event.type === "extended_section_started") return { label: event.section === "financial" ? "Reviewing detailed costs and outcomes" : "Reviewing terms, relationships, and pathways", active: true };
  if (event.type === "extended_section_completed") return { label: event.section === "financial" ? "Detailed costs and outcomes checked" : "Terms, relationships, and pathways checked", active: false };
  if (event.type === "extended_section_failed") return { label: event.section === "financial" ? "Some financial details could not be completed" : "Some program details could not be completed", active: false };
  if (event.type === "extended_validation_complete") return { label: `${event.retained} extended claims retained; ${event.withheld} withheld`, active: false };
  if (event.type === "extended_complete") return { label: event.partial ? "Extended Research completed with some sections unavailable" : "Extended Research complete", active: false };
  return null;
}

function ResearchActivity({ events }: { events: AnalysisProgressEvent[] }) {
  if (!events.length) return null;
  return (
    <ol className="research-activity" aria-label="Live research activity">
      {events.slice(-7).map((event) => {
        const presentation = progressEventPresentation(event);
        return presentation ? <li key={event.sequence}><span aria-hidden="true">{presentation.active ? "◌" : "✓"}</span><span>{presentation.label}</span><time>{Math.round(event.elapsedMs / 1000)}s</time></li> : null;
      })}
    </ol>
  );
}

function ExtendedResearchPanel({
  phase,
  elapsedSeconds,
  events,
  error,
  partial,
  onStart,
  onCancel,
}: {
  phase: ExtendedPhase;
  elapsedSeconds: number;
  events: AnalysisProgressEvent[];
  error: string;
  partial: boolean;
  onStart: () => void;
  onCancel: () => void;
}) {
  return (
    <section className="extended-research" aria-labelledby="extended-research-title" data-state={phase}>
      <div>
        <p className="eyebrow">Optional follow-up</p>
        <h3 id="extended-research-title">Extended Research</h3>
        {phase === "idle" ? <p>Check more details about costs, terms, pathways, outcomes, relationships, and source evidence. Usually takes longer.</p> : null}
        {phase === "running" ? <p role="status">Your overview remains available while additional details are researched and validated.</p> : null}
        {phase === "complete" ? <p role="status">{partial ? "Extended Research completed with some sections unavailable. Safely completed details were retained; your original overview is unchanged." : "Additional supported details are now included. Full Record and Full Evidence PDF are available below."}</p> : null}
        {phase === "error" ? <p className="extended-research-error" role="alert"><strong>Extended Research could not complete.</strong> {error || "Your original overview remains unchanged."}</p> : null}
        {phase !== "idle" ? <small>{formatElapsed(elapsedSeconds)}</small> : null}
        {phase === "running" ? <ResearchActivity events={events} /> : null}
      </div>
      <div className="button-row no-print">
        {phase === "idle" ? <button className="button-secondary" type="button" onClick={onStart}>Extended Research</button> : null}
        {phase === "running" ? <button className="button-quiet" type="button" onClick={onCancel}>Cancel Extended Research</button> : null}
        {phase === "complete" ? <span className="extended-complete-mark">✓ Extended Research complete</span> : null}
      </div>
    </section>
  );
}

function AnalysisRunStatus({ phase, elapsedSeconds, events }: { phase: Phase; elapsedSeconds: number; events: AnalysisProgressEvent[] }) {
  const status = phase === "running"
    ? {
        title: "Analysis in progress",
        text: "Researching public pages and validating source-backed facts. Keep this tab open; completed work will appear here as the server reports it.",
      }
    : phase === "complete"
      ? { title: "Overview ready", text: "Review the acquired-page record and any warnings before relying on individual claims." }
      : phase === "error"
        ? { title: "No draft returned", text: "The error above explains what stopped this attempt; incomplete output is not presented as a finished card." }
        : phase === "insufficient"
          ? { title: "Reliable result withheld", text: "Use a stronger official page or add missing public source text." }
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
      {phase === "running" ? <ResearchActivity events={events} /> : null}
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
