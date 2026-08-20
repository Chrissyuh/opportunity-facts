import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createEmptyModelStructures,
  extractOpportunityCard,
  type AnalysisSourceContext,
} from "@/lib/analysis/model-extraction";
import {
  createEmptyFacts,
  factSchema,
  type FieldId,
} from "@/lib/opportunity";

const ACCESSED_AT = "2026-08-20T00:00:00.000Z";
const SOURCE_ID = "page-eligibility";
const SOURCE_URL = "https://program.example/eligibility";

async function analyzeFact(
  fieldId: FieldId,
  value: unknown,
  displayValue: string,
  excerpt: string,
) {
  const facts = createEmptyFacts();
  facts[fieldId] = factSchema.parse({
    status: "disclosed",
    value,
    displayValue,
    claimKind: "source_stated",
    sources: [{
      id: SOURCE_ID,
      url: SOURCE_URL,
      title: "Program eligibility",
      pageType: "user_supplied",
      accessedAt: ACCESSED_AT,
      excerpt,
    }],
  });
  const text = `2026 program cycle\n${excerpt}`;
  const source: AnalysisSourceContext = {
    accessedAt: ACCESSED_AT,
    page: {
      id: SOURCE_ID,
      url: SOURCE_URL,
      title: "2026 Program eligibility",
      pageType: "user_supplied",
      trust: "untrusted_source_text",
      text,
      blocks: [
        { kind: "heading", text: "2026 program cycle" },
        { kind: "paragraph", text: excerpt },
      ],
      links: [],
      truncated: false,
    },
  };
  return extractOpportunityCard(
    [source],
    async () => ({ facts, structures: createEmptyModelStructures() }),
  );
}

describe("flat eligibility value alignment", () => {
  it.each([
    {
      fieldId: "ages" as const,
      value: "Ages 16 to 18",
      displayValue: "Ages 16–18",
      excerpt: "Applicants must be 13 to 15 years old.",
    },
    {
      fieldId: "grade_levels" as const,
      value: ["Grade 9", "Grade 10"],
      displayValue: "Grades 9–10",
      excerpt: "Students in grades 6 through 8 are eligible.",
    },
    {
      fieldId: "geographic_restrictions" as const,
      value: "United States only",
      displayValue: "United States only",
      excerpt: "The program is open only to students who live in Canada.",
    },
    {
      fieldId: "citizenship_restrictions" as const,
      value: "Canadian citizens",
      displayValue: "Canadian citizens",
      excerpt: "Applicants must be U.S. citizens or permanent residents.",
    },
    {
      fieldId: "entry_format" as const,
      value: "Individual applicants",
      displayValue: "Individual",
      excerpt: "Teams of two to four students may enter.",
    },
    {
      fieldId: "sponsor_requirement" as const,
      value: "Adult adviser required",
      displayValue: "Adult adviser required",
      excerpt: "Teams may optionally name an adult adviser, but one is not required.",
    },
  ])("withholds a mismatched $fieldId disclosure", async ({
    fieldId,
    value,
    displayValue,
    excerpt,
  }) => {
    const result = await analyzeFact(fieldId, value, displayValue, excerpt);
    expect(result.card.facts[fieldId].status).toBe("unclear");
  });
});
