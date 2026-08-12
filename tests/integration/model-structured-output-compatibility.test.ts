import { describe, expect, it } from "vitest";

import { buildModelTextFormat } from "@/lib/analysis/model-extraction";

function inspectSchema(value: unknown) {
  let propertyCount = 0;
  let maximumDepth = 0;
  let stringBudget = 0;
  const formats = new Set<string>();

  function visit(node: unknown, depth = 0): void {
    maximumDepth = Math.max(maximumDepth, depth);
    if (Array.isArray(node)) {
      node.forEach((child) => visit(child, depth));
      return;
    }
    if (typeof node !== "object" || node === null) return;

    const record = node as Record<string, unknown>;
    if (
      typeof record.properties === "object" &&
      record.properties !== null &&
      !Array.isArray(record.properties)
    ) {
      const names = Object.keys(record.properties);
      propertyCount += names.length;
      stringBudget += names.reduce((sum, name) => sum + name.length, 0);
    }
    if (
      typeof record.definitions === "object" &&
      record.definitions !== null &&
      !Array.isArray(record.definitions)
    ) {
      stringBudget += Object.keys(record.definitions).reduce(
        (sum, name) => sum + name.length,
        0,
      );
    }
    if (Array.isArray(record.enum)) {
      stringBudget += record.enum.reduce(
        (sum, item) => sum + (typeof item === "string" ? item.length : 0),
        0,
      );
    }
    if (typeof record.const === "string") stringBudget += record.const.length;
    if (typeof record.format === "string") formats.add(record.format);

    for (const [key, child] of Object.entries(record)) {
      const increasesDepth = ["properties", "items", "anyOf", "oneOf"].includes(key);
      visit(child, increasesDepth ? depth + 1 : depth);
    }
  }

  visit(value);
  return { propertyCount, maximumDepth, stringBudget, formats };
}

describe("model structured-output compatibility", () => {
  it("serializes the complete production extraction contract in strict mode", () => {
    const format = buildModelTextFormat();
    const serialized = JSON.stringify(format);
    const limits = inspectSchema(format.schema);

    expect(format.type).toBe("json_schema");
    expect(format.strict).toBe(true);
    expect(serialized).not.toContain('"not"');
    expect(limits.propertyCount).toBeLessThanOrEqual(5_000);
    expect(limits.maximumDepth).toBeLessThanOrEqual(10);
    expect(limits.stringBudget).toBeLessThanOrEqual(120_000);
    expect([...limits.formats]).not.toContain("uri");
  });
});
