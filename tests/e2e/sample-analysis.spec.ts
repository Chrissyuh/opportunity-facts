import { expect, test } from "@playwright/test";

test("replays a saved analysis without calling the provider route", async ({ page }) => {
  const providerRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/analyze")) providerRequests.push(request.url());
  });

  await page.goto("/analyze?sample=mites-summer");
  const sampleIndicator = page.locator("summary.review-badge").filter({ hasText: "Sample analysis" });
  await expect(sampleIndicator).toBeVisible();
  await sampleIndicator.click();
  await expect(sampleIndicator).toHaveAttribute(
    "data-description",
    /replay of an actual saved analyzer run/i,
  );
  await expect(page.getByLabel("Submitted public URL")).toHaveValue("https://mites.mit.edu/discover-mites/mites-summer/");
  await page.getByRole("button", { name: "Skip to result" }).click();
  await expect(page.getByRole("heading", { name: "Sample analysis result" })).toBeVisible();
  await expect(page.getByLabel("Sample analysis result").getByRole("heading", { name: "MITES Summer", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Needs attention" })).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Try another sample/ })).toBeVisible();
  expect(providerRequests).toEqual([]);
});

test("next sample rotation avoids the previously watched result", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("opportunity-facts:sample-rotation:v1", JSON.stringify({
      seen: ["mites-summer"],
      last: "mites-summer",
    }));
    Math.random = () => 0;
  });
  await page.goto("/analyze?sample=next");
  await page.waitForURL(/\/analyze\?sample=(?!next)/u);
  expect(new URL(page.url()).searchParams.get("sample")).not.toBe("mites-summer");
  await expect(page.getByText("Sample analysis", { exact: true }).first()).toBeVisible();
});

test("sample replay has no document-level mobile overflow", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Mobile-only geometry check.");
  await page.goto("/analyze?sample=diamond-challenge");
  await page.getByRole("button", { name: "Skip to result" }).click();
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
});
