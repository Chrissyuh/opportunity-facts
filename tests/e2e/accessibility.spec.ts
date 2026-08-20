import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./support";

const primaryRoutes = [
  { name: "homepage", path: "/" },
  { name: "library", path: "/opportunities" },
  { name: "sample facts card", path: "/opportunities/lantern-bay-robotics-field-lab" },
  { name: "full research record", path: "/opportunities/lantern-bay-robotics-field-lab/record" },
  { name: "batch analysis", path: "/analyze/batch" },
  { name: "comparison", path: "/compare" },
  { name: "manual builder", path: "/build" },
  { name: "analysis", path: "/analyze" },
  { name: "methodology", path: "/methodology" },
  { name: "data documentation", path: "/data" },
  { name: "research", path: "/research" },
] as const;

async function expectNoSeriousOrCriticalViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const violations = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  const summary = violations
    .map((violation) => {
      const targets = violation.nodes.flatMap((node) => node.target).join(", ");
      return `${violation.id} (${violation.impact}): ${violation.help}; targets: ${targets}`;
    })
    .join("\n");
  expect(violations, summary).toEqual([]);
}

for (const route of primaryRoutes) {
  test(`${route.name} has no serious or critical automated accessibility violations`, async ({ page }) => {
    await page.goto(route.path);
    await expectNoSeriousOrCriticalViolations(page);
  });
}

test("expanded facts-card disclosures have no serious or critical violations", async ({ page }) => {
  await page.goto("/opportunities/lantern-bay-robotics-field-lab/record");
  await page.waitForLoadState("networkidle");
  for (const summary of await page.locator("details > summary").all()) await summary.click();
  await expect(page.locator("details.evidence-disclosure blockquote").first()).toBeVisible();
  await expectNoSeriousOrCriticalViolations(page);
});

test("a populated comparison has no serious or critical violations", async ({ page }) => {
  await page.goto("/compare");
  await page.getByRole("button", { name: /Lantern Bay Robotics Field Lab.*Add/ }).click();
  await page.getByRole("button", { name: /Cipher Finch Student Challenge.*Add/ }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await expectNoSeriousOrCriticalViolations(page);
});

test("the open mobile menu has no serious or critical violations", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Mobile-only navigation state");
  await page.goto("/");
  await page.getByRole("button", { name: "Menu" }).click();
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
  await expectNoSeriousOrCriticalViolations(page);
});
