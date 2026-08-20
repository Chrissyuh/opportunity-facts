"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  opportunityCardSchema,
  type OpportunityCard,
} from "@/lib/opportunity/schema";
import type { AnalysisProgressEvent } from "@/lib/analysis/progress";
import type { AttentionItem } from "@/lib/analysis/attention";
import { FIELD_IDS, type FieldId } from "@/lib/opportunity/fields";
import { OpportunityOverview } from "./opportunity-overview";

type ItemState =
  "queued" | "running" | "ready" | "insufficient" | "failed" | "cancelled";
type BatchItem = {
  url: string;
  state: ItemState;
  events: AnalysisProgressEvent[];
  card?: OpportunityCard;
  attentionItems?: AttentionItem[];
  message?: string;
};
const fieldIds = new Set<string>(FIELD_IDS);
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function parseAttentionItems(value: unknown): AttentionItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): AttentionItem[] => {
    if (
      !record(item) ||
      typeof item.id !== "string" ||
      typeof item.title !== "string" ||
      typeof item.explanation !== "string" ||
      !Array.isArray(item.fieldIds) ||
      !item.fieldIds.every((id) => typeof id === "string" && fieldIds.has(id))
    )
      return [];
    if (
      ![
        "cost",
        "deadline",
        "eligibility",
        "organization_relationship",
        "selection",
        "outcome",
        "refund",
        "source_coverage",
        "cycle",
        "other",
      ].includes(String(item.category)) ||
      !["high", "medium", "low"].includes(String(item.priority))
    )
      return [];
    return [
      {
        id: item.id,
        category: item.category as AttentionItem["category"],
        priority: item.priority as AttentionItem["priority"],
        title: item.title,
        explanation: item.explanation,
        fieldIds: item.fieldIds as FieldId[],
        claimIds: Array.isArray(item.claimIds)
          ? item.claimIds.filter((id): id is string => typeof id === "string")
          : [],
        sourceIds: Array.isArray(item.sourceIds)
          ? item.sourceIds.filter((id): id is string => typeof id === "string")
          : [],
        suggestedNextStep:
          typeof item.suggestedNextStep === "string"
            ? item.suggestedNextStep
            : null,
        origin:
          item.origin === "model_grounded"
            ? "model_grounded"
            : "deterministic_fallback",
      },
    ];
  });
}

async function readStream(
  response: Response,
  onProgress: (event: AnalysisProgressEvent) => void,
) {
  if (!response.ok)
    throw new Error(
      (await response.json().catch(() => null))?.message ??
        "Analysis could not start.",
    );
  const reader = response.body?.getReader();
  if (!reader) throw new Error("The analysis stream was unavailable.");
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const message = JSON.parse(line) as {
        type: string;
        event?: AnalysisProgressEvent;
        result?: unknown;
        message?: string;
      };
      if (message.type === "progress" && message.event)
        onProgress(message.event);
      if (message.type === "error")
        throw new Error(message.message ?? "Analysis failed.");
      if (message.type === "complete") return message.result;
    }
    if (done) break;
  }
  throw new Error("The analysis ended before a complete result arrived.");
}

function latestActivity(item: BatchItem) {
  const event = item.events.at(-1);
  if (!event)
    return item.state === "queued"
      ? "Waiting for an extraction slot…"
      : "Starting research…";
  if (event.type === "source_acquired") return `Reviewed ${event.title}`;
  if (event.type === "source_set_complete")
    return `Reviewed ${event.acquired} page${event.acquired === 1 ? "" : "s"}`;
  if (event.type === "validated_fact") return `${event.label} supported`;
  if (event.type === "family_started")
    return `Reviewing ${event.family.replaceAll("_", " ")}…`;
  if (event.type === "validation_complete")
    return `${event.retained} supported facts retained`;
  if (event.type === "cache_checked" && event.state === "hit")
    return "Using a current site-quality result";
  return "Research in progress…";
}

export function BatchAnalysisWorkbench({
  configured,
}: {
  configured: boolean;
}) {
  const [isConfigured, setIsConfigured] = useState(configured);
  const [text, setText] = useState("");
  const [items, setItems] = useState<BatchItem[]>([]);
  const [error, setError] = useState("");
  const [batchRunning, setBatchRunning] = useState(false);
  const controllers = useRef(new Map<string, AbortController>());
  const cancelledUrls = useRef(new Set<string>());

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/analyze", { cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((value: unknown) => {
        if (record(value) && typeof value.configured === "boolean") setIsConfigured(value.configured);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  function update(url: string, change: (item: BatchItem) => BatchItem) {
    setItems((current) =>
      current.map((item) => (item.url === url ? change(item) : item)),
    );
  }

  async function runOne(url: string) {
    if (cancelledUrls.current.has(url)) return;
    const controller = new AbortController();
    controllers.current.set(url, controller);
    update(url, (item) => ({ ...item, state: "running" }));
    try {
      const result = await readStream(
        await fetch("/api/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/x-ndjson",
          },
          body: JSON.stringify({ mode: "url", url }),
          signal: controller.signal,
        }),
        (event) =>
          update(url, (item) => ({ ...item, events: [...item.events, event] })),
      );
      if (
        result &&
        typeof result === "object" &&
        (result as { kind?: string }).kind === "quality_failure"
      ) {
        const reasons = (
          (
            result as {
              quality?: { reasons?: Array<{ explanation?: string }> };
            }
          ).quality?.reasons ?? []
        )
          .map((reason) => reason.explanation)
          .filter(Boolean);
        update(url, (item) => ({
          ...item,
          state: "insufficient",
          message:
            reasons.slice(0, 3).join(" ") ||
            "The available pages did not support a reliable card.",
        }));
      } else {
        const parsed = opportunityCardSchema.safeParse(
          (result as { card?: unknown })?.card,
        );
        if (!parsed.success)
          throw new Error("The completed result did not contain a valid card.");
        update(url, (item) => ({
          ...item,
          state: "ready",
          card: parsed.data,
          attentionItems: parseAttentionItems(
            (result as { attentionItems?: unknown }).attentionItems,
          ),
        }));
      }
    } catch (cause) {
      update(url, (item) => ({
        ...item,
        state: controller.signal.aborted ? "cancelled" : "failed",
        message: controller.signal.aborted
          ? "Cancelled."
          : cause instanceof Error
            ? cause.message
            : "Analysis failed.",
      }));
    } finally {
      controllers.current.delete(url);
    }
  }

  async function start(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (batchRunning) return;
    const entered = text
      .split(/[\n,]+/)
      .map((url) => url.trim())
      .filter(Boolean);
    if (entered.length > 5) {
      setError("Demo limit: enter no more than 5 opportunities per batch.");
      return;
    }
    try {
      const response = await fetch("/api/analyze/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: entered }),
      });
      const manifest = (await response.json()) as {
        urls?: string[];
        concurrency?: number;
        message?: string;
      };
      if (!response.ok || !manifest.urls)
        throw new Error(manifest.message ?? "The batch could not start.");
      const next = manifest.urls.map((url) => ({
        url,
        state: "queued" as const,
        events: [],
      }));
      cancelledUrls.current.clear();
      setItems(next);
      setBatchRunning(true);
      let cursor = 0;
      const worker = async () => {
        while (cursor < next.length) {
          const item = next[cursor++];
          await runOne(item.url);
        }
      };
      await Promise.all(
        Array.from(
          { length: Math.min(manifest.concurrency ?? 2, next.length) },
          worker,
        ),
      );
      setBatchRunning(false);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "The batch could not start.",
      );
    }
  }

  function cancel(url: string) {
    cancelledUrls.current.add(url);
    controllers.current.get(url)?.abort();
    update(url, (item) =>
      item.state === "queued" ? { ...item, state: "cancelled" } : item,
    );
  }
  function cancelAll() {
    items.forEach((item) => cancelledUrls.current.add(item.url));
    controllers.current.forEach((controller) => controller.abort());
    setItems((current) =>
      current.map((item) =>
        item.state === "queued" ? { ...item, state: "cancelled" } : item,
      ),
    );
  }

  return (
    <div className="batch-workbench">
      <form className="batch-input-panel" onSubmit={start}>
        <label htmlFor="batch-urls">Opportunity URLs</label>
        <textarea
          id="batch-urls"
          rows={6}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={
            "https://example.org/program-one\nhttps://example.org/program-two"
          }
          required
          disabled={batchRunning || !isConfigured}
        />
        <p>One URL per line. Duplicates are removed before analysis.</p>
        <div className="button-row">
          <button
            className="button"
            type="submit"
            disabled={batchRunning || !isConfigured}
          >
            {!isConfigured
              ? "Automatic extraction unavailable"
              : batchRunning
                ? "Batch in progress…"
                : "Analyze batch"}
          </button>
          {items.some(
            (item) => item.state === "running" || item.state === "queued",
          ) ? (
            <button className="button-quiet" type="button" onClick={cancelAll}>
              Cancel all
            </button>
          ) : null}
        </div>
        {!isConfigured ? (
          <div className="configuration-notice">
            <strong>Batch analysis is not configured.</strong>
            <p>
              No source input has been sent. You can still explore reviewed
              examples or build a card manually.
            </p>
            <div className="button-row">
              <Link className="button-secondary" href="/opportunities">
                Explore examples
              </Link>
              <Link className="button-quiet" href="/build">
                Create manually
              </Link>
            </div>
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="form-error">
            {error}
          </p>
        ) : null}
      </form>
      <div className="batch-list" aria-live="polite">
        {items.map((item) => (
          <article
            className="batch-item"
            key={item.url}
            data-state={item.state}
          >
            <header>
              <div>
                <span className="batch-state">
                  {item.state === "ready"
                    ? "Draft ready"
                    : item.state === "insufficient"
                      ? "Could not build a reliable card"
                      : item.state}
                </span>
                <h2>
                  {item.card?.facts.opportunity_name.displayValue ??
                    new URL(item.url).hostname}
                </h2>
                <p>
                  {item.state === "running" || item.state === "queued"
                    ? latestActivity(item)
                    : item.message}
                </p>
              </div>
              {item.state === "running" || item.state === "queued" ? (
                <button
                  className="button-quiet"
                  type="button"
                  onClick={() => cancel(item.url)}
                >
                  Cancel
                </button>
              ) : null}
            </header>
            {item.card ? (
              <details className="batch-result">
                <summary>Open completed overview</summary>
              <OpportunityOverview card={item.card} embedded attentionItems={item.attentionItems} />
              </details>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
