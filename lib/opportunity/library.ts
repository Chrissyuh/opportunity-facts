import type { OpportunityCard } from "./schema";

export type DeadlineState = "upcoming" | "past" | "missing";

export function currentUtcDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function opportunityDeadlineState(
  card: OpportunityCard,
  today = currentUtcDate(),
): DeadlineState {
  const deadline = card.facts.application_deadline;
  if (deadline.status !== "disclosed") return "missing";
  const normalized = deadline.normalizedValue;
  if (normalized?.kind === "date") {
    return normalized.isoDate < today ? "past" : "upcoming";
  }

  const wording = [deadline.displayValue, deadline.value]
    .filter((value): value is string => typeof value === "string")
    .join(" ");
  return /\b(?:rolling|open until filled|applications? (?:are )?open)\b/iu.test(wording)
    ? "upcoming"
    : "missing";
}
