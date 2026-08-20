import { describe, expect, it } from "vitest";

import { isBatchAnalysisEnabled } from "@/lib/product-features";

describe("competition-facing product features", () => {
  it("hides batch analysis unless the deployment explicitly enables it", () => {
    expect(isBatchAnalysisEnabled({})).toBe(false);
    expect(isBatchAnalysisEnabled({ BATCH_ANALYSIS_ENABLED: "false" })).toBe(false);
    expect(isBatchAnalysisEnabled({ BATCH_ANALYSIS_ENABLED: "true" })).toBe(true);
    expect(isBatchAnalysisEnabled({ BATCH_ANALYSIS_ENABLED: " TRUE " })).toBe(true);
  });
});
