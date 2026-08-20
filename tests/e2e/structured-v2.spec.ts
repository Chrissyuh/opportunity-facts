import { expect, expectNoPageOverflow, test } from "./support";

async function openStructuredDetails(page: Parameters<typeof expectNoPageOverflow>[0]) {
  await page.waitForLoadState("networkidle");
  const details = page.locator("details").filter({
    has: page.getByText("Explore structured details", { exact: true }),
  });
  await expect(details).toBeVisible();
  await details.locator(":scope > summary").click();
  await expect(details).toHaveAttribute("open", "");
  return details;
}

test("TechRise keeps restricted build funding separate from participant cash", async ({ page }) => {
  await page.goto("/opportunities/nasa-techrise-student-challenge-2026-2027/record");
  const details = await openStructuredDetails(page);
  const outcomes = details.getByRole("heading", { name: "Outcomes and prizes" }).locator("..");

  await expect(outcomes.getByRole("region", { name: "Project funding and reimbursement" })).toContainText(
    "$1,500 experiment build funding",
  );
  await expect(outcomes.getByRole("region", { name: "Project funding and reimbursement" })).toContainText(
    "Restricted project budget",
  );
  await expect(outcomes.getByText("Team", { exact: true })).toBeVisible();
  await expect(outcomes.getByRole("region", { name: "Cash to participant(s)" })).toHaveCount(0);
  await expect(outcomes.getByText("Personal cash prize", { exact: true })).toHaveCount(0);
  const assessmentColors = await page.locator(".disclosure-track li > span:first-child").evaluateAll(
    (segments) => new Set(segments.map((segment) => getComputedStyle(segment).backgroundColor)).size,
  );
  expect(assessmentColors).toBeGreaterThan(1);
  await expectNoPageOverflow(page);
});

test("Lumiere keeps affiliations, credit partnership, and tier prices distinct", async ({ page }) => {
  await page.goto("/opportunities/lumiere-research-scholar-program-fall-2026/record");
  const details = await openStructuredDetails(page);

  await expect(details.getByText("Credit partnership", { exact: true })).toBeVisible();
  await expect(details.getByText("Founders affiliated with", { exact: true })).toHaveCount(2);
  await expect(details.getByText("Mentors affiliated with", { exact: true })).toHaveCount(4);
  await expect(details.getByText("Institution partnership", { exact: true })).toHaveCount(0);

  const programs = details.getByRole("heading", { name: "Programs and cohorts" }).locator("..");
  await expect(programs.getByText("Individual Research Program", { exact: true }).first()).toBeVisible();
  await expect(programs.getByText("Premium Research & Publication Program", { exact: true }).first()).toBeVisible();
  await expect(programs.getByText("$3,190", { exact: true }).first()).toBeVisible();
  await expect(programs.getByText("$6,450", { exact: true }).first()).toBeVisible();
  await expectNoPageOverflow(page);
});

test("Diamond retains two selection paths and team-level prize rows", async ({ page }) => {
  await page.goto("/opportunities/diamond-challenge-2027/record");
  const details = await openStructuredDetails(page);

  const process = details.getByRole("heading", { name: "Schedule and selection paths" }).locator("..");
  await expect(process.getByText("Live pitch pathway", { exact: true })).toBeVisible();
  await expect(process.getByText("Virtual/pre-recorded pitch pathway", { exact: true })).toBeVisible();

  const cash = details.getByRole("region", { name: "Cash to participant(s)" });
  await expect(cash.getByText("Business Innovation 1st place: $12,000/team", { exact: true })).toBeVisible();
  await expect(cash.getByText("Social Innovation 1st place: $12,000/team", { exact: true })).toBeVisible();
  await expect(cash.getByText("Team", { exact: true })).toHaveCount(6);
  await expectNoPageOverflow(page);
});

test("structured comparison progressively reveals real distinctions without page overflow", async ({ page }) => {
  await page.goto("/compare");
  await page.getByRole("button", { name: /NASA TechRise Student Challenge.*Add/ }).click();
  await page.getByRole("button", { name: /Lumiere Research Scholar Program.*Add/ }).click();
  await page.getByRole("button", { name: /Diamond Challenge.*Add/ }).click();
  await page.getByRole("button", { name: "Full Record" }).click();

  const comparison = page.getByRole("region", { name: "Compare distinctions the summary rows cannot hold." });
  await expect(comparison).toBeVisible();
  const outcomeDetails = comparison.locator("details").filter({
    has: page.getByText("Outcomes, funding, and prizes", { exact: true }),
  });
  await outcomeDetails.locator(":scope > summary").click();

  const cards = outcomeDetails.locator(".structured-comparison-grid > article");
  await expect(cards).toHaveCount(3);
  const techRise = cards.filter({ has: page.getByRole("heading", { name: "NASA TechRise Student Challenge" }) });
  const lumiere = cards.filter({ has: page.getByRole("heading", { name: "Lumiere Research Scholar Program" }) });
  const diamond = cards.filter({ has: page.getByRole("heading", { name: "Diamond Challenge" }) });
  await expect(techRise).toContainText("Project funding and reimbursement");
  await expect(techRise).not.toContainText("Cash to participant(s)");
  await expect(lumiere).toContainText("Tuition and scholarship support");
  await expect(diamond).toContainText("Cash to participant(s)");
  await expect(diamond).toContainText("Business Innovation 1st place: $12,000/team");

  await expectNoPageOverflow(page);
  const gridFits = await outcomeDetails.locator(".structured-comparison-grid").evaluate((grid) =>
    grid.scrollWidth <= grid.clientWidth + 1,
  );
  expect(gridFits).toBe(true);
});
