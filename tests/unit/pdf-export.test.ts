import { readFile } from "node:fs/promises";
import path from "node:path";

import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";

import { OpportunityPdfDocument } from "@/components/pdf/opportunity-pdf-document";
import { parseOpportunityCard } from "@/lib/opportunity/serialization";

async function reviewedCard() {
  const filePath = path.join(
    process.cwd(),
    "data",
    "opportunities",
    "diamond-challenge-2027.json",
  );
  return parseOpportunityCard(JSON.parse(await readFile(filePath, "utf8")) as unknown);
}

describe("Opportunity Facts PDF exports", () => {
  it("renders summary and full-evidence PDFs with exact safe source links", async () => {
    const card = await reviewedCard();
    const fontBaseUrl = path.join(process.cwd(), "public", "fonts");
    const summary = await renderToBuffer(
      OpportunityPdfDocument({
        card,
        mode: "summary",
        attentionItems: [
          {
            id: "travel-cost",
            category: "cost",
            priority: "high",
            title: "Finalist travel cost is unresolved",
            explanation: "The retained sources do not establish one complete finalist travel total.",
            suggestedNextStep: "Confirm travel support before accepting a finalist invitation.",
          },
        ],
        fontBaseUrl,
      }),
    );
    const full = await renderToBuffer(
      OpportunityPdfDocument({ card, mode: "full", fontBaseUrl }),
    );

    expect(summary.subarray(0, 4).toString("ascii")).toBe("%PDF");
    expect(full.subarray(0, 4).toString("ascii")).toBe("%PDF");
    expect(summary.length).toBeGreaterThan(5_000);
    expect(full.length).toBeGreaterThan(summary.length);
    const summaryPdf = summary.toString("latin1");
    const fullPdf = full.toString("latin1");
    expect(summaryPdf.match(/\/Type\s*\/Page\b/g)?.length ?? 0).toBeGreaterThan(1);
    expect(fullPdf.match(/\/Type\s*\/Page\b/g)?.length ?? 0).toBeGreaterThan(1);

    // Source URLs must survive as exact hyperlink targets even when their visible
    // presentation contains soft wrap opportunities.
    for (const source of card.sourcePagesChecked) {
      expect(summaryPdf).toContain(source.url);
      expect(fullPdf).toContain(source.url);
    }

    // The browser-generated documents embed the local text font and contain no
    // executable or attached payloads.
    for (const document of [summaryPdf, fullPdf]) {
      expect(document).toMatch(/\/FontFile2\b/);
      expect(document).not.toMatch(/\/(?:JavaScript|JS|Launch|EmbeddedFile)\b/);
    }
  }, 30_000);
});
