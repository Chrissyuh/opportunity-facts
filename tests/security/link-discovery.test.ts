import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  MAX_DISCOVERED_PAGES,
  rankSameOriginLinks,
} from "../../lib/analysis/link-discovery";
import type { ExtractedLink } from "../../lib/analysis/types";

function link(url: string, text: string, sameOrigin = true): ExtractedLink {
  return { url, text, sameOrigin, rel: [] };
}

describe("same-origin relevant-page discovery", () => {
  it("normalizes default ports, punycode, case, and trailing dots for origin checks", () => {
    const candidates = rankSameOriginLinks(
      "https://BÜCHER.example.:443/program",
      [
        link("https://xn--bcher-kva.example/privacy", "Privacy policy"),
        link("https://other.example/privacy", "Privacy policy", true),
      ],
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      url: "https://xn--bcher-kva.example/privacy",
      topic: "privacy",
    });
    expect(candidates[0]).not.toHaveProperty("pageType");
  });

  it("ranks relevant disclosure pages and excludes unrelated or non-text targets", () => {
    const candidates = rankSameOriginLinks("https://program.example/", [
      link("https://program.example/blog", "News and blog"),
      link("https://program.example/privacy", "Privacy and data sharing policy"),
      link("https://program.example/refunds", "Refund policy"),
      link("https://program.example/faq", "FAQ"),
      link("https://program.example/rules.pdf", "Competition rules"),
      link("https://outside.example/cost", "Tuition and costs", false),
    ]);

    expect(candidates.map((candidate) => candidate.topic)).toEqual([
      "privacy",
      "refund",
      "faq",
    ]);
  });

  it("never returns more than six pages even if a caller asks for more", () => {
    const links = Array.from({ length: 10 }, (_, index) =>
      link(`https://program.example/faq/${index}`, `FAQ ${index}`),
    );

    expect(rankSameOriginLinks("https://program.example/", links, { maxPages: 100 })).toHaveLength(
      MAX_DISCOVERED_PAGES,
    );
  });

  it("covers distinct disclosure topics before adding duplicate-topic pages", () => {
    const candidates = rankSameOriginLinks("https://program.example/", [
      ...Array.from({ length: 8 }, (_, index) =>
        link(`https://program.example/faq/${index}`, `FAQ ${index}`),
      ),
      link("https://program.example/cost", "Tuition and costs"),
      link("https://program.example/privacy", "Privacy policy"),
      link("https://program.example/rules", "Program rules"),
    ]);

    expect(candidates.map((candidate) => candidate.topic)).toEqual(
      expect.arrayContaining(["faq", "cost", "privacy", "rules"]),
    );
  });

  it("recognizes plural FAQ labels and organization background pages", () => {
    const candidates = rankSameOriginLinks("https://program.example/program", [
      link("https://program.example/faqs", "FAQs"),
      link("https://program.example/about", "About us"),
    ]);

    expect(candidates).toEqual([
      expect.objectContaining({ topic: "faq" }),
      expect.objectContaining({ topic: "other" }),
    ]);
  });

  it("penalizes generic admissions marketing and counseling pages", () => {
    const candidates = rankSameOriginLinks("https://program.example/program", [
      link("https://program.example/admissions-results", "Our admissions results"),
      link("https://program.example/admission-officer-sessions", "Admissions officer sessions"),
      link("https://program.example/counseling", "Excellence in counseling"),
      link("https://program.example/application", "Application"),
    ]);

    expect(candidates.map((candidate) => candidate.url)).toEqual([
      "https://program.example/application",
    ]);
  });

  it("hard-rejects account and destructive action links", () => {
    const candidates = rankSameOriginLinks("https://program.example/", [
      link("https://program.example/logout?next=faq", "FAQ after logout"),
      link("https://program.example/delete/account?section=privacy", "Privacy account deletion"),
      link("https://program.example/privacy", "Privacy policy"),
    ]);

    expect(candidates.map((candidate) => candidate.url)).toEqual([
      "https://program.example/privacy",
    ]);
  });

  it("deduplicates fragments and keeps the strongest label for a URL", () => {
    const candidates = rankSameOriginLinks("https://program.example/", [
      link("https://program.example/policies#top", "Policies"),
      link(
        "https://program.example/policies#refunds",
        "Refund and cancellation policy",
      ),
    ]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      url: "https://program.example/policies",
      text: "Refund and cancellation policy",
    });
  });

  it("penalizes a different named program path without hard-coded program names", () => {
    const candidates = rankSameOriginLinks(
      "https://provider.example/programs/national-match",
      [
        link(
          "https://provider.example/programs/prep-scholars/scholarships",
          "Prep Scholars scholarships and awards",
        ),
        link(
          "https://provider.example/programs/national-match/dates",
          "National Match dates and deadlines",
        ),
        link("https://provider.example/privacy-policy", "Privacy policy"),
      ],
      { targetTitle: "National Match | Provider" },
    );

    expect(candidates.map((candidate) => candidate.url)).toEqual([
      "https://provider.example/privacy-policy",
      "https://provider.example/programs/national-match/dates",
    ]);
  });

  it("rejects a differently named same-site opportunity but retains a target-family FAQ", () => {
    const candidates = rankSameOriginLinks(
      "https://provider.example/aurora-fellows",
      [
        link(
          "https://provider.example/builder-competition",
          "Builder Competition",
        ),
        link(
          "https://provider.example/fellowship-faq",
          "Fellowship FAQ and tuition",
        ),
        link("https://provider.example/terms", "Terms and refund policy"),
      ],
      { targetTitle: "Aurora Fellows | Provider" },
    );

    expect(candidates.map((candidate) => candidate.url)).toContain(
      "https://provider.example/fellowship-faq",
    );
    expect(candidates.map((candidate) => candidate.url)).toContain(
      "https://provider.example/terms",
    );
    expect(candidates.map((candidate) => candidate.url)).not.toContain(
      "https://provider.example/builder-competition",
    );
  });
});
