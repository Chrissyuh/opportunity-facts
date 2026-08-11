"use client";

import { useMemo, useState } from "react";
import { FIELD_DEFINITIONS, type FieldId } from "@/lib/opportunity/fields";
import type { OpportunityCard } from "@/lib/opportunity/schema";
import { hasSensitiveUrlQuery, isObviouslyPublicHttpUrl } from "@/lib/opportunity/public-url";

interface CorrectionDraft {
  fieldId: FieldId;
  proposedValue: string;
  reason: string;
  sourceUrl: string;
  excerpt: string;
}

function safeFilePart(value: string) {
  return value.replace(/[^a-z0-9-]/gi, "-").replace(/-+/g, "-").toLowerCase();
}

function escapeMarkdown(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replace(/([`*_{}\[\]()#+\-.!<>|])/g, "\\$1")
    .replaceAll("@", "@\u200B");
}

function markdownQuote(value: string) {
  return (value || "Not supplied")
    .split(/\r?\n/u)
    .map((line) => `> ${escapeMarkdown(line)}`)
    .join("\n");
}

function isSafePublicLink(value: string) {
  return isObviouslyPublicHttpUrl(value) && !hasSensitiveUrlQuery(value);
}

function downloadText(filename: string, contents: string, type: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function CorrectionWorkflow({ card }: { card: OpportunityCard }) {
  const [draft, setDraft] = useState<CorrectionDraft>({
    fieldId: "opportunity_name",
    proposedValue: "",
    reason: "",
    sourceUrl: "",
    excerpt: "",
  });
  const [message, setMessage] = useState("");

  const packet = useMemo(() => {
    const field = FIELD_DEFINITIONS.find((item) => item.id === draft.fieldId);
    const current = card.facts[draft.fieldId];
    return {
      packetVersion: "1.0.0",
      card: {
        slug: card.slug,
        cardVersion: card.cardVersion,
        schemaVersion: card.schemaVersion,
        opportunityName:
          typeof card.facts.opportunity_name.value === "string"
            ? card.facts.opportunity_name.value
            : card.slug,
      },
      correction: {
        fieldId: draft.fieldId,
        fieldLabel: field?.label ?? draft.fieldId,
        currentStatus: current.status,
        currentDisplayValue: current.displayValue,
        proposedValue: draft.proposedValue.trim(),
        reason: draft.reason.trim(),
        evidence: {
          url: draft.sourceUrl.trim(),
          excerpt: draft.excerpt.trim(),
        },
      },
      note:
        "This packet is a suggestion. A reviewer must check the source before changing a public card.",
    };
  }, [card, draft]);

  const markdown = useMemo(
    () =>
      `# Opportunity Facts correction\n\n` +
      `- Card: ${escapeMarkdown(packet.card.opportunityName)}\n` +
      `- Slug: ${escapeMarkdown(packet.card.slug)}\n` +
      `- Card version: ${packet.card.cardVersion}\n` +
      `- Field: ${escapeMarkdown(packet.correction.fieldLabel)} (${escapeMarkdown(packet.correction.fieldId)})\n` +
      `- Current status: ${escapeMarkdown(packet.correction.currentStatus)}\n` +
      `- Current value: ${escapeMarkdown(packet.correction.currentDisplayValue ?? "No displayed value")}\n` +
      `- Proposed value: ${escapeMarkdown(packet.correction.proposedValue || "Not supplied")}\n` +
      `- Source URL: ${escapeMarkdown(packet.correction.evidence.url || "Not supplied")}\n\n` +
      `## Reason\n\n${escapeMarkdown(packet.correction.reason || "Not supplied")}\n\n` +
      `## Source excerpt\n\n${markdownQuote(packet.correction.evidence.excerpt)}\n\n` +
      `${escapeMarkdown(packet.note)}\n`,
    [packet],
  );

  const complete = Boolean(
    draft.proposedValue.trim() &&
      draft.reason.trim() &&
      isSafePublicLink(draft.sourceUrl.trim()) &&
      draft.excerpt.trim(),
  );

  const repo = process.env.NEXT_PUBLIC_GITHUB_REPO?.trim();
  const issueUrl = repo && complete
    ? `https://github.com/${repo}/issues/new?title=${encodeURIComponent(
        `Correction: ${packet.card.opportunityName} — ${packet.correction.fieldLabel}`,
      )}&body=${encodeURIComponent(markdown)}`
    : null;

  async function copyPacket() {
    try {
      await navigator.clipboard.writeText(markdown);
      setMessage("Correction packet copied to the clipboard.");
    } catch {
      setMessage("Clipboard access was unavailable. Download the Markdown packet instead.");
    }
  }

  return (
    <details className="correction-workflow no-print">
      <summary>Suggest a correction</summary>
      <div className="correction-inner stack">
        <div>
          <h3>Prepare a source-backed correction packet</h3>
          <p className="field-help">
            Opportunity Facts does not submit the form. Download and copy actions stay local;
            opening the GitHub action transfers the prefilled packet to GitHub.
          </p>
        </div>
        <div className="field-grid">
          <div className="field">
            <label htmlFor={`correction-field-${card.slug}`}>Fact to correct</label>
            <select
              id={`correction-field-${card.slug}`}
              value={draft.fieldId}
              onChange={(event) =>
                setDraft((value) => ({
                  ...value,
                  fieldId: event.target.value as FieldId,
                }))
              }
            >
              {FIELD_DEFINITIONS.map((field) => (
                <option key={field.id} value={field.id}>
                  {field.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor={`correction-value-${card.slug}`}>Proposed value</label>
            <input
              id={`correction-value-${card.slug}`}
              value={draft.proposedValue}
              onChange={(event) =>
                setDraft((value) => ({ ...value, proposedValue: event.target.value }))
              }
              placeholder="State the corrected fact"
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor={`correction-reason-${card.slug}`}>Why it should change</label>
          <textarea
            id={`correction-reason-${card.slug}`}
            value={draft.reason}
            onChange={(event) =>
              setDraft((value) => ({ ...value, reason: event.target.value }))
            }
            placeholder="Explain what the current card misses or gets wrong"
          />
        </div>
        <div className="field-grid">
          <div className="field">
            <label htmlFor={`correction-url-${card.slug}`}>Evidence URL</label>
            <input
              id={`correction-url-${card.slug}`}
              type="url"
              inputMode="url"
              value={draft.sourceUrl}
              onChange={(event) =>
                setDraft((value) => ({ ...value, sourceUrl: event.target.value }))
              }
              placeholder="https://…"
            />
          </div>
          <div className="field">
            <label htmlFor={`correction-excerpt-${card.slug}`}>Exact source excerpt</label>
            <textarea
              id={`correction-excerpt-${card.slug}`}
              value={draft.excerpt}
              onChange={(event) =>
                setDraft((value) => ({ ...value, excerpt: event.target.value }))
              }
              placeholder="Paste the exact supporting wording"
            />
          </div>
        </div>
        {!complete ? (
          <p className="field-help">
            Complete all four fields with a public HTTP(S) evidence URL. Local/private hosts and token-, session-, signature-, or key-bearing query URLs are not accepted.
          </p>
        ) : null}
        <div className="button-row">
          <button
            className="button-secondary"
            type="button"
            disabled={!complete}
            onClick={() =>
              downloadText(
                `correction-${safeFilePart(card.slug)}.json`,
                `${JSON.stringify(packet, null, 2)}\n`,
                "application/json",
              )
            }
          >
            Download JSON
          </button>
          <button
            className="button-secondary"
            type="button"
            disabled={!complete}
            onClick={() =>
              downloadText(
                `correction-${safeFilePart(card.slug)}.md`,
                markdown,
                "text/markdown",
              )
            }
          >
            Download Markdown
          </button>
          <button className="button-quiet" type="button" disabled={!complete} onClick={copyPacket}>
            Copy packet
          </button>
          {issueUrl ? (
            <a className="button-quiet" href={issueUrl} target="_blank" rel="noreferrer noopener">
              Open GitHub issue <span aria-hidden="true">↗</span>
            </a>
          ) : null}
        </div>
        <p className="fine-print" role="status" aria-live="polite">
          {message}
        </p>
      </div>
    </details>
  );
}
