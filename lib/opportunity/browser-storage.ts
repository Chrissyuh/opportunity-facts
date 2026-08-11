export const BUILDER_STORAGE_KEY = "opportunity-facts:builder:v1";
export const BUILDER_TOUCHED_STORAGE_KEY = "opportunity-facts:builder-touched:v1";
export const BUILDER_STORAGE_EVENT = "opportunity-facts:builder-change";
export const ANALYSIS_URL_HANDOFF_KEY = "opportunity-facts:analysis-url-handoff:v1";

interface BuilderStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function restoreItem(storage: BuilderStorage, key: string, previous: string | null) {
  if (previous === null) storage.removeItem(key);
  else storage.setItem(key, previous);
}

/** Writes the card and assessment sidecar together, rolling both back on failure. */
export function writeBuilderDraftStorage(
  storage: BuilderStorage,
  cardJson: string,
  touchedJson: string,
): boolean {
  let previousCard: string | null = null;
  let previousTouched: string | null = null;
  try {
    previousCard = storage.getItem(BUILDER_STORAGE_KEY);
    previousTouched = storage.getItem(BUILDER_TOUCHED_STORAGE_KEY);
    storage.setItem(BUILDER_STORAGE_KEY, cardJson);
    storage.setItem(BUILDER_TOUCHED_STORAGE_KEY, touchedJson);
    return true;
  } catch {
    try {
      restoreItem(storage, BUILDER_STORAGE_KEY, previousCard);
      restoreItem(storage, BUILDER_TOUCHED_STORAGE_KEY, previousTouched);
    } catch {
      // Best effort only when storage itself is unavailable or over quota.
    }
    return false;
  }
}
