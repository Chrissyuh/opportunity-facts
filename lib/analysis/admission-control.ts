import "server-only";

export const DEFAULT_ANALYSIS_MAX_CONCURRENCY = 2;
export const MAX_ANALYSIS_MAX_CONCURRENCY = 16;

let activeAnalyses = 0;

export function isAnalysisEnabled(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  const configured = environment.ANALYSIS_ENABLED?.trim().toLowerCase();
  if (configured === undefined || configured === "") return false;
  return ["1", "true", "yes", "on"].includes(configured);
}

export function configuredAnalysisMaxConcurrency(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): number {
  const configured = environment.ANALYSIS_MAX_CONCURRENCY?.trim();
  if (configured === undefined || configured === "") {
    return DEFAULT_ANALYSIS_MAX_CONCURRENCY;
  }
  if (!/^\d+$/u.test(configured)) return 1;
  const parsed = Number(configured);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= MAX_ANALYSIS_MAX_CONCURRENCY
    ? parsed
    : 1;
}

/**
 * Best-effort defense for one Node.js process. The deployment gateway and
 * provider project must still enforce distributed request and spend limits.
 */
export function tryAcquireAnalysisSlot(): (() => void) | null {
  if (activeAnalyses >= configuredAnalysisMaxConcurrency()) return null;
  activeAnalyses += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeAnalyses = Math.max(0, activeAnalyses - 1);
  };
}
