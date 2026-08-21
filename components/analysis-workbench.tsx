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
import type { ReviewedPageSummary } from "@/lib/analysis/pipeline";
import type { AnalysisProgressEvent } from "@/lib/analysis/progress";
import { ANALYZER_VERSION } from "@/lib/analysis/analyzer-version";
import { normalizeAnalysisUrlInput } from "@/lib/opportunity/url-input";
import { OpportunityOverview } from "./opportunity-overview";
import { ResearchActivity as SharedResearchActivity, ResearchWorkspace } from "./research-workspace";

const AnalyzedFullRecord = dynamic(() =>
  import("./analyzed-full-record").then((module) => module.AnalyzedFullRecord));

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
  const [url, setUrl] = useState(initialUrl);
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
  const analysisForm = useRef<HTMLFormElement | null>(null);
  const autoStartPending = useRef(false);
  const resultSection = useRef<HTMLElement | null>(null);
  const resultTitle = useRef<HTMLHeadingElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    try {
      const handedOffUrl = sessionStorage.getItem(ANALYSIS_URL_HANDOFF_KEY);
      if (handedOffUrl) {
        const normalized = normalizeAnalysisUrlInput(handedOffUrl);
        if (normalized.ok) {
          autoStartPending.current = true;
          queueMicrotask(() => setUrl(normalized.url));
        } else {
          queueMicrotask(() => setError(normalized.message));
        }
      }
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
    if (!autoStartPending.current || !isConfigured || !url || phase !== "idle") return;
    autoStartPending.current = false;
    analysisForm.current?.requestSubmit();
  }, [isConfigured, phase, url]);

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
      const response = await fetch("/api/analyze/suppression", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "url", url: canonicalUrl }),
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
    const normalized = normalizeAnalysisUrlInput(url);
    if (!normalized.ok) {
      setError(normalized.message);
      setPhase("idle");
      return;
    }
    const analysisUrl = normalized.url;
    setUrl(analysisUrl);
    {
      try {
        const canonical = new URL(analysisUrl).href;
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
        body: JSON.stringify({ mode: "url", url: analysisUrl }),
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
        {
          const storageKey = `${LOCAL_QUALITY_PREFIX}${ANALYZER_VERSION}:${new URL(analysisUrl).href}`;
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

  const resultIsVisible = result !== null && (phase !== "insufficient" || qualityOverride);
  const normalizedDisplayUrl = normalizeAnalysisUrlInput(url);
  const researchHost = normalizedDisplayUrl.ok ? new URL(normalizedDisplayUrl.url).hostname : url;

  return (
    <div className="analysis-layout" data-has-result={resultIsVisible ? "true" : "false"} data-phase={phase} aria-busy={phase === "running"}>
      {phase === "running" ? (
        <ResearchWorkspace
          events={progressEvents}
          elapsedMs={elapsedSeconds * 1_000}
          fallbackName="Opportunity research"
          context={researchHost}
          actions={<button className="button-quiet" type="button" onClick={cancelAnalysis}>Cancel analysis</button>}
        />
      ) : phase !== "complete" && phase !== "insufficient" ? <>
      <section className="analysis-input panel" aria-labelledby="analysis-input-title">
        <div className="analysis-input-header">
          <p className="eyebrow">Source input</p>
          <h2 id="analysis-input-title">Paste the opportunity page.</h2>
          <p>Opportunity Facts will check this page and relevant public pages linked from it.</p>
        </div>

        <form ref={analysisForm} className="analysis-form stack" onSubmit={submit}>
          <div className="field">
            <label htmlFor="analysis-url">Public opportunity URL</label>
            <input
              id="analysis-url"
              type="text"
              inputMode="url"
              autoComplete="url"
              placeholder="program.org/apply"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              required
            />
            <details className="analysis-boundary"><summary>How URL analysis works</summary><p>The server reviews this page and up to six relevant links found on it. It normally stays on the same site; one application link may redirect to a public form host. Pages for a different named program are skipped. It does not run page scripts or crawl the wider web.</p></details>
          </div>

          {error ? <div className="error-summary" role="alert"><strong>Analysis did not complete.</strong> {error}</div> : null}
          <div className="button-row">
            <button className="button" type="submit" disabled={!isConfigured || extendedPhase === "running"}>
              {!isConfigured ? "Automatic extraction unavailable" : "Analyze"}
            </button>
          </div>
          <details className="analysis-boundary"><summary>Privacy and source boundaries</summary><p>Public page text is sent to OpenAI for this response. Opportunity Facts keeps a bounded continuation session for up to 30 minutes when Extended Research is available; hosting, DNS/network, source-site, and provider logs may also exist. Do not submit signed or private URLs, application portals, personal information, or account-only content.</p></details>
          {!isConfigured || phase === "unconfigured" ? (
            <div className="configuration-notice">
              <span className="review-badge">Extraction not configured</span>
              <h3>Live analysis is paused.</h3>
              <p>Your input has not been sent.</p>
              <div className="button-row">
                <Link className="button-secondary" href="/analyze?sample=next">Try a sample</Link>
                <Link className="button-quiet" href="/how-it-works">How it works</Link>
              </div>
            </div>
          ) : null}
        </form>
      </section>
      </> : null}

      {phase === "insufficient" && qualityFailure && !qualityOverride ? <section className="analysis-insufficient" aria-labelledby="analysis-insufficient-title">
        <p className="eyebrow">Reliable result withheld</p><h2 id="analysis-insufficient-title">We couldn’t build a reliable Opportunity Facts card from this page.</h2>
        <p>Too much important information was missing, ambiguous, inaccessible, or internally incomplete.</p>
        {qualityFailure.reasons.length ? <ul>{qualityFailure.reasons.slice(0, 3).map((reason) => <li key={`${reason.title}:${reason.explanation}`}><strong>{reason.title}</strong><span>{reason.explanation}</span></li>)}</ul> : null}
        {qualityFailure.cached ? <p><strong>We already checked this unchanged page.</strong> No new model analysis was started.</p> : null}
        <div className="button-row">
          <button className="button-secondary" type="button" onClick={() => { setQualityFailure(null); setResult(null); setPhase("idle"); document.getElementById("analysis-url")?.focus(); }}>Try another official page</button>
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
            <span className="analysis-complete-mark" aria-hidden="true">✓</span>
            <h2 ref={resultTitle} id="analysis-result-title" tabIndex={-1}>
              {qualityOverride ? "Incomplete result" : result.research.depth === "extended" ? "Extended Research complete" : "Analysis complete"}
            </h2>
          </div>
          <OpportunityOverview
            card={result.card}
            embedded
            attentionItems={result.attentionItems}
            attentionLimit={result.research.depth === "extended" ? 5 : 3}
            fullEvidenceAvailable={result.research.depth === "extended"}
            assessedFieldIds={result.research.assessedFieldIds}
            resultActions={!qualityOverride && (result.research.extendedAvailable || extendedPhase !== "idle") ? (
              <ExtendedResearchPanel
                phase={extendedPhase}
                elapsedSeconds={extendedElapsedSeconds}
                events={extendedProgressEvents}
                error={extendedError}
                partial={Boolean(result.research.failedSections?.length)}
                onStart={() => void runExtendedResearch()}
                onCancel={cancelExtendedResearch}
              />
            ) : undefined}
          />
          <details className="analysis-sources">
            <summary>
              <span>Sources reviewed</span>
              <span>{result.reviewedPages.length} page{result.reviewedPages.length === 1 ? "" : "s"}</span>
            </summary>
            {result.pageWarnings.length ? (
              <details className="page-warning-panel">
                <summary>{result.pageWarnings.length} relevant page{result.pageWarnings.length === 1 ? " couldn’t" : "s couldn’t"} be accessed</summary>
                <ul>
                  {result.pageWarnings.map((warning, index) => (
                    <li key={`${warning.url}-${warning.code}-${index}`}>
                      <strong>{sanitizePageWarningUrl(warning.url) ?? "Page URL unavailable"}</strong>
                      <span>{pageWarningReason(warning.code)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
            <ol className="reviewed-page-list">
              {result.reviewedPages.map((page) => (
                <li key={page.id}>
                  <a href={page.url} target="_blank" rel="noreferrer noopener">{page.title} <span aria-hidden="true">↗</span></a>
                  {page.truncated || page.truncatedForModel || page.contentUnavailable ? <small>Only acquired, extractable text was assessed.</small> : null}
                </li>
              ))}
            </ol>
            {result.evidenceWarnings.length ? <p className="analysis-warning-note"><strong>{result.evidenceWarnings.length} candidate warning{result.evidenceWarnings.length === 1 ? "" : "s"} withheld.</strong> Only surviving source-backed claims appear above.</p> : null}
            <details className="analysis-draft-note">
              <summary>About this draft</summary>
              <p>Automated checks matched retained excerpts to acquired source text. This is not human review or a verdict about the opportunity. Verify important claims against the linked sources.</p>
            </details>
          </details>
          <details className="analysis-more-actions no-print">
            <summary>Save or edit</summary>
            <div className="button-row">
              <button className="button-secondary" type="button" onClick={() => saveDraft()}>Save locally</button>
              <button className="button-quiet" type="button" onClick={() => saveDraft(true)}>Edit draft</button>
              <button className="button-quiet" type="button" onClick={() => downloadCard(result.card)}>Export JSON</button>
            </div>
            <p className="action-message" role="status" aria-live="polite">{localMessage}</p>
          </details>
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
        {phase === "running" ? <SharedResearchActivity events={events} /> : null}
      </div>
      <div className="button-row no-print">
        {phase === "idle" ? <button className="button-secondary" type="button" onClick={onStart}>Extended Research</button> : null}
        {phase === "running" ? <button className="button-quiet" type="button" onClick={onCancel}>Cancel Extended Research</button> : null}
        {phase === "complete" ? <span className="extended-complete-mark">✓ Extended Research complete</span> : null}
      </div>
    </section>
  );
}
