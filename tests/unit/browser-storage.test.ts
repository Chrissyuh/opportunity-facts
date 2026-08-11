import { describe, expect, it } from "vitest";

import {
  BUILDER_STORAGE_KEY,
  BUILDER_TOUCHED_STORAGE_KEY,
  writeBuilderDraftStorage,
} from "../../lib/opportunity/browser-storage";

describe("builder browser storage", () => {
  it("restores both prior values when the assessment-sidecar write fails", () => {
    const values = new Map<string, string>([
      [BUILDER_STORAGE_KEY, "old-card"],
      [BUILDER_TOUCHED_STORAGE_KEY, "old-touched"],
    ]);
    let failTouchedWrite = true;
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (key === BUILDER_TOUCHED_STORAGE_KEY && failTouchedWrite) {
          failTouchedWrite = false;
          throw new DOMException("Quota exceeded", "QuotaExceededError");
        }
        values.set(key, value);
      },
      removeItem: (key: string) => {
        values.delete(key);
      },
    };

    expect(writeBuilderDraftStorage(storage, "new-card", "new-touched")).toBe(false);
    expect(values.get(BUILDER_STORAGE_KEY)).toBe("old-card");
    expect(values.get(BUILDER_TOUCHED_STORAGE_KEY)).toBe("old-touched");
  });
});
