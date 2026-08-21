"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { OpportunityOverview } from "@/components/opportunity-overview";
import type { AnalysisProgressEvent } from "@/lib/analysis/progress";
import type { SampleAnalysis } from "@/lib/sample-analysis/schema";
import {
  SAMPLE_ROTATION_STORAGE_KEY,
  parseSampleRotationState,
  rememberSample,
} from "@/lib/sample-analysis/selection";

function formatElapsed(milliseconds: number) {
  const seconds = Math.round(milliseconds / 100) / 10;
  return seconds < 60 ? `${seconds.toFixed(1)} sec` : `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;
}

function eventLabel(event: AnalysisProgressEvent) {
  if (event.type === "accepted") return "URL accepted";
  if (event.type === "cache_checked") return "Previous-result cache checked";
  if (event.type === "source_acquired") return `${event.title} reviewed`;
  if (event.type === "source_failed") return "A discovered page could not be acquired";
  if (event.type === "source_set_complete") return `${event.acquired} public page${event.acquired === 1 ? "" : "s"} acquired`;
  if (event.type === "cycle_resolved") return event.status === "resolved" ? `${event.label ?? "Cycle"} identified` : "Cycle needs clarification";
  if (event.type === "normal_model_started") return "Answering the practical questions";
  if (event.type === "normal_model_completed") return "Practical questions reviewed";
  if (event.type === "normal_model_failed") return "The compact research response did not complete";
  if (event.type === "validated_fact") return `${event.label}: ${event.displayValue}`;
  if (event.type === "validation_complete") return `${event.retained} supported facts retained; ${event.withheld} withheld`;
  if (event.type === "attention_ready") return `${event.count} item${event.count === 1 ? "" : "s"} need attention`;
  if (event.type === "quality_complete") return "Result quality checked";
  if (event.type === "family_started") return `Reviewing ${event.family.replaceAll("_", " ")}`;
  if (event.type === "family_completed") return `${event.family.replaceAll("_", " ")} review complete`;
  if (event.type === "family_failed") return `${event.family.replaceAll("_", " ")} review could not complete`;
  return null;
}

export function SampleAnalysisReplay({ sample }: { sample: SampleAnalysis }) {
  const [visibleCount, setVisibleCount] = useState(0);
  const resultSection = useRef<HTMLElement | null>(null);
  const resultTitle = useRef<HTMLHeadingElement | null>(null);
  const complete = visibleCount >= sample.progress.length;
  const visibleEvents = useMemo(
    () => sample.progress.slice(0, visibleCount).map(({ event }) => event),
    [sample.progress, visibleCount],
  );

  useEffect(() => {
    const current = parseSampleRotationState(window.localStorage.getItem(SAMPLE_ROTATION_STORAGE_KEY));
    window.localStorage.setItem(
      SAMPLE_ROTATION_STORAGE_KEY,
      JSON.stringify(rememberSample(current, sample.id)),
    );
    const timers = sample.progress.map(({ replayAtMs }, index) => window.setTimeout(
      () => setVisibleCount((current) => Math.max(current, index + 1)),
      replayAtMs,
    ));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [sample.id, sample.progress]);

  useEffect(() => {
    if (!complete) return;
    resultTitle.current?.focus({ preventScroll: true });
    resultSection.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
  }, [complete]);

  const activity = visibleEvents
    .map((event) => ({ event, label: eventLabel(event) }))
    .filter((item): item is { event: AnalysisProgressEvent; label: string } => Boolean(item.label))
    .slice(-7);

  return (
    <div className="analysis-layout" data-has-result={complete ? "true" : "false"}>
      <section className="panel analysis-input" aria-labelledby="sample-analysis-title">
        <div className="analysis-input-header">
          <details className="review-state-explanation">
            <summary
              className="review-badge"
              data-description="Sample analysis — A replay of an actual saved analyzer run. It makes no live provider request. Progress uses recorded timing, and the result retains the saved facts, Needs Attention items, and evidence."
            >
              <span>Sample analysis</span>
              <span className="review-badge-help" aria-hidden="true">i</span>
              <span className="sr-only">. This replays an actual saved analyzer run at its recorded pace and makes no live provider request. Activate for details.</span>
            </summary>
          </details>
          <h2 id="sample-analysis-title">{sample.label}</h2>
          <p>{sample.category}</p>
        </div>
        <div className="analysis-form">
          <label htmlFor="sample-url">Submitted public URL</label>
          <input id="sample-url" type="url" value={sample.submittedUrl} readOnly />
          <div className="button-row">
            {!complete ? (
              <button className="button button-secondary" type="button" onClick={() => setVisibleCount(sample.progress.length)}>
                Skip to result
              </button>
            ) : null}
            <Link className="button button-secondary" href="/analyze?sample=next">Try another sample</Link>
            <Link className="button button-primary" href="/analyze">Analyze your own URL</Link>
          </div>
        </div>
      </section>

      <aside className="analysis-progress" aria-labelledby="sample-activity-title">
        <div className="analysis-run-status" data-state={complete ? "complete" : "running"} role="status" aria-live="polite">
          <span className="analysis-run-indicator" aria-hidden="true" />
          <div>
            <strong>{complete ? "Sample result ready" : `Replaying ${sample.label}`}</strong>
            <p>{complete ? `Completed in ${formatElapsed(sample.recordedDurationMs)}` : "Activity appears at the timing of the original run."}</p>
          </div>
        </div>
        <h2 id="sample-activity-title">Research activity</h2>
        <ol aria-live="polite">
          {activity.map(({ event, label }) => (
            <li key={event.sequence} data-state="complete">
              <span aria-hidden="true">✓</span>
              <div>
                <h3>{label}</h3>
                <small>{formatElapsed(event.elapsedMs)}</small>
              </div>
            </li>
          ))}
        </ol>
      </aside>

      {complete ? (
        <section ref={resultSection} className="analysis-result" aria-labelledby="sample-result-title">
          <div className="analysis-result-heading">
            <div>
              <h2 ref={resultTitle} id="sample-result-title" tabIndex={-1}>Sample analysis result</h2>
              <p>{sample.result.reviewedPages.length} source page{sample.result.reviewedPages.length === 1 ? "" : "s"} represented</p>
            </div>
          </div>
          {sample.result.pageWarnings.length ? (
            <div className="notice"><strong>{sample.result.pageWarnings.length} source acquisition warning{sample.result.pageWarnings.length === 1 ? "" : "s"} occurred.</strong></div>
          ) : null}
          {sample.result.evidenceWarnings.length ? (
            <div className="notice"><strong>{sample.result.evidenceWarnings.length} candidate evidence warning{sample.result.evidenceWarnings.length === 1 ? "" : "s"} was withheld or recorded.</strong></div>
          ) : null}
          <OpportunityOverview
            card={sample.result.card}
            embedded
            attentionItems={sample.result.attentionItems}
            attentionLimit={3}
            fullEvidenceAvailable={false}
            assessedFieldIds={sample.result.assessedFieldIds}
          />
        </section>
      ) : null}
    </div>
  );
}
