"use client";

import { useState } from "react";

import type { OpportunityCard } from "@/lib/opportunity/schema";
import type {
  OpportunityPdfMode,
  PdfAttentionItem,
} from "./opportunity-pdf-document";

function safeFilename(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "opportunity";
}

export function PdfDownloadActions({
  card,
  attentionItems = [],
}: {
  card: OpportunityCard;
  attentionItems?: readonly PdfAttentionItem[];
}) {
  const [workingMode, setWorkingMode] = useState<OpportunityPdfMode | null>(null);
  const [error, setError] = useState("");

  async function download(mode: OpportunityPdfMode) {
    setWorkingMode(mode);
    setError("");
    try {
      const [{ pdf }, { OpportunityPdfDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./opportunity-pdf-document"),
      ]);
      const document = OpportunityPdfDocument({
        card,
        mode,
        attentionItems,
      });
      const blob = await pdf(document).toBlob();
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      const name = card.facts.opportunity_name.displayValue ?? card.slug;
      anchor.href = url;
      anchor.download = `${safeFilename(name)}-${mode === "summary" ? "summary" : "full-evidence"}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("The PDF could not be generated in this browser. Try the print view instead.");
    } finally {
      setWorkingMode(null);
    }
  }

  return (
    <div className="pdf-actions no-print">
      <button
        className="button-secondary"
        type="button"
        disabled={workingMode !== null}
        onClick={() => void download("summary")}
      >
        {workingMode === "summary" ? "Building summary…" : "Download summary PDF"}
      </button>
      <button
        className="button-quiet"
        type="button"
        disabled={workingMode !== null}
        onClick={() => void download("full")}
      >
        {workingMode === "full" ? "Building evidence PDF…" : "Download full evidence PDF"}
      </button>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </div>
  );
}
