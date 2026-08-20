import { expect, expectNoPageOverflow, test } from "./support";

test("a real opportunity opens with practical answers, not schema metadata", async ({ page }) => {
  await page.goto("/opportunities/diamond-challenge-2027");
  await expect(page.getByRole("heading", { level: 1, name: "Diamond Challenge" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "At a glance" })).toBeVisible();
  await expect(page.getByText("Application deadline", { exact: true })).toBeVisible();
  await expect(page.getByText("Cost", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Needs attention" })).toBeVisible();
  await expect(page.locator(".attention-item")).toHaveCount(2);
  await expect(page.getByText(/schema 2\./i)).toHaveCount(0);
  await expectNoPageOverflow(page);
});

test("full record supplies filtering, jump navigation, evidence tools, and one title heading", async ({ page }) => {
  await page.goto("/opportunities/diamond-challenge-2027/record");
  await expect(page.getByLabel("Full record sections")).toBeVisible();
  await expect(page.getByLabel("Search facts")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Status" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Expand evidence" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await page.getByRole("combobox", { name: "Status" }).selectOption("unresolved");
  await expect(page.locator(".fact-row-not_found:visible, .fact-row-unclear:visible, .fact-row-conflicting:visible").first()).toBeVisible();
  await expectNoPageOverflow(page);
});

test("comparison begins with key differences and progressively reveals the record", async ({ page }) => {
  await page.goto("/compare");
  await page.getByRole("button", { name: /NASA TechRise Student Challenge.*Add/ }).click();
  await page.getByRole("button", { name: /Diamond Challenge.*Add/ }).click();
  await expect(page.getByRole("button", { name: "Key Differences" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: "Key differences" })).toBeVisible();
  await page.getByRole("button", { name: "Full Record" }).click();
  await expect(page.getByRole("heading", { name: "Full record" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Compare distinctions the summary rows cannot hold." })).toBeVisible();
});

test("batch analysis enforces the visible five-item demo limit before inference", async ({ page }) => {
  await page.goto("/analyze/batch");
  await expect(page.getByText("Demo limit: up to 5 opportunities per batch.")).toBeVisible();
  if (await page.getByRole("button", { name: "Automatic extraction unavailable" }).isVisible()) {
    await expect(page.getByRole("link", { name: "Explore examples" })).toBeVisible();
    return;
  }
  await page.getByLabel("Opportunity URLs").fill(Array.from({ length: 6 }, (_, index) => `https://example${index}.org/program`).join("\n"));
  await page.getByRole("button", { name: "Analyze batch" }).click();
  await expect(page.getByText(/Demo limit: enter no more than 5/)).toBeVisible();
});
