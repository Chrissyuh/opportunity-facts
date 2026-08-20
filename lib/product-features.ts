export function isBatchAnalysisEnabled(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return environment.BATCH_ANALYSIS_ENABLED?.trim().toLowerCase() === "true";
}
