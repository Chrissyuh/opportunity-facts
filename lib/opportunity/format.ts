import type { Fact, NormalizedValue } from "./schema";

export const STATUS_LABELS = {
  disclosed: "Disclosed",
  not_found: "Not found",
  unclear: "Unclear",
  conflicting: "Conflicting",
  not_applicable: "Not applicable",
} as const;

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

function capitalizeWords(value: string): string {
  return value
    .split("_")
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}
export function formatNormalizedValue(value: NormalizedValue): string {
  switch (value.kind) {
    case "text":
      return value.value;
    case "text_list":
      return value.values.join(", ");
    case "date":
      return new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${value.isoDate}T00:00:00Z`));
    case "money": {
      const formatter =
        value.currency === "USD"
          ? currencyFormatter
          : new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: value.currency,
              maximumFractionDigits: 2,
            });
      return formatter.format(value.amount);
    }
    case "number":
      return `${numberFormatter.format(value.value)}${value.unit ? ` ${value.unit}` : ""}`;
    case "boolean":
      return value.value ? "Yes" : "No";
    case "percentage":
      return `${numberFormatter.format(value.value)}%`;
    case "duration":
      return `${numberFormatter.format(value.amount)} ${value.unit}`;
    case "hours": {
      const amount =
        value.maximum === null || value.maximum === value.minimum
          ? numberFormatter.format(value.minimum)
          : `${numberFormatter.format(value.minimum)}–${numberFormatter.format(value.maximum)}`;
      return `${amount} hours ${value.period === "total" ? "total" : `per ${value.period}`}`;
    }
    case "relationship":
    case "participation_format":
      return capitalizeWords(value.value);
  }
}

export function formatFact(fact: Fact): string {
  if (fact.status === "conflicting") {
    return fact.conflictingValues.map((candidate) => candidate.displayValue).join(" / ");
  }
  if (fact.status !== "disclosed") return STATUS_LABELS[fact.status];
  if (fact.displayValue !== null) return fact.displayValue;
  if (fact.normalizedValue !== null) return formatNormalizedValue(fact.normalizedValue);
  return STATUS_LABELS.disclosed;
}
