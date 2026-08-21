import {
  SAMPLE_ANALYSIS_CATALOG,
  type SampleAnalysisId,
  isSampleAnalysisId,
} from "./catalog";

export const SAMPLE_ROTATION_STORAGE_KEY = "opportunity-facts:sample-rotation:v1";

export interface SampleRotationState {
  readonly seen: readonly SampleAnalysisId[];
  readonly last: SampleAnalysisId | null;
}

function normalizeState(input: unknown): SampleRotationState {
  if (!input || typeof input !== "object") return { seen: [], last: null };
  const record = input as Record<string, unknown>;
  const seen = Array.isArray(record.seen)
    ? [...new Set(record.seen.filter((id): id is SampleAnalysisId =>
      typeof id === "string" && isSampleAnalysisId(id),
    ))]
    : [];
  return {
    seen,
    last: typeof record.last === "string" && isSampleAnalysisId(record.last)
      ? record.last
      : null,
  };
}

export function parseSampleRotationState(value: string | null): SampleRotationState {
  if (value === null) return { seen: [], last: null };
  try {
    return normalizeState(JSON.parse(value) as unknown);
  } catch {
    return { seen: [], last: null };
  }
}

export function chooseNextSample(
  input: SampleRotationState,
  random: () => number = Math.random,
): { id: SampleAnalysisId; state: SampleRotationState; reset: boolean } {
  const state = normalizeState(input);
  const ids = SAMPLE_ANALYSIS_CATALOG.map((sample) => sample.id);
  let candidates = ids.filter((id) => !state.seen.includes(id) && id !== state.last);
  let reset = false;
  if (candidates.length === 0) {
    reset = true;
    candidates = ids.filter((id) => id !== state.last);
  }
  if (candidates.length === 0) candidates = ids;
  const boundedRandom = Math.min(0.999999999, Math.max(0, random()));
  const id = candidates[Math.floor(boundedRandom * candidates.length)];
  const seen = reset ? [id] : [...state.seen, id];
  return { id, state: { seen, last: id }, reset };
}

export function rememberSample(
  input: SampleRotationState,
  id: SampleAnalysisId,
): SampleRotationState {
  const state = normalizeState(input);
  return {
    seen: state.seen.includes(id) ? state.seen : [...state.seen, id],
    last: id,
  };
}
