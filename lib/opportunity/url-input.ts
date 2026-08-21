const ANALYSIS_URL_MAX_LENGTH = 2_048;
const URL_INPUT_ERROR = "Enter a valid public opportunity URL, such as example.org/program.";

export type NormalizedAnalysisUrl =
  | { readonly ok: true; readonly url: string }
  | { readonly ok: false; readonly message: string };

/**
 * Friendly client-side syntax normalization only. The server remains
 * authoritative for DNS, SSRF, credentials, ports, and sensitive parameters.
 */
export function normalizeAnalysisUrlInput(input: string): NormalizedAnalysisUrl {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > ANALYSIS_URL_MAX_LENGTH || /\s/u.test(trimmed)) {
    return { ok: false, message: URL_INPUT_ERROR };
  }
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//iu.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (
      (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
      !parsed.hostname ||
      (!parsed.hostname.includes(".") && !parsed.hostname.includes(":")) ||
      parsed.username ||
      parsed.password
    ) return { ok: false, message: URL_INPUT_ERROR };
    return { ok: true, url: parsed.href };
  } catch {
    return { ok: false, message: URL_INPUT_ERROR };
  }
}
