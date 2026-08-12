"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
type Phase = "idle" | "reviewing" | "validating" | "complete" | "error" | "unconfigured";

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

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);
    setLocalMessage("");
    if (!isConfigured) {
      setPhase("unconfigured");
      return;
    }
    setPhase("reviewing");
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(mode === "url" ? { mode, url } : { mode, sources }),
      });
      setPhase("validating");
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
      setPhase("complete");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The sources could not be analyzed.");
      setPhase("error");
    }
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

  return (
    <div className="analysis-layout">
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
              <p className="field-help">The server reviews this page and at most six relevant pages on the same origin. It does not run page scripts or crawl the wider web. Automated pages are labeled user supplied until a human verifies their provenance.</p>
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
          <button className="button" type="submit" disabled={!isConfigured || phase === "reviewing" || phase === "validating"}>
            {!isConfigured ? "Automatic extraction unavailable" : phase === "reviewing" || phase === "validating" ? "Reviewing sources…" : "Start analysis"}
          </button>
          <div className="notice">
            <strong>Privacy boundary.</strong> Both URL and paste modes send supplied public source text to OpenAI for this response. Opportunity Facts does not intentionally retain it, but hosting, DNS/network, source-site, and OpenAI logs may exist. Do not submit signed or private URLs, application portals, personal information, or account-only content.
          </div>
        </form>
      </section>

      <aside className="analysis-progress" aria-labelledby="analysis-progress-title" aria-live="polite">
        <p className="eyebrow">Analysis record</p>
        <h2 id="analysis-progress-title">What the pipeline is doing</h2>
        <ol>
          <ProgressStep number="01" title="Validate source boundary" state={phase === "idle" || phase === "unconfigured" ? "waiting" : "complete"} text="Allow only bounded public HTTP(S) or explicitly pasted text." />
          <ProgressStep number="02" title="Review relevant pages" state={phase === "reviewing" ? "active" : phase === "validating" || phase === "complete" ? "complete" : "waiting"} text="Extract visible text; ignore scripts, boilerplate, and page instructions." />
          <ProgressStep number="03" title="Structure the disclosures" state={phase === "validating" ? "active" : phase === "complete" ? "complete" : "waiting"} text="Return registered fields only; preserve missing, unclear, and conflict states." />
          <ProgressStep number="04" title="Validate every excerpt" state={phase === "complete" ? "complete" : "waiting"} text="Match citations back to normalized source text before displaying support." />
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
        <section className="analysis-result" aria-labelledby="analysis-result-title">
          <div className="analysis-result-heading">
            <div>
              <p className="eyebrow">Draft ready · Automated evidence checks complete</p>
              <h2 id="analysis-result-title">Inspect and correct the draft.</h2>
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
            {result.pageWarnings.length ? <p className="fine-print">{result.pageWarnings.length} discovered page{result.pageWarnings.length === 1 ? "" : "s"} could not be reviewed; the card lists only pages actually checked.</p> : null}
            {result.evidenceWarnings.length ? <div className="notice"><strong>{result.evidenceWarnings.length} unsupported model citation{result.evidenceWarnings.length === 1 ? " was" : "s were"} removed.</strong> Facts retain only other validated support or an explicit uncertainty state.</div> : null}
          </div>
          <FactsCard card={result.card} embedded />
        </section>
      ) : null}
    </div>
  );
}

function ProgressStep({ number, title, text, state }: { number: string; title: string; text: string; state: "waiting" | "active" | "complete" }) {
  return (
    <li data-state={state}>
      <span>{state === "complete" ? "✓" : number}</span>
      <div><h3>{title}</h3><p>{text}</p></div>
      <small>{state}</small>
    </li>
  );
}
