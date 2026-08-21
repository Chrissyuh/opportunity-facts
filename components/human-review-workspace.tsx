"use client";

import { useEffect, useMemo, useState } from "react";

import {
  HUMAN_REVIEW_CONFIRMATION,
  HUMAN_REVIEW_FORMAT_VERSION,
  type HumanReviewManifest,
  type HumanReviewPacket,
} from "@/lib/review/human-review";

interface SavedProgress {
  checkedItemIds: string[];
  reviewer: string;
  notes: string;
  acknowledged: boolean;
}

function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], {
    type: "application/json",
  });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(href);
}

export function HumanReviewWorkspace({
  manifest,
}: {
  manifest: HumanReviewManifest;
}) {
  const storageKey = `opportunity-facts:human-review:${manifest.slug}:${manifest.reviewedContentSha256}`;
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [reviewer, setReviewer] = useState("");
  const [notes, setNotes] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved !== null) {
          const parsed = JSON.parse(saved) as Partial<SavedProgress>;
          const allowed = new Set(manifest.expectedItemIds);
          setChecked(new Set(
            Array.isArray(parsed.checkedItemIds)
              ? parsed.checkedItemIds.filter((id): id is string => typeof id === "string" && allowed.has(id))
              : [],
          ));
          setReviewer(typeof parsed.reviewer === "string" ? parsed.reviewer : "");
          setNotes(typeof parsed.notes === "string" ? parsed.notes : "");
          setAcknowledged(parsed.acknowledged === true);
        }
      } catch {
        localStorage.removeItem(storageKey);
      } finally {
        setRestored(true);
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [manifest.expectedItemIds, storageKey]);

  useEffect(() => {
    if (!restored) return;
    const progress: SavedProgress = {
      checkedItemIds: manifest.expectedItemIds.filter((id) => checked.has(id)),
      reviewer,
      notes,
      acknowledged,
    };
    localStorage.setItem(storageKey, JSON.stringify(progress));
  }, [acknowledged, checked, manifest.expectedItemIds, notes, restored, reviewer, storageKey]);

  const completed = checked.size;
  const total = manifest.expectedItemIds.length;
  const complete = completed === total;
  const canDownload = complete && reviewer.trim().length > 0 && acknowledged;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  const sourceCount = useMemo(
    () => manifest.sections.find((section) => section.id === "source-inventory")?.items.length ?? 0,
    [manifest.sections],
  );

  function toggleItem(itemId: string): void {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function toggleSection(itemIds: readonly string[]): void {
    setChecked((current) => {
      const next = new Set(current);
      const allChecked = itemIds.every((id) => next.has(id));
      itemIds.forEach((id) => {
        if (allChecked) next.delete(id);
        else next.add(id);
      });
      return next;
    });
  }

  function exportPacket(): void {
    if (!canDownload) return;
    const packet: HumanReviewPacket = {
      kind: "human_review_packet",
      formatVersion: HUMAN_REVIEW_FORMAT_VERSION,
      slug: manifest.slug,
      opportunityId: manifest.opportunityId,
      schemaVersion: manifest.schemaVersion,
      reviewedCardVersion: manifest.reviewedCardVersion,
      targetCardVersion: manifest.targetCardVersion,
      reviewedContentSha256: manifest.reviewedContentSha256,
      manifestSha256: manifest.manifestSha256,
      completedItemIds: [...manifest.expectedItemIds],
      reviewer: reviewer.trim(),
      notes: notes.trim() || null,
      preparedAt: new Date().toISOString(),
      reviewerConfirmedReview: true,
    };
    downloadJson(`${manifest.slug}.human-review-packet.json`, packet);
  }

  return (
    <div className="human-review-workspace">
      <aside className="human-review-summary" aria-label="Review progress">
        <p className="eyebrow">Local review workspace</p>
        <h1>{manifest.title}</h1>
        <dl>
          <div><dt>Current revision</dt><dd>{manifest.reviewedCardVersion}</dd></div>
          <div><dt>Review target</dt><dd>Revision {manifest.targetCardVersion}</dd></div>
          <div><dt>Schema</dt><dd>{manifest.schemaVersion}</dd></div>
          <div><dt>Sources</dt><dd>{sourceCount}</dd></div>
        </dl>
        <div className="human-review-progress">
          <strong>{completed} of {total} checks complete</strong>
          <progress max={total} value={completed}>{percent}%</progress>
          <span>{percent}%</span>
        </div>
        <p>
          Progress stays in this browser and is keyed to the exact reviewed-content
          digest. A changed card starts a new checklist.
        </p>
      </aside>

      <main className="human-review-main" id="main-content">
        <header className="human-review-intro">
          <p className="eyebrow">Source-to-card alignment</p>
          <h2>Check the record, not the opportunity&rsquo;s reputation.</h2>
          <p>
            Open the cited page, compare the displayed value with the exact excerpt,
            and check each row only after its subject, cycle, scope, and source are correct.
            Human review does not certify organizer truth, legitimacy, quality, or value.
          </p>
        </header>

        {manifest.sections.map((section) => {
          const itemIds = section.items.map((item) => item.id);
          const sectionComplete = itemIds.length > 0 && itemIds.every((id) => checked.has(id));
          return (
            <section className="human-review-section" key={section.id} aria-labelledby={`${section.id}-title`}>
              <header>
                <div>
                  <p className="eyebrow">{section.items.filter((item) => checked.has(item.id)).length} / {section.items.length} checked</p>
                  <h2 id={`${section.id}-title`}>{section.label}</h2>
                  <p>{section.description}</p>
                </div>
                <button
                  className="button-quiet"
                  type="button"
                  onClick={() => toggleSection(itemIds)}
                  disabled={itemIds.length === 0}
                >
                  {sectionComplete ? "Uncheck section" : "Mark section checked"}
                </button>
              </header>

              {section.items.length === 0 ? (
                <p className="human-review-empty">No atomic claims are stored in this structured section.</p>
              ) : (
                <div className="human-review-items">
                  {section.items.map((item) => (
                    <article className="human-review-item" key={item.id} data-checked={checked.has(item.id)}>
                      <label className="human-review-check">
                        <input
                          type="checkbox"
                          checked={checked.has(item.id)}
                          onChange={() => toggleItem(item.id)}
                        />
                        <span>Checked against source</span>
                      </label>
                      <div className="human-review-claim">
                        <div className="human-review-claim-heading">
                          <h3>{item.label}</h3>
                          <span className={`status-badge status-${item.status}`}>{item.status.replaceAll("_", " ")}</span>
                        </div>
                        <p className="human-review-value">{item.value}</p>
                        {item.note ? <p className="human-review-note">{item.note}</p> : null}
                        {item.evidence.length > 0 ? (
                          <div className="human-review-evidence">
                            {item.evidence.map((source, index) => (
                              <div key={`${source.id}-${index}`}>
                                <p>
                                  <a href={source.url} target="_blank" rel="noreferrer noopener">
                                    {source.title} <span aria-hidden="true">↗</span>
                                  </a>
                                  <span>{source.pageType}</span>
                                </p>
                                {source.excerpt ? <blockquote>“{source.excerpt}”</blockquote> : null}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          );
        })}

        <section className="human-review-signoff" aria-labelledby="human-review-signoff-title">
          <p className="eyebrow">Prepare the attestation</p>
          <h2 id="human-review-signoff-title">Final human action</h2>
          <p>
            Downloading a packet does not promote the card. The repository command
            will revalidate the digest and checklist, then require the same person to
            type a confirmation in an interactive terminal.
          </p>
          <label>
            Reviewer name or identifier
            <input value={reviewer} maxLength={120} onChange={(event) => setReviewer(event.target.value)} />
          </label>
          <label>
            Concise review notes (optional)
            <textarea value={notes} maxLength={2_000} onChange={(event) => setNotes(event.target.value)} />
          </label>
          <label className="human-review-final-confirmation">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
            />
            <span>{HUMAN_REVIEW_CONFIRMATION}</span>
          </label>
          <button className="button" type="button" disabled={!canDownload} onClick={exportPacket}>
            Download completed review packet
          </button>
          {!complete ? <p>{total - completed} checklist items remain.</p> : null}
        </section>
      </main>
    </div>
  );
}
