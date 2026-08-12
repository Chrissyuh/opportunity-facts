import { mkdir, readFile } from "node:fs/promises";
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
  await page.screenshot({
    animations: "disabled",
    fullPage: true,
    path: `docs/screenshots/${filename}`,
    // Chromium's full-page stitcher can expose off-canvas fixed elements while it scrolls.
    style: ".skip-link { display: none !important; }",
  });
}

test("homepage loads cleanly and opens the complete sample in one click", async ({ page }, testInfo) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: /Know what you/ })).toBeVisible();
  await expect(page.getByText("Opportunity Facts reports what reviewed sources disclose.")).toBeVisible();
  await expectNoPageOverflow(page);
  if (testInfo.project.name === "desktop-chromium") {
    await captureDocumentationScreenshot(page, "home-desktop.png");
  }

  await page.getByRole("link", { name: "Try a sample", exact: true }).click();

  await expect(page).toHaveURL(/\/opportunities\/lantern-bay-robotics-field-lab$/, {
    timeout: 30_000,
  });
  await expect(page.getByRole("heading", { level: 1, name: "Lantern Bay Robotics Field Lab" })).toBeVisible();
  await expect(page.getByText("Demo data", { exact: true })).toHaveCount(1);
  await expect(page.getByText(/of 13 core areas assessed/)).toBeVisible();
  await expect(page.getByText(/of \d+ applicable disclosed/)).toBeVisible();
  await expect(page.getByLabel("Evidence status key")).toContainText("Disclosed");
  await expect(page.getByLabel("Evidence status key")).toContainText("Not found");
  await expect(page.getByLabel("Evidence status key")).toContainText("Unclear");
  await expect(page.getByLabel("Evidence status key")).toContainText("Conflicting");
  if (testInfo.project.name === "desktop-chromium") {
    await captureDocumentationScreenshot(page, "sample-card-desktop.png");
  }

});

test("homepage hands an analysis URL off without putting it in browser history", async ({ page }) => {
  await page.goto("/");
  const target = "https://program.example/apply?cycle=2027";
  await page.getByLabel("Paste a public opportunity URL").fill(target);
  await page.getByRole("button", { name: "Analyze" }).click();

  await expect(page).toHaveURL(/\/analyze$/);
  expect(page.url()).not.toContain("program.example");
  await expect(page.getByLabel("Public opportunity URL")).toHaveValue(target);
});

test("a source excerpt can be opened with the keyboard", async ({ page }) => {
  await page.goto("/opportunities/lantern-bay-robotics-field-lab");

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
  await page.goto("/opportunities/redwood-comet-summer-studio");
  const totalCost = page.locator("article.fact-row").filter({
    has: page.getByRole("heading", { name: "Estimated total mandatory cost" }),
  });
  await expect(totalCost.getByText("Calculated from disclosed mandatory-cost inputs.", { exact: true })).toBeVisible();
  await expect(totalCost.getByText("Calculated from published counts.", { exact: true })).toHaveCount(0);
});

test("a blocked clipboard reports a usable correction fallback", async ({ page }) => {
  await page.goto("/opportunities/lantern-bay-robotics-field-lab");
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

test("the opportunity library combines search and disclosure filters", async ({ page }) => {
  await page.goto("/opportunities");

  await expect(page.getByRole("heading", { level: 2, name: "10 cards" })).toBeVisible();
  await expect(page.locator(".library-card .review-badge").filter({ hasText: "Demo data" })).toHaveCount(7);
  await page.getByRole("searchbox", { name: "Search" }).fill("Lantern Bay");
  await page.getByLabel("Category").selectOption({ label: "Summer program" });
  await page.getByLabel("Review state").selectOption("demo");
  await page.getByLabel("Total cost").selectOption("disclosed");
  await page.getByLabel("Participation format").selectOption("in_person");

  await expect(page.getByRole("heading", { level: 2, name: "1 card" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Lantern Bay Robotics Field Lab", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Cipher Finch Student Challenge", exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Clear all", exact: true }).click();
  await expect(page.getByRole("heading", { level: 2, name: "10 cards" })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Search" })).toHaveValue("");

  await page.getByLabel("Refund policy").selectOption("not_applicable");
  await expect(page.getByRole("heading", { level: 2, name: "3 cards" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Lumiere Research Scholar Program", exact: true })).toHaveCount(0);
});

test("two cards can be selected and compared without a winner", async ({ page }, testInfo) => {
  await page.goto("/compare");

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
    await captureDocumentationScreenshot(page, "compare-mobile.png");
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
  await expect(table.getByText("Not assessed in this draft").first()).toBeVisible();
  await expect(table.getByText("Not found in reviewed sources").first()).toBeVisible();
});

test("builder blocks source-free assessments and incomplete review-state promotion", async ({ page }) => {
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
  await page.getByLabel("Review state").selectOption("human_reviewed");
  await page.getByRole("button", { name: "Save card metadata" }).click();
  await expect(page.locator(".error-summary")).toContainText("every field to be explicitly assessed");
  await expect(page.locator(".builder-preview .review-badge")).toHaveText("Draft");
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("opportunity-facts:builder:v1") ?? "null")?.reviewState)).toBe("draft");

  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Mark remaining fields not found after review" }).click();
  await expect(page.locator(".builder-preview").getByText("Not found in the sources checked").first()).toBeVisible();
  await page.locator(".builder-source-list").getByRole("button", { name: "Remove" }).click();
  await expect(page.locator(".builder-preview").getByText("Not found in the sources checked")).toHaveCount(0);
  await expect(page.locator(".builder-preview").getByText("Not assessed in this draft").first()).toBeVisible();
});

test("builder review attestation is newly stamped and invalidated by later edits", async ({ page }) => {
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

  await page.getByLabel("Review state").selectOption("human_reviewed");
  await page.getByRole("button", { name: "Save card metadata" }).click();
  const reviewed = opportunityCardSchema.parse(
    await page.evaluate(() => JSON.parse(localStorage.getItem("opportunity-facts:builder:v1") ?? "null") as unknown),
  );
  expect(reviewed.reviewState).toBe("human_reviewed");
  expect(reviewed.reviewedAt).not.toBe(sample.reviewedAt);
  expect(reviewed.cardVersion).toBe(sample.cardVersion + 1);

  await expect(page.locator(".builder-preview .review-badge")).toHaveText("Human reviewed");
  await page.getByRole("button", { name: "Save card metadata" }).click();
  const reattested = opportunityCardSchema.parse(
    await page.evaluate(() => JSON.parse(localStorage.getItem("opportunity-facts:builder:v1") ?? "null") as unknown),
  );
  expect(reattested.cardVersion).toBe(reviewed.cardVersion + 1);
  expect(reattested.reviewedAt).not.toBe(reviewed.reviewedAt);

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
  await expect(page.locator(".builder-preview .review-badge")).toHaveText("Draft");
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("opportunity-facts:builder:v1") ?? "null")?.reviewedAt)).toBeNull();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("opportunity-facts:builder:v1") ?? "null")?.cardVersion)).toBe(sample.cardVersion + 3);
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
  await page.goto("/analyze");

  await expect(page.getByText("Extraction not configured", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "The public product still works." })).toBeVisible();
  await expect(page.getByText("Your input has not been sent.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Try the sample" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Create manually" })).toBeVisible();

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
      reviewState: "draft",
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
        pageWarnings: [],
        evidenceWarnings: [],
      }),
    });
  });

  await page.goto("/analyze");
  await expect(page.getByText("Extraction not configured", { exact: true })).toHaveCount(0);
  await page.getByLabel("Public opportunity URL").fill("https://mocked-analysis.example/program");
  await page.getByRole("button", { name: "Start analysis" }).click();

  await expect(page.getByRole("heading", { level: 2, name: "Inspect and correct the draft." })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "Mocked Analysis Draft" })).toBeVisible();
  await expect(page.getByText("Mocked source page")).toBeVisible();
  await expect(page.getByText("Draft ready", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save locally" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit in builder" })).toBeVisible();
  await expect(
    page.locator(".analysis-result-heading").getByRole("button", { name: "Export JSON" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save locally" }).click();
  await expect(page.getByRole("status").filter({ hasText: "made available in the manual builder" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("opportunity-facts:builder:v1"))).toContain("Mocked Analysis Draft");
  await page.getByRole("button", { name: "Edit in builder" }).click();
  await expect(page).toHaveURL(/\/build$/);
  await expect(page.locator(".builder-preview").getByRole("heading", { level: 3, name: "Mocked Analysis Draft" })).toBeVisible();
});

test("mobile navigation opens, closes through navigation, and avoids page overflow", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Mobile-only navigation behavior");
  await page.goto("/");

  const menu = page.getByRole("button", { name: "Menu" });
  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(navigation).toBeHidden();
  await menu.click();
  await expect(page.getByRole("button", { name: "Close" })).toHaveAttribute("aria-expanded", "true");
  await expect(navigation).toBeVisible();
  await navigation.getByRole("link", { name: "Browse" }).click();
  await expect(page).toHaveURL(/\/opportunities$/);
  await expect(page.getByRole("button", { name: "Menu" })).toHaveAttribute("aria-expanded", "false");
  await expectNoPageOverflow(page);
});

test("print media keeps the facts record and removes interactive chrome", async ({ page }, testInfo) => {
  await page.goto("/opportunities/lantern-bay-robotics-field-lab");
  await page.emulateMedia({ media: "print" });

  await expect(page.locator(".site-header")).toBeHidden();
  await expect(page.locator(".site-footer")).toBeHidden();
  await expect(page.getByRole("button", { name: "Export JSON" })).toBeHidden();
  await expect(page.getByRole("heading", { level: 1, name: "Lantern Bay Robotics Field Lab" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Source pages checked" })).toBeVisible();
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await page.screenshot({ path: testInfo.outputPath("sample-card-print.png"), fullPage: true });
});
