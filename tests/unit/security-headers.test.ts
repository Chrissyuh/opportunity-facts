import { afterEach, describe, expect, it, vi } from "vitest";

import nextConfig from "../../next.config";

describe("production security headers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("permits bundled PDF WebAssembly without enabling general eval", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const headerRules = await nextConfig.headers?.();
    const csp = headerRules
      ?.flatMap((rule) => rule.headers)
      .find((header) => header.key === "Content-Security-Policy")?.value;
    const scriptSources = csp
      ?.split(";")
      .find((directive) => directive.trimStart().startsWith("script-src "))
      ?.trim()
      .split(/\s+/u)
      .slice(1);

    expect(scriptSources).toContain("'wasm-unsafe-eval'");
    expect(scriptSources).not.toContain("'unsafe-eval'");
  });
});
