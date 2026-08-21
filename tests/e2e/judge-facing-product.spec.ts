import { expect, expectNoPageOverflow, test } from "./support";

test("How It Works explains the product before exposing methodology", async ({ page }, testInfo) => {
  await page.goto("/how-it-works");

  await expect(page.getByRole("heading", { level: 1, name: "From one link to answers you can inspect." })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Five steps. One practical result." })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Why not just summarize the website?" })).toBeVisible();
  await expect(page.locator(".how-compact-steps > li")).toHaveCount(5);
  await expect(page.getByRole("table")).toContainText("Exact retained excerpts beside supported claims");
  await expect(page.getByRole("table")).toContainText("Scope, cycle, relationship, and recipient checks");
  await expect(page.getByRole("link", { name: /Read the methodology/i })).toHaveAttribute("href", "/methodology");
  if (testInfo.project.name === "desktop-chromium") {
    expect(await page.locator(".how-compact-page").evaluate((element) => element.getBoundingClientRect().height)).toBeLessThanOrEqual(850);
  }
  await expectNoPageOverflow(page);
});

test("AI-audited explanations work with hover, keyboard focus, and tap", async ({ page }, testInfo) => {
  await page.goto("/opportunities/mites-summer-2027");
  const explanation = page.locator("details.review-state-explanation").first();
  const badge = explanation.locator("summary");

  await expect(badge).toContainText("AI-audited");
  await expect(badge).toContainText(/higher-capability AI workflow/i);

  if (testInfo.project.name === "desktop-chromium") {
    await badge.hover();
    expect(await badge.evaluate((element) => getComputedStyle(element, "::after").display)).toBe("block");
  }

  await badge.focus();
  await expect(badge).toBeFocused();
  expect(await badge.evaluate((element) => getComputedStyle(element, "::after").display)).toBe("block");

  await badge.press("Enter");
  await expect(explanation).toHaveAttribute("open", "");
  await expect(badge).toContainText("No human review is claimed");
  await expectNoPageOverflow(page);
});

test("homepage keeps the analyzer dominant and leaves examples out of primary navigation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByLabel("Paste an opportunity URL")).toBeVisible();
  await expect(page.getByRole("link", { name: "Try a sample" })).toHaveAttribute("href", "/analyze?sample=next");
  await expect(page.getByRole("heading", { level: 2 })).toHaveCount(0);
  await expect(page.getByText("Source-backed facts from the public pages that matter.")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main navigation" }).getByText("Examples", { exact: true })).toHaveCount(0);
  await expect(page.getByText("AI-audited", { exact: true })).toHaveCount(0);
});
