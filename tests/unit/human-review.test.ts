import { readFile } from "node:fs/promises";
import path from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import { opportunityCardSchema, type OpportunityCard } from "../../lib/opportunity/schema";
import {
  HUMAN_REVIEW_CONFIRMATION,
  buildHumanReviewManifest,
  createHumanReviewAttestation,
  isHumanReviewWorkspaceEnabled,
  promoteCardWithHumanReview,
  validateHumanReviewAttestation,
  validateHumanReviewPacket,
  type HumanReviewPacket,
} from "../../lib/review/human-review";

let card: OpportunityCard;

beforeAll(async () => {
  card = opportunityCardSchema.parse(JSON.parse(await readFile(
    path.join(process.cwd(), "data", "opportunities", "mites-summer-2027.json"),
    "utf8",
  )) as unknown);
});

function completePacket(reviewCard: OpportunityCard): HumanReviewPacket {
  const manifest = buildHumanReviewManifest(reviewCard);
  return {
    kind: "human_review_packet",
    formatVersion: "1.0.0",
    slug: manifest.slug,
    opportunityId: manifest.opportunityId,
    schemaVersion: manifest.schemaVersion,
    reviewedCardVersion: manifest.reviewedCardVersion,
    targetCardVersion: manifest.targetCardVersion,
    reviewedContentSha256: manifest.reviewedContentSha256,
    manifestSha256: manifest.manifestSha256,
    completedItemIds: [...manifest.expectedItemIds],
    reviewer: "Christopher",
    notes: "Checked source-to-card alignment.",
    preparedAt: "2026-08-20T12:00:00Z",
    reviewerConfirmedReview: true,
  };
}

describe("local human-review contract", () => {
  it("builds a readable complete manifest spanning sources, facts, structures, and sign-off", () => {
    const manifest = buildHumanReviewManifest(card);
    expect(manifest.sections.map((section) => section.id)).toEqual(expect.arrayContaining([
      "source-inventory",
      "facts-identity",
      "facts-money",
      "structured-cycle",
      "structured-institutionRelationships",
      "structured-costItems",
      "final-sign-off",
    ]));
    expect(manifest.expectedItemIds).toContain("fact:operating_organization");
    expect(manifest.expectedItemIds.some((id) => id.startsWith("source:"))).toBe(true);
    expect(manifest.expectedItemIds.some((id) => id.startsWith("claim:"))).toBe(true);
    expect(new Set(manifest.expectedItemIds).size).toBe(manifest.expectedItemIds.length);
    expect(manifest.reviewedContentSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("requires the exact checklist and explicit interactive human confirmation", () => {
    const complete = completePacket(card);
    expect(() => validateHumanReviewPacket(card, {
      ...complete,
      completedItemIds: complete.completedItemIds.slice(1),
    })).toThrow(/checklist does not match/i);
    expect(() => createHumanReviewAttestation(card, complete, {
      isInteractiveHuman: false,
      confirmationText: HUMAN_REVIEW_CONFIRMATION,
      reviewedAt: "2026-08-20T12:30:00Z",
    })).toThrow(/entered by a person/i);
    expect(() => createHumanReviewAttestation(card, complete, {
      isInteractiveHuman: true,
      confirmationText: "yes",
      reviewedAt: "2026-08-20T12:30:00Z",
    })).toThrow(/entered by a person/i);
  });

  it("promotes only the bound next revision and validates its repository attestation", () => {
    const packet = completePacket(card);
    const attestation = createHumanReviewAttestation(card, packet, {
      isInteractiveHuman: true,
      confirmationText: HUMAN_REVIEW_CONFIRMATION,
      reviewedAt: "2026-08-20T12:30:00Z",
    });
    const promoted = opportunityCardSchema.parse(promoteCardWithHumanReview(card, attestation));
    expect(promoted.reviewState).toBe("human_reviewed");
    expect(promoted.cardVersion).toBe(card.cardVersion + 1);
    expect(validateHumanReviewAttestation(promoted, attestation)).toEqual(attestation);
  });

  it("invalidates the attestation after content or revision changes", () => {
    const packet = completePacket(card);
    const attestation = createHumanReviewAttestation(card, packet, {
      isInteractiveHuman: true,
      confirmationText: HUMAN_REVIEW_CONFIRMATION,
      reviewedAt: "2026-08-20T12:30:00Z",
    });
    const promoted = opportunityCardSchema.parse(promoteCardWithHumanReview(card, attestation));
    expect(() => validateHumanReviewAttestation({
      ...promoted,
      summary: `${promoted.summary} Material edit.`,
    }, attestation)).toThrow(/stale/i);
    expect(() => validateHumanReviewAttestation({
      ...promoted,
      cardVersion: promoted.cardVersion + 1,
    }, attestation)).toThrow(/stale/i);
  });

  it("keeps the workspace local-only even if production is misconfigured", () => {
    expect(isHumanReviewWorkspaceEnabled({
      NODE_ENV: "production",
      HUMAN_REVIEW_WORKSPACE_ENABLED: "true",
    })).toBe(false);
    expect(isHumanReviewWorkspaceEnabled({
      NODE_ENV: "development",
      HUMAN_REVIEW_WORKSPACE_ENABLED: "false",
    })).toBe(false);
    expect(isHumanReviewWorkspaceEnabled({
      NODE_ENV: "development",
      HUMAN_REVIEW_WORKSPACE_ENABLED: "true",
    })).toBe(true);
  });
});
