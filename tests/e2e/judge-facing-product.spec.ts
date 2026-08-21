import { expect, expectNoPageOverflow, test } from "./support";

test("How It Works explains the product before exposing methodology", async ({ page }) => {
  await page.goto("/how-it-works");

  await expect(page.getByRole("heading", { level: 1, name: "From one link to answers you can inspect." })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Five steps, one practical result." })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Why not just ask an AI to summarize the website?" })).toBeVisible();
  await expect(page.getByText("Mentor affiliation vs institutional partnership")).toHaveCount(0);
  await expect(page.getByText(/mentor affiliation separate from institutional partnership/i)).toBeVisible();
  await expect(page.getByRole("list", { name: "Opportunity Facts processing pipeline" }).getByRole("listitem")).toHaveCount(5);
  await expect(page.getByRole("link", { name: /full methodology and limitations/i })).toHaveAttribute("href", "/methodology");
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

test("homepage review provenance comes from the current card state", async ({ page }) => {
  await page.goto("/");
  const example = page.locator(".home-example-card").first();
  await expect(example.locator("[data-review-state='ai_audited']")).toHaveCount(1);
  await expect(example.getByText("AI-audited", { exact: true })).toBeVisible();
});
