import "server-only";

import dataset from "../../public/data/opportunities.json";

import { parsePublicDataset } from "./artifacts";
import type { OpportunityCard } from "./schema";

const cards = Object.freeze(parsePublicDataset(dataset).cards);

export function getAllCards(): OpportunityCard[] {
  return [...cards];
}

export function getDemoCards(): OpportunityCard[] {
  return cards.filter((card) => card.reviewState === "demo");
}

export function getCardBySlug(slug: string): OpportunityCard | null {
  return cards.find((card) => card.slug === slug) ?? null;
}

export const loadAllCards = getAllCards;
export const loadCardBySlug = getCardBySlug;
