"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { OpportunityOverview } from "@/components/opportunity-overview";
import { ResearchWorkspace, SampleAnalysisBadge } from "@/components/research-workspace";
import type { SampleAnalysis } from "@/lib/sample-analysis/schema";
import { SAMPLE_ROTATION_STORAGE_KEY, parseSampleRotationState, rememberSample } from "@/lib/sample-analysis/selection";

export function SampleAnalysisReplay({ sample }: { sample: SampleAnalysis }) {
  const [visibleCount, setVisibleCount] = useState(0);
  const resultSection = useRef<HTMLElement | null>(null);
  const resultTitle = useRef<HTMLHeadingElement | null>(null);
  const complete = visibleCount >= sample.progress.length;
  const visibleEvents = useMemo(() => sample.progress.slice(0, visibleCount).map(({ event }) => event), [sample.progress, visibleCount]);
  const elapsedMs = visibleEvents.at(-1)?.elapsedMs ?? 0;

  useEffect(() => {
    const current = parseSampleRotationState(window.localStorage.getItem(SAMPLE_ROTATION_STORAGE_KEY));
    window.localStorage.setItem(SAMPLE_ROTATION_STORAGE_KEY, JSON.stringify(rememberSample(current, sample.id)));
    const timers = sample.progress.map(({ replayAtMs }, index) => window.setTimeout(
      () => setVisibleCount((currentCount) => Math.max(currentCount, index + 1)), replayAtMs,
    ));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [sample.id, sample.progress]);

  useEffect(() => {
    if (!complete) return;
    resultTitle.current?.focus({ preventScroll: true });
    resultSection.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }, [complete]);

  return (
    <div className="analysis-layout sample-analysis-layout" data-has-result={complete ? "true" : "false"} data-phase={complete ? "complete" : "running"}>
      {!complete ? (
        <ResearchWorkspace
          events={visibleEvents}
          elapsedMs={elapsedMs}
          fallbackName={sample.label}
          context={new URL(sample.submittedUrl).hostname}
          badge={<SampleAnalysisBadge />}
          actions={<button className="button-quiet" type="button" onClick={() => setVisibleCount(sample.progress.length)}>Skip to result</button>}
        />
      ) : null}
      {complete ? (
        <section ref={resultSection} className="analysis-result" aria-labelledby="sample-result-title">
          <div className="analysis-result-heading sample-result-heading">
            <span className="analysis-complete-mark" aria-hidden="true">✓</span>
            <div><h2 ref={resultTitle} id="sample-result-title" tabIndex={-1}>Sample analysis result</h2><p>{sample.result.reviewedPages.length} source page{sample.result.reviewedPages.length === 1 ? "" : "s"} represented</p></div>
            <SampleAnalysisBadge />
          </div>
          <div className="sample-result-actions no-print">
            <Link className="button-secondary" href="/analyze?sample=next">Try another sample</Link>
            <Link className="button" href="/analyze">Analyze your own URL</Link>
          </div>
          {sample.result.pageWarnings.length ? <p className="analysis-warning-note"><strong>{sample.result.pageWarnings.length} relevant page{sample.result.pageWarnings.length === 1 ? " couldn’t" : "s couldn’t"} be accessed.</strong></p> : null}
          <OpportunityOverview card={sample.result.card} embedded attentionItems={sample.result.attentionItems} attentionLimit={3} fullEvidenceAvailable={false} assessedFieldIds={sample.result.assessedFieldIds} />
        </section>
      ) : null}
    </div>
  );
}
