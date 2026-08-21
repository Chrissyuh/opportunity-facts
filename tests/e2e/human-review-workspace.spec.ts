import { expect, test } from "@playwright/test";

test("the local human-review workspace is unavailable by default", async ({ page }) => {
  const response = await page.goto("/review");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "This page is not in the file." })).toBeVisible();
});
