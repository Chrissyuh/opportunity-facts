import { readFile } from "node:fs/promises";
import path from "node:path";

import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";

import {
  createOpportunityPdfReportModel,
  getSummarySourceUrls,
  OpportunityPdfDocument,
} from "@/components/pdf/opportunity-pdf-document";
import { FIELD_DEFINITIONS } from "@/lib/opportunity/fields";
import { parseOpportunityCard } from "@/lib/opportunity/serialization";

const complexCardSlugs = [
  "diamond-challenge-2027",
  "lumiere-research-scholar-program-fall-2026",
  "nasa-techrise-student-challenge-2026-2027",
] as const;

async function reviewedCard(slug: string) {
  const filePath = path.join(process.cwd(), "data", "opportunities", `${slug}.json`);
  return parseOpportunityCard(JSON.parse(await readFile(filePath, "utf8")) as unknown);
}

function pageCount(buffer: Buffer): number {
  return buffer.toString("latin1").match(/\/Type\s*\/Page\b/g)?.length ?? 0;
}

describe("Opportunity Facts PDF exports", () => {
  it.each(complexCardSlugs)("keeps %s summary and evidence reports reader-sized", async (slug) => {
    const card = await reviewedCard(slug);
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
        generatedAt: "2026-08-20T12:00:00.000Z",
      }),
    );
    const full = await renderToBuffer(
      OpportunityPdfDocument({
        card,
        mode: "full",
        fontBaseUrl,
        generatedAt: "2026-08-20T12:00:00.000Z",
      }),
    );

    expect(summary.subarray(0, 4).toString("ascii")).toBe("%PDF");
    expect(full.subarray(0, 4).toString("ascii")).toBe("%PDF");
    expect(pageCount(summary)).toBeGreaterThanOrEqual(2);
    expect(pageCount(summary)).toBeLessThanOrEqual(4);
    expect(pageCount(full)).toBeGreaterThanOrEqual(8);
    // The densest reviewed records need a few additional pages to keep every
    // structured section and evidence entry inside a stable page boundary.
    expect(pageCount(full)).toBeLessThanOrEqual(18);
    expect(full.length).toBeGreaterThan(summary.length);

    const summaryPdf = summary.toString("latin1");
    const fullPdf = full.toString("latin1");
    for (const url of getSummarySourceUrls(card)) {
      expect(summaryPdf).toContain(url);
    }
    for (const source of card.sourcePagesChecked) {
      expect(fullPdf).toContain(source.url);
    }
    for (const document of [summaryPdf, fullPdf]) {
      expect(document).toMatch(/\/FontFile2\b/);
      expect(document).not.toMatch(/\/(?:JavaScript|JS|Launch|EmbeddedFile)\b/);
    }
  }, 30_000);

  it("builds one compact evidence register instead of repeating excerpts per claim", async () => {
    const card = await reviewedCard("diamond-challenge-2027");
    const report = createOpportunityPdfReportModel(card);
    const evidenceKeys = report.evidence.map(
      ({ source }) => `${source.url}\u0000${source.excerpt}`,
    );

    expect(new Set(evidenceKeys).size).toBe(evidenceKeys.length);
    expect(report.evidence.every(({ label, source }, index) =>
      label === `E${index + 1}` && source.excerpt.length > 0,
    )).toBe(true);
    expect(report.evidenceLabelsByKey.size).toBe(report.evidence.length);
    expect(report.evidence.length).toBeLessThan(70);

    for (const { fieldId, fact } of report.projectedFacts) {
      const definition = FIELD_DEFINITIONS.find((field) => field.id === fieldId)!;
      expect(fact.status).not.toBe("not_applicable");
      if (fact.status === "not_found") expect(definition.core).toBe(true);
    }
  });

  it("omits schema placeholders that compact analysis did not assess", async () => {
    const card = await reviewedCard("diamond-challenge-2027");
    const report = createOpportunityPdfReportModel(card, [
      "opportunity_name",
      "application_deadline",
    ]);

    expect(report.projectedFacts.map(({ fieldId }) => fieldId)).toEqual([
      "application_deadline",
    ]);
  });
});
