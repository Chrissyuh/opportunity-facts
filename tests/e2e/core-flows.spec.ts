import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createEmptyCard, opportunityCardSchema } from "../../lib/opportunity/schema";
import { expect, expectNoPageOverflow, test } from "./support";

async function captureDocumentationScreenshot(
  page: Parameters<typeof expectNoPageOverflow>[0],
  filename: string,
) {
  await mkdir("docs/screenshots", { recursive: true });
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo(0, 0);
  });
  const skipLinkState = await page.locator(".skip-link").evaluate((element) => ({
    focused: document.activeElement === element,
    bottom: element.getBoundingClientRect().bottom,
  }));
  expect(skipLinkState.focused).toBe(false);
  expect(skipLinkState.bottom).toBeLessThanOrEqual(0);
  const screenshot = await page.screenshot({
    animations: "disabled",
    fullPage: true,
    // Chromium's full-page stitcher can expose off-canvas fixed elements while it scrolls.
    style: ".skip-link { display: none !important; }",
  });
  const screenshotPath = `docs/screenshots/${filename}`;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await writeFile(screenshotPath, screenshot);
      break;
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
    }
  }
}

test("homepage makes URL analysis the single dominant task", async ({ page }, testInfo) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: /Know what you/ })).toBeVisible();
  await expect(page.getByLabel("Paste an opportunity URL")).toBeVisible();
  await expect(page.getByRole("heading", { level: 2 })).toHaveCount(0);
  await expect(page.getByText("Research across the pages that matter.")).toHaveCount(0);
  await expectNoPageOverflow(page);
  if (testInfo.project.name === "desktop-chromium") {
    await captureDocumentationScreenshot(page, "home-desktop.png");
  }

  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "How it works" }).click();
  await expect(page).toHaveURL(/\/how-it-works$/);
  await expect(page.getByRole("heading", { level: 1, name: "From one link to answers you can inspect." })).toBeVisible();
});

test("homepage normalizes a bare domain and immediately starts analysis without exposing it in history", async ({ page }) => {
  let submittedUrl = "";
  await page.route("**/api/analyze", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ configured: true }) });
      return;
    }
    submittedUrl = (route.request().postDataJSON() as { url?: string }).url ?? "";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ controlledTestStop: true }),
    });
  });
  await page.goto("/");
  const target = "  www.program.example/apply?cycle=2027  ";
  await page.getByLabel("Paste an opportunity URL").fill(target);
  await page.getByRole("button", { name: "Analyze" }).click();

  await expect(page).toHaveURL(/\/analyze\?start=1$/);
  expect(page.url()).not.toContain("program.example");
  await expect.poll(() => submittedUrl).toBe("https://www.program.example/apply?cycle=2027");
});

test("homepage reports a malformed opportunity URL without navigating", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Paste an opportunity URL").fill("not a domain");
  await page.getByRole("button", { name: "Analyze" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("alert").filter({ hasText: "Enter a valid public opportunity URL" }))
    .toHaveText("Enter a valid public opportunity URL, such as example.org/program.");
});

test("a source excerpt can be opened with the keyboard", async ({ page }) => {
  await page.goto("/opportunities/lantern-bay-robotics-field-lab/record");

  const disclosure = page.locator("details.evidence-disclosure").first();
  const summary = disclosure.locator("summary");
  await summary.focus();
  await expect(summary).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(disclosure).toHaveAttribute("open", "");
  await expect(disclosure.locator("blockquote")).toBeVisible();
  await expect(disclosure.getByRole("link")).toHaveAttribute("href", /^https:\/\/[a-z0-9-]+\.example\//);
});

test("calculated claims describe their actual inputs", async ({ page }) => {
  await page.goto("/opportunities/redwood-comet-summer-studio/record");
  const totalCost = page.locator("article.fact-row").filter({
    has: page.getByRole("heading", { name: "Estimated total mandatory cost" }),
  });
  await expect(totalCost.getByText("Calculated from disclosed mandatory-cost inputs.", { exact: true })).toBeVisible();
  await expect(totalCost.getByText("Calculated from published counts.", { exact: true })).toHaveCount(0);
});

test("a blocked clipboard reports a usable correction fallback", async ({ page }) => {
  await page.goto("/opportunities/lantern-bay-robotics-field-lab/record");
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: () => Promise.reject(new Error("Clipboard denied for test.")),
      },
    });
  });

  await page.locator("details.correction-workflow > summary").click();
  await expect(page.getByText(/opening the GitHub action transfers the prefilled packet to GitHub/i)).toBeVisible();
  await page.getByLabel("Proposed value").fill("Corrected opportunity name");
  await page.getByLabel("Why it should change").fill("The cited page uses a newer name.");
  await page.getByLabel("Exact source excerpt").fill("The updated name is Lantern Bay Field Lab.");
  await page.getByLabel("Evidence URL").fill("http://127.0.0.1/correction");
  await expect(page.getByRole("button", { name: "Copy packet" })).toBeDisabled();
  await page.getByLabel("Evidence URL").fill("http://router/correction");
  await expect(page.getByRole("button", { name: "Copy packet" })).toBeDisabled();
  await page.getByLabel("Evidence URL").fill("https://lanternbay.example/correction?token=secret");
  await expect(page.getByRole("button", { name: "Copy packet" })).toBeDisabled();
  await page.getByLabel("Evidence URL").fill("https://lanternbay.example/correction#access_token=secret");
  await expect(page.getByRole("button", { name: "Copy packet" })).toBeDisabled();
  await page.getByLabel("Evidence URL").fill("https://lanternbay.example/correction");
  await page.getByRole("button", { name: "Copy packet" }).click();

  await expect(
    page.getByRole("status").filter({ hasText: "Clipboard access was unavailable" }),
  ).toBeVisible();
});

test("the opportunity library separates reviewed records from demos and combines filters", async ({ page }, testInfo) => {
  await page.goto("/opportunities");

  await expect(page.getByRole("heading", { level: 2, name: "17 cards" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "AI-audited opportunities" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "Fictional examples" })).toBeVisible();
  await expect(page.locator(".library-card .review-badge").filter({ hasText: "Demo data" })).toHaveCount(7);
  const filters = page.locator("#library-filter-controls");
  if (testInfo.project.name === "mobile-chromium") {
    await expect(page.getByRole("button", { name: "Show filters" })).toBeVisible();
    await expect(filters).toBeHidden();
    const firstReviewedCard = page.locator(".library-group[data-demo='false'] .library-card").first();
    await expect(firstReviewedCard).toBeVisible();
    expect((await firstReviewedCard.boundingBox())?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(844);
    await page.getByRole("button", { name: "Show filters" }).click();
    await expect(filters).toBeVisible();
  } else {
    await expect(filters).toBeVisible();
    await expect(page.getByRole("button", { name: "Show filters" })).toBeHidden();
  }
  await page.getByRole("searchbox", { name: "Search" }).fill("Lantern Bay");
  await page.getByLabel("Category").selectOption({ label: "Summer program" });
  await page.getByLabel("Review state").selectOption("demo");
  await page.getByLabel("Total cost").selectOption("disclosed");
  await page.getByLabel("Participation format").selectOption("in_person");

  await expect(page.getByRole("heading", { level: 2, name: "1 card" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Lantern Bay Robotics Field Lab", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Cipher Finch Student Challenge", exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Clear all", exact: true }).click();
  await expect(page.getByRole("heading", { level: 2, name: "17 cards" })).toBeVisible();
  if (testInfo.project.name === "mobile-chromium") {
    await expect(filters).toBeHidden();
    await page.getByRole("button", { name: "Show filters" }).click();
  }
  await expect(page.getByRole("searchbox", { name: "Search" })).toHaveValue("");

  await page.getByLabel("Refund policy").selectOption("not_applicable");
  await expect(page.getByRole("heading", { level: 2, name: "5 cards" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Lumiere Research Scholar Program", exact: true })).toHaveCount(0);
});

test("two cards can be selected and compared without a winner", async ({ page }, testInfo) => {
  await page.goto("/compare");

  await expect(page.getByRole("group", { name: "Available cards" })).toBeVisible();

  await page.getByRole("button", { name: /Lantern Bay Robotics Field Lab.*Add/ }).click();
  await page.getByRole("button", { name: /Cipher Finch Student Challenge.*Add/ }).click();

  const comparison = page.getByRole("table");
  await expect(comparison).toBeVisible();
  await expect(comparison.getByRole("columnheader", { name: /Lantern Bay Robotics Field Lab/ })).toBeVisible();
  await expect(comparison.getByRole("columnheader", { name: /Cipher Finch Student Challenge/ })).toBeVisible();
  await expect(comparison.getByText("Different across cards").first()).toBeVisible();
  await expect(page.getByText(/No winner is calculated/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Print comparison" })).toBeVisible();
  await expectNoPageOverflow(page);
  const scroll = page.locator(".comparison-scroll");
  if (testInfo.project.name === "mobile-chromium") {
    expect(await scroll.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
    await expect(page.getByText(/Swipe across to compare all 2 cards/)).toBeVisible();
    const startingScroll = await scroll.evaluate((element) => element.scrollLeft);
    await page.getByRole("button", { name: "Show next comparison card" }).click();
    await expect.poll(() => scroll.evaluate((element) => element.scrollLeft)).toBeGreaterThan(startingScroll);
    await expect(comparison.locator('tbody th[scope="row"]').first()).toHaveCSS("position", "sticky");
    await captureDocumentationScreenshot(page, "compare-mobile.png");
  } else {
    await expect(page.locator(".comparison-scroll-cue")).toBeHidden();
  }
});

test("comparison rejects duplicate local cards and never links them to a public detail route", async ({ page }) => {
  const sample = opportunityCardSchema.parse(
    JSON.parse(
      await readFile(join(process.cwd(), "data/demo/lantern-bay-robotics-field-lab.json"), "utf8"),
    ) as unknown,
  );
  const localCard = opportunityCardSchema.parse({
    ...sample,
    slug: "local-test-card",
    reviewState: "draft",
    reviewedAt: null,
    facts: {
      ...sample.facts,
      opportunity_name: {
        ...sample.facts.opportunity_name,
        value: "Local Test Card",
        displayValue: "Local Test Card",
      },
    },
  });
  const payload = {
    name: "local-test-card.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(localCard)),
  };

  await page.goto("/compare");
  await page.locator("#comparison-import").setInputFiles(payload);
  await expect(page.getByRole("status")).toContainText("Local Test Card added");
  await page.locator("#comparison-import").setInputFiles(payload);
  await expect(page.getByRole("status")).toContainText("already in this comparison");
  await expect(page.locator(".comparison-selected > div")).toHaveCount(1);

  await page.getByRole("button", { name: /Cipher Finch Student Challenge.*Add/ }).click();
  const localHeader = page.getByRole("columnheader", { name: /Local Test Card.*Local card/ });
  await expect(localHeader).toBeVisible();
  await expect(localHeader.getByRole("link")).toHaveCount(0);
});

test("comparison does not inherit review attestation from a local file", async ({ page }) => {
  const reviewed = opportunityCardSchema.parse(
    JSON.parse(
      await readFile(join(process.cwd(), "data/opportunities/diamond-challenge-2027.json"), "utf8"),
    ) as unknown,
  );
  const localCopy = opportunityCardSchema.parse({
    ...reviewed,
    slug: "local-attested-copy",
  });

  await page.goto("/compare");
  await page.locator("#comparison-import").setInputFiles({
    name: "local-attested-copy.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(localCopy)),
  });
  await page.getByRole("button", { name: /Cipher Finch Student Challenge.*Add/ }).click();

  const localHeader = page.getByRole("columnheader", {
    name: /Diamond Challenge.*Local card/i,
  });
  await expect(localHeader).toBeVisible();
  await expect(localHeader.getByText("Draft", { exact: true })).toBeVisible();
  await expect(localHeader.getByRole("link")).toHaveCount(0);
});

test("comparison labels a source-free blank draft as unassessed", async ({ page }) => {
  const blank = createEmptyCard({ slug: "blank-local-draft" });
  await page.goto("/compare");
  await page.locator("#comparison-import").setInputFiles({
    name: "blank-local-draft.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(blank)),
  });
  await page.getByRole("button", { name: /Cipher Finch Student Challenge.*Add/ }).click();

  const blankColumn = page.getByRole("columnheader", { name: /blank-local-draft.*Local card/i });
  await expect(blankColumn).toBeVisible();
  const table = page.getByRole("table");
  await page.getByRole("button", { name: "Full Record" }).click();
  await expect(table.getByText("Not assessed in this draft").first()).toBeVisible();
  await expect(table.getByText("Not found in reviewed sources").first()).toBeVisible();
});

test("builder blocks source-free assessments and excludes human-review promotion", async ({ page }) => {
  await page.goto("/build");
  const nameEditor = page.locator("form.fact-editor").filter({
    has: page.getByRole("heading", { level: 3, name: /Opportunity name/ }),
  });
  await nameEditor.getByRole("button", { name: "Apply opportunity name" }).click();
  await expect(page.getByRole("status")).toContainText("Record at least one checked source page");
  await expect(page.locator(".builder-preview").getByText("Not assessed in this draft").first()).toBeVisible();

  await page.getByLabel("Page URL", { exact: true }).fill("https://builder-review.example/program");
  await page.getByLabel("Page title", { exact: true }).fill("Program page");
  await page.getByRole("button", { name: "Add checked page" }).click();
  await expect(page.getByLabel("Review state").locator('option[value="human_reviewed"]')).toHaveCount(0);
  await expect(page.getByText(/Human reviewed is issued only through the local repository review workflow/)).toBeVisible();
  await expect(page.locator(".builder-preview .review-badge > span").first()).toHaveText("Draft");
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("opportunity-facts:builder:v1") ?? "null")?.reviewState)).toBe("draft");

  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Mark remaining fields not found after review" }).click();
  await expect(page.locator(".builder-preview").getByText("Not found in the sources checked").first()).toBeVisible();
  await page.locator(".builder-source-list").getByRole("button", { name: "Remove" }).click();
  await expect(page.locator(".builder-preview").getByText("Not found in the sources checked")).toHaveCount(0);
  await expect(page.locator(".builder-preview").getByText("Not assessed in this draft").first()).toBeVisible();
});

test("builder imports invalidate review attestation and later edits remain drafts", async ({ page }) => {
  const sample = opportunityCardSchema.parse(
    JSON.parse(
      await readFile(join(process.cwd(), "data/opportunities/diamond-challenge-2027.json"), "utf8"),
    ) as unknown,
  );
  await page.goto("/build");
  await page.locator("#builder-import").setInputFiles({
    name: "diamond-challenge-2027.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(sample)),
  });
  await expect.poll(() => page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )).toBe(0);
  if ((await page.evaluate(() => window.innerWidth)) !== 390) {
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() => page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    )).toBe(0);
  }
  await expect(page.getByRole("status")).toContainText(`draft revision ${sample.cardVersion + 1}`);

  await expect(page.getByLabel("Review state").locator('option[value="human_reviewed"]')).toHaveCount(0);
  const importedDraft = opportunityCardSchema.parse(
    await page.evaluate(() => JSON.parse(localStorage.getItem("opportunity-facts:builder:v1") ?? "null") as unknown),
  );
  expect(importedDraft.reviewState).toBe("draft");
  expect(importedDraft.reviewedAt).toBeNull();
  expect(importedDraft.cardVersion).toBe(sample.cardVersion + 1);

  const identitySection = page.locator(".builder-form-column details").filter({
    has: page.getByText("Identity", { exact: true }),
  });
  if (!(await identitySection.evaluate((element) => element.hasAttribute("open")))) {
    await identitySection.locator(":scope > summary").click();
  }
  const categoryStatus = page.locator("#builder-status-opportunity_category");
  const categoryEditor = categoryStatus.locator("xpath=ancestor::form");
  await categoryStatus.selectOption("not_applicable");
  await categoryEditor.getByLabel("Why this fact does not apply").fill("The checked sources explicitly state that no program category applies.");
  await categoryEditor.getByRole("button", { name: "Apply category" }).click();
  await expect(page.locator(".builder-preview .review-badge > span").first()).toHaveText("Draft");
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("opportunity-facts:builder:v1") ?? "null")?.reviewedAt)).toBeNull();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("opportunity-facts:builder:v1") ?? "null")?.facts?.opportunity_category?.status)).toBe("not_applicable");
});

test("changing builder source scope requires non-missing facts to be reassessed", async ({ page }) => {
  const sample = opportunityCardSchema.parse(
    JSON.parse(
      await readFile(join(process.cwd(), "data/demo/cipher-finch-student-challenge.json"), "utf8"),
    ) as unknown,
  );
  await page.goto("/build");
  await page.locator("#builder-import").setInputFiles({
    name: "cipher-finch-student-challenge.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(sample)),
  });
  await page.getByLabel("Page URL", { exact: true }).fill("https://cipherfinch.example/new-faq");
  await page.getByLabel("Page title", { exact: true }).fill("New FAQ");
  await page.getByRole("button", { name: "Add checked page" }).click();
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Mark remaining fields not found after review" }).click();

  await expect(page.getByRole("button", { name: "Export JSON" })).toBeDisabled();
  const nameFact = page.locator(".builder-preview .fact-row").filter({
    has: page.getByRole("heading", { level: 3, name: "Opportunity name" }),
  });
  await expect(nameFact.getByText("Not assessed in this draft")).toBeVisible();
});

test("builder preserves organizer attribution and blocks unaudited calculated rates", async ({ page }) => {
  const sample = opportunityCardSchema.parse(
    JSON.parse(
      await readFile(join(process.cwd(), "data/demo/tideglass-civic-data-fellowship.json"), "utf8"),
    ) as unknown,
  );
  await page.goto("/build");
  await page.locator("#builder-import").setInputFiles({
    name: "tideglass-civic-data-fellowship.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(sample)),
  });
  await page.locator(".builder-form-column details").filter({
    has: page.getByText("Selection", { exact: true }),
  }).locator("summary").click();

  const publishedRate = page.locator("form.fact-editor").filter({
    has: page.getByRole("heading", { level: 3, name: /Published acceptance-rate claim/ }),
  });
  await expect(publishedRate.getByText(/Organizer-stated, because this field records/)).toBeVisible();
  await publishedRate.getByRole("button", { name: "Apply published acceptance-rate claim" }).click();
  await expect.poll(() => page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem("opportunity-facts:builder:v1") ?? "null");
    return stored?.facts?.acceptance_rate_claim?.claimKind;
  })).toBe("organizer_stated");

  const calculatedRate = page.locator("form.fact-editor").filter({
    has: page.getByRole("heading", { level: 3, name: /Calculated acceptance rate/ }),
  });
  await calculatedRate.getByLabel("Evidence status").selectOption("disclosed");
  await expect(calculatedRate.getByText("Calculation workflow required.")).toBeVisible();
  await expect(calculatedRate.getByRole("button", { name: "Apply calculated acceptance rate" })).toBeDisabled();
});

test("the manual builder updates its preview but requires rich-model assessment before export", async ({ page }, testInfo) => {
  await page.goto("/build");

  await expect(page.locator(".builder-preview").getByText("Not assessed in this draft").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Export JSON" })).toBeDisabled();

  await page.getByLabel("Slug").fill("playwright-opportunity");
  await page.getByLabel("Short neutral summary").fill("A deterministic browser-test opportunity card.");
  await page.getByRole("button", { name: "Save card metadata" }).click();
  await expect(page.getByRole("status")).toContainText("Card metadata saved locally.");

  await page.getByLabel("Page URL", { exact: true }).fill("https://playwright-opportunity.example/faq");
  await page.getByLabel("Page title", { exact: true }).fill("Playwright source");
  await page.getByRole("button", { name: "Add checked page" }).click();
  await expect(page.getByRole("status")).toContainText("Checked source page added");
  await page.getByLabel("Page URL", { exact: true }).fill("https://playwright-opportunity.example/program");
  await page.getByLabel("Page title", { exact: true }).fill("Playwright source");
  await page.getByRole("button", { name: "Add checked page" }).click();

  const nameEditor = page.locator("form.fact-editor").filter({
    has: page.getByRole("heading", { level: 3, name: /Opportunity name/ }),
  });
  await nameEditor.getByLabel("Evidence status").selectOption("disclosed");
  await nameEditor.getByLabel("Displayed value or source wording").fill("Playwright Test Opportunity");
  await expect(nameEditor.getByLabel("Checked source page").locator("option")).toContainText([
    "Select a recorded page",
    "Playwright source — playwright-opportunity.example/faq",
    "Playwright source — playwright-opportunity.example/program",
  ]);
  await nameEditor.getByLabel("Checked source page").selectOption({ label: "Playwright source — playwright-opportunity.example/program" });
  await nameEditor.getByLabel("Exact supporting excerpt").fill("Playwright Test Opportunity is a fictional browser-test program.");
  await nameEditor.getByRole("button", { name: "Apply opportunity name" }).click();

  const categoryEditor = page.locator("form.fact-editor").filter({
    has: page.getByRole("heading", { level: 3, name: /^Category/ }),
  });
  await categoryEditor.getByLabel("Evidence status").selectOption("disclosed");
  await categoryEditor.getByLabel("Displayed value or source wording").fill("Browser test program");
  await categoryEditor.getByLabel("Checked source page").selectOption({ label: "Playwright source — playwright-opportunity.example/program" });
  await categoryEditor.getByLabel("Exact supporting excerpt").fill("Playwright Test Opportunity is a fictional browser-test program.");
  await categoryEditor.getByRole("button", { name: "Apply category" }).click();

  const preview = page.locator(".builder-preview");
  await expect(page.getByRole("status")).toContainText("Category updated and saved locally.");
  await expect(preview.getByRole("heading", { level: 3, name: "Playwright Test Opportunity" })).toBeVisible();
  await expect(preview.getByText("A deterministic browser-test opportunity card.")).toBeVisible();
  if (testInfo.project.name === "desktop-chromium") {
    await captureDocumentationScreenshot(page, "builder-desktop.png");
  }

  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Mark remaining fields not found after review" }).click();
  await expect(page.getByRole("button", { name: "Export JSON" })).toBeDisabled();
  await expect(page.getByText(/Export unlocks after every field is assessed/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Model the distinctions that affect a decision." })).toBeVisible();

  // V2 does not let the flat 59-field checklist stand in for the rich source model.
  // Cycle plus every structured family must be assessed through the task-based editor.
});

test("hidden file inputs expose a visible focus indicator on their import controls", async ({ page }) => {
  await page.goto("/build");
  const builderInput = page.locator("#builder-import");
  const builderLabel = page.locator('label[for="builder-import"]');
  await builderInput.focus();
  await expect(builderInput).toBeFocused();
  await expect(builderLabel).toHaveCSS("outline-style", "solid");
  await expect(builderLabel).toHaveCSS("outline-width", "3px");

  await page.goto("/compare");
  const comparisonInput = page.locator("#comparison-import");
  const comparisonLabel = page.locator('label[for="comparison-import"]');
  await comparisonInput.focus();
  await expect(comparisonInput).toBeFocused();
  await expect(comparisonLabel).toHaveCSS("outline-style", "solid");
  await expect(comparisonLabel).toHaveCSS("outline-width", "3px");
});

test("missing analysis configuration provides useful local fallbacks", async ({ page }) => {
  let analysisPosts = 0;
  await page.route("**/api/analyze", async (route) => {
    if (route.request().method() === "GET") {
      await route.continue();
      return;
    }
    analysisPosts += 1;
    await route.abort("failed");
  });
  await page.goto("/analyze?start=1");

  await expect(page.getByText("Extraction not configured", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "Live analysis is paused." })).toBeVisible();
  await expect(page.getByText("Your input has not been sent.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Try a sample" })).toBeVisible();
  await expect(page.getByRole("link", { name: "How it works" }).last()).toBeVisible();

  await expect(page.getByRole("button", { name: "Automatic extraction unavailable" })).toBeDisabled();
  expect(analysisPosts).toBe(0);
  await expect(page.getByRole("button", { name: "Open paste mode" })).toHaveCount(0);
});

test("a mocked analysis response renders a validated draft card", async ({ page }) => {
  await page.route("**/api/analyze", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        status: 200,
        body: JSON.stringify({ configured: true, model: "playwright-mocked-model" }),
      });
      return;
    }
    const sample = opportunityCardSchema.parse(
      JSON.parse(
        await readFile(join(process.cwd(), "data/demo/lantern-bay-robotics-field-lab.json"), "utf8"),
      ) as unknown,
    );
    const card = {
      ...sample,
      slug: "mocked-analysis-draft",
      reviewState: "automated_draft",
      reviewedAt: null,
      summary: "A draft produced from a deterministic mocked analysis response.",
      facts: {
        ...sample.facts,
        opportunity_name: {
          ...sample.facts.opportunity_name,
          value: "Mocked Analysis Draft",
          displayValue: "Mocked Analysis Draft",
        },
      },
    };
    await new Promise((resolve) => setTimeout(resolve, 1_100));
    await route.fulfill({
      contentType: "application/json",
      status: 200,
      body: JSON.stringify({
        card,
        reviewedPages: [
          {
            id: "program",
            url: "https://mocked-analysis.example/program",
            title: "Mocked source page",
            pageType: "user_supplied",
            accessedAt: "2026-08-10T12:00:00Z",
            truncated: false,
            truncatedForModel: false,
            contentUnavailable: false,
          },
        ],
        pageWarnings: [
          {
            url: "https://mocked-analysis.example/blocked-rules?token=do-not-show#private-fragment",
            code: "TIMEOUT",
            message: "private upstream diagnostic that must not be displayed",
          },
        ],
        evidenceWarnings: [
          {
            fieldId: "model.foundation",
            sourceId: "program",
            message: "The foundation extraction family did not complete; other sections were retained.",
          },
        ],
      }),
    });
  });

  await page.goto("/analyze?start=1");
  await expect(page.getByText("Extraction not configured", { exact: true })).toHaveCount(0);
  await page.getByLabel("Public opportunity URL").fill("https://mocked-analysis.example/program");
  await page.getByRole("button", { name: "Analyze", exact: true }).click();

  await expect(page.getByRole("heading", { level: 2, name: "Opportunity research" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel analysis" })).toBeVisible();
  await expect(page.locator(".research-workspace-controls time")).toContainText(/\d+ sec/);
  await expect(page.locator(".analysis-input")).toHaveCount(0);
  const resultTitle = page.getByRole("heading", { level: 2, name: "Analysis complete" });
  await expect(resultTitle).toBeVisible();
  await expect(resultTitle).toBeFocused();
  const resultTop = async () => (await page.locator(".analysis-result").boundingBox())?.y ?? Number.POSITIVE_INFINITY;
  await expect.poll(resultTop).toBeGreaterThanOrEqual(0);
  await expect.poll(resultTop).toBeLessThan(40);
  await expect(page.getByRole("heading", { level: 3, name: "Mocked Analysis Draft" })).toBeVisible();
  await page.locator("details.analysis-sources > summary").click();
  await expect(page.getByText("Mocked source page")).toBeVisible();
  await page.locator("details.analysis-draft-note > summary").click();
  await expect(page.getByText("This is not human review or a verdict", { exact: false })).toBeVisible();
  await expect(page.getByText("1 candidate warning withheld.", { exact: false })).toBeVisible();
  await page.locator("details.page-warning-panel > summary").click();
  await expect(page.getByText("https://mocked-analysis.example/blocked-rules", { exact: true })).toBeVisible();
  await expect(page.getByText("The page did not respond before the fetch time limit.")).toBeVisible();
  await expect(page.getByText("do-not-show", { exact: false })).toHaveCount(0);
  await expect(page.getByText("private upstream diagnostic", { exact: false })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Paste text for failed pages" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Paste source text" })).toHaveCount(0);
  await expect(page.locator(".analysis-progress")).toHaveCount(0);
  await page.locator("details.analysis-more-actions > summary").click();
  await expect(page.getByRole("button", { name: "Save locally" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit draft" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Export JSON" })).toBeVisible();
  await page.getByRole("button", { name: "Save locally" }).click();
  await expect(page.getByRole("status").filter({ hasText: "made available in the manual builder" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("opportunity-facts:builder:v1"))).toContain("Mocked Analysis Draft");
  await page.getByRole("button", { name: "Edit draft" }).click();
  await expect(page).toHaveURL(/\/build$/);
  await expect(page.locator(".builder-preview").getByRole("heading", { level: 3, name: "Mocked Analysis Draft" })).toBeVisible();
});

test("a malformed configured-provider result leaves a professional recoverable state", async ({ page }) => {
  await page.route("**/api/analyze", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        status: 200,
        body: JSON.stringify({ configured: true, model: "playwright-mocked-model" }),
      });
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      status: 200,
      body: JSON.stringify({
        incompleteProviderResult: true,
      }),
    });
  });

  await page.goto("/analyze?start=1");
  await page.getByLabel("Public opportunity URL").fill("https://program.example/current");
  await page.getByRole("button", { name: "Analyze", exact: true }).click();

  const alert = page.locator(".error-summary");
  await expect(alert).toContainText("Analysis did not complete.");
  await expect(alert).toContainText("invalid facts-card response");
  await expect(page.getByRole("button", { name: "Analyze", exact: true })).toBeEnabled();
});

test("mobile navigation stays compact and avoids page overflow", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Mobile-only navigation behavior");
  await page.goto("/");

  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  await expect(navigation).toBeVisible();
  await expect(page.getByRole("button", { name: /Menu|Close/ })).toHaveCount(0);
  await navigation.getByRole("link", { name: "How it works" }).click();
  await expect(page).toHaveURL(/\/how-it-works$/);
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
  await expectNoPageOverflow(page);
});

test("print media keeps the facts record and removes interactive chrome", async ({ page }, testInfo) => {
  await page.goto("/opportunities/lantern-bay-robotics-field-lab/record");
  await page.emulateMedia({ media: "print" });

  await expect(page.locator(".site-header")).toBeHidden();
  await expect(page.locator(".site-footer")).toBeHidden();
  await expect(page.getByRole("button", { name: "Export JSON" })).toBeHidden();
  await expect(page.getByRole("heading", { level: 1, name: "Lantern Bay Robotics Field Lab" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Source pages checked" })).toBeVisible();
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await page.screenshot({ path: testInfo.outputPath("sample-card-print.png"), fullPage: true });
});
