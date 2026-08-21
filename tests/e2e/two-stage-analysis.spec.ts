import { readFile } from "node:fs/promises";
import { join } from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { opportunityCardSchema, type OpportunityCard } from "@/lib/opportunity/schema";
import { ANALYZER_VERSION } from "@/lib/analysis/analyzer-version";
import { expect, expectNoPageOverflow, test } from "./support";

async function expectNoSeriousOrCriticalViolations(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical")).toEqual([]);
}

async function automatedCard(): Promise<OpportunityCard> {
  const source = opportunityCardSchema.parse(JSON.parse(await readFile(
    join(process.cwd(), "data/demo/lantern-bay-robotics-field-lab.json"),
    "utf8",
  )) as unknown);
  return opportunityCardSchema.parse({
    ...source,
    cardVersion: source.cardVersion + 1,
    slug: "two-stage-research-draft",
    summary: "A source-backed draft used to verify the two-stage student experience.",
    reviewState: "automated_draft",
    reviewedAt: null,
    facts: {
      ...source.facts,
      opportunity_name: {
        ...source.facts.opportunity_name,
        value: "Two-Stage Research Draft",
        displayValue: "Two-Stage Research Draft",
      },
    },
  });
}

function attentionItems(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `attention-${index}`,
    category: index === 0 ? "cost" : "other",
    priority: index < 2 ? "high" : "medium",
    title: `Important question ${index + 1}`,
    explanation: `This retained issue ${index + 1} needs verification against the checked sources.`,
    fieldIds: index === 0 ? ["estimated_total_mandatory_cost"] : [],
    claimIds: [],
    sourceIds: [],
    suggestedNextStep: null,
    origin: "deterministic_fallback",
  }));
}

function result(card: OpportunityCard, depth: "normal" | "extended") {
  return {
    kind: "card",
    card,
    reviewedPages: [{
      id: "program",
      url: "https://two-stage.example/program",
      title: "Current program page",
      pageType: "user_supplied",
      accessedAt: "2026-08-20T12:00:00.000Z",
      truncated: false,
      truncatedForModel: false,
      contentUnavailable: false,
    }],
    pageWarnings: [],
    evidenceWarnings: [],
    attentionItems: attentionItems(depth === "extended" ? 5 : 4),
    research: {
      depth,
      extendedAvailable: depth === "normal",
      sessionId: depth === "normal" ? "session-two-stage" : null,
    },
    failureSuppression: { bypass: false, allowLocalSuppression: true },
  };
}

test("normal analysis feels complete and Extended Research enriches it in place", async ({ page }) => {
  const card = await automatedCard();
  const normal = result(card, "normal");
  const extended = result(card, "extended");
  const submittedBodies: unknown[] = [];
  await page.addInitScript(({ normalResult, extendedResult }) => {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const requestUrl = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (!requestUrl.includes("/api/analyze")) return nativeFetch(input, init);
      const method = init?.method ?? (input instanceof Request ? input.method : "GET");
      if (method === "GET") return new Response(JSON.stringify({ configured: true }), { headers: { "Content-Type": "application/json" } });
      const body = typeof init?.body === "string" ? JSON.parse(init.body) as unknown : null;
      (window as typeof window & { __submittedBodies?: unknown[] }).__submittedBodies ??= [];
      (window as typeof window & { __submittedBodies: unknown[] }).__submittedBodies.push(body);
      const isExtended = requestUrl.endsWith("/api/analyze/extended");
      const encoder = new TextEncoder();
      const messages = isExtended
        ? [
            { delay: 0, value: { type: "progress", event: { type: "extended_started", sequence: 1, elapsedMs: 0 } } },
            { delay: 80, value: { type: "progress", event: { type: "extended_section_started", section: "details", sequence: 2, elapsedMs: 80 } } },
            { delay: 350, value: { type: "complete", result: extendedResult } },
          ]
        : [
            { delay: 0, value: { type: "progress", event: { type: "source_acquired", sourceId: "program", title: "Current program page", url: "https://two-stage.example/program", sequence: 1, elapsedMs: 0 } } },
            { delay: 40, value: { type: "progress", event: { type: "normal_model_started", sequence: 2, elapsedMs: 40 } } },
            { delay: 120, value: { type: "complete", result: normalResult } },
          ];
      return new Response(new ReadableStream({
        start(controller) {
          for (const message of messages) window.setTimeout(() => {
            controller.enqueue(encoder.encode(`${JSON.stringify(message.value)}\n`));
            if (message === messages.at(-1)) controller.close();
          }, message.delay);
        },
      }), { headers: { "Content-Type": "application/x-ndjson" } });
    };
  }, { normalResult: normal, extendedResult: extended });

  await page.goto("/analyze");
  await page.getByLabel("Public opportunity URL").fill("https://two-stage.example/program");
  await page.getByRole("button", { name: "Analyze", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your opportunity overview is ready." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Two-Stage Research Draft" })).toBeVisible();
  await expect(page.locator(".attention-item")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Download summary PDF" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download Full Evidence PDF" })).toHaveCount(0);

  await page.getByRole("button", { name: "Extended Research", exact: true }).click();
  await expect(page.getByText("Your overview remains available while additional details are researched and validated.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Two-Stage Research Draft" })).toBeVisible();
  await expect(page.getByText("Reviewing terms, relationships, and pathways")).toBeVisible();
  await expect(page.getByText("Extended Research complete", { exact: true })).toBeVisible();
  await expect(page.locator(".attention-item")).toHaveCount(5);
  await expect(page.getByRole("button", { name: "Download Full Evidence PDF" })).toBeVisible();
  await expect(page.getByText("Full Record", { exact: true })).toBeVisible();
  const bodies = await page.evaluate(() => (window as typeof window & { __submittedBodies?: unknown[] }).__submittedBodies ?? []);
  submittedBodies.push(...bodies);
  expect(submittedBodies).toEqual([
    { mode: "url", url: "https://two-stage.example/program" },
    { sessionId: "session-two-stage" },
  ]);
  await expectNoPageOverflow(page);
  await expectNoSeriousOrCriticalViolations(page);
});

test("normal analysis renders a finished result without pretending all 59 fields were assessed", async ({ page }) => {
  const card = await automatedCard();
  const compact = {
    ...result(card, "normal"),
    research: {
      depth: "normal",
      extendedAvailable: true,
      sessionId: "compact-session",
      assessedFieldIds: ["opportunity_name", "application_deadline", "tuition", "financial_aid"],
    },
  };
  await page.route("**/api/analyze**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ configured: true }) });
      return;
    }
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(compact) });
  });
  await page.goto("/analyze");
  await page.getByLabel("Public opportunity URL").fill("https://two-stage.example/program");
  await page.getByRole("button", { name: "Analyze", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your opportunity overview is ready." })).toBeVisible();
  await expect(page.locator(".glance-fact")).toHaveCount(3);
  await expect(page.locator(".glance-fact").filter({ hasText: "Who can apply" })).toHaveCount(0);
  await expect(page.getByText("Not assessed by normal analysis", { exact: false })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Extended Research", exact: true })).toBeVisible();
});

test("Extended Research cancellation preserves the successful overview", async ({ page }) => {
  const card = await automatedCard();
  await page.route("**/api/analyze**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ configured: true }) });
      return;
    }
    if (route.request().url().endsWith("/extended")) {
      await new Promise((resolve) => setTimeout(resolve, 5_000));
      await route.fulfill({ contentType: "application/json", body: "{}" }).catch(() => undefined);
      return;
    }
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(result(card, "normal")) });
  });
  await page.goto("/analyze");
  await page.getByLabel("Public opportunity URL").fill("https://two-stage.example/program");
  await page.getByRole("button", { name: "Analyze", exact: true }).click();
  await page.getByRole("button", { name: "Extended Research", exact: true }).click();
  await page.getByRole("button", { name: "Cancel Extended Research" }).click();
  await expect(page.getByText("Extended Research was cancelled. Your original overview is unchanged.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Two-Stage Research Draft" })).toBeVisible();
});

test("Extended Research provider failure preserves the successful overview", async ({ page }) => {
  const card = await automatedCard();
  await page.route("**/api/analyze**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ configured: true }) });
      return;
    }
    if (route.request().url().endsWith("/extended")) {
      await route.fulfill({
        contentType: "application/x-ndjson",
        body: `${JSON.stringify({ type: "error", code: "EXTRACTION_FAILED", message: "The provider could not complete Extended Research." })}\n`,
      });
      return;
    }
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(result(card, "normal")) });
  });
  await page.goto("/analyze");
  await page.getByLabel("Public opportunity URL").fill("https://two-stage.example/program");
  await page.getByRole("button", { name: "Analyze", exact: true }).click();
  await page.getByRole("button", { name: "Extended Research", exact: true }).click();
  await expect(page.getByText("The provider could not complete Extended Research.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Two-Stage Research Draft" })).toBeVisible();
  await expect(page.getByText("Overview ready · Automated checks applied")).toBeVisible();
});

test("safe partial Extended Research retains completed sections and the original overview", async ({ page }) => {
  const card = await automatedCard();
  const partial = {
    ...result(card, "extended"),
    research: {
      depth: "extended",
      extendedAvailable: false,
      sessionId: null,
      completedSections: ["details"],
      failedSections: ["financial"],
      reused: true,
    },
  };
  await page.route("**/api/analyze**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ configured: true }) });
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(route.request().url().endsWith("/extended") ? partial : result(card, "normal")),
    });
  });
  await page.goto("/analyze");
  await page.getByLabel("Public opportunity URL").fill("https://two-stage.example/program");
  await page.getByRole("button", { name: "Analyze", exact: true }).click();
  await page.getByRole("button", { name: "Extended Research", exact: true }).click();
  await expect(page.getByText("Extended Research completed with some sections unavailable.", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Two-Stage Research Draft" })).toBeVisible();
  await expect(page.getByText("Full Record", { exact: true })).toBeVisible();
});

test("incomplete result override is explicit, persistent, and performs no new analysis", async ({ page }) => {
  const card = await automatedCard();
  let posts = 0;
  await page.route("**/api/analyze**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ configured: true, failureSuppression: { bypass: false, allowLocalSuppression: true } }) });
      return;
    }
    posts += 1;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        kind: "quality_failure",
        cached: false,
        cacheEligible: true,
        failureSuppression: { bypass: false, allowLocalSuppression: true },
        incompleteResult: result(card, "normal"),
        quality: {
          reasons: [{ title: "Too little source-backed information", explanation: "The available page did not support enough practical facts." }],
          expiresAt: "2099-09-03T12:00:00.000Z",
        },
      }),
    });
  });
  await page.goto("/analyze");
  await page.getByLabel("Public opportunity URL").fill("https://minefield.example/program");
  await page.getByRole("button", { name: "Analyze", exact: true }).click();
  await expect(page.locator(".analysis-result")).toHaveCount(0);
  await page.getByRole("button", { name: "View incomplete result anyway" }).click();
  await expect(page.getByRole("heading", { name: "Before you open this unfinished draft" })).toBeVisible();
  await page.getByRole("button", { name: "View incomplete result", exact: true }).click();
  await expect(page.getByText("Incomplete result · quality gate overridden")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Two-Stage Research Draft" })).toBeVisible();
  expect(posts).toBe(1);
  await expectNoPageOverflow(page);
  await expectNoSeriousOrCriticalViolations(page);
});

test("server bypass authority clears stale local suppression without changing the analysis request", async ({ page }) => {
  const card = await automatedCard();
  const canonical = "https://bypass.example/program";
  let posts = 0;
  let submittedBody: unknown;
  await page.addInitScript(({ key, stored }) => localStorage.setItem(key, JSON.stringify(stored)), {
    key: `opportunity-facts:quality-failure:${ANALYZER_VERSION}:${canonical}`,
    stored: {
      reasons: [{ title: "Old failure", explanation: "A stale browser record." }],
      expiresAt: "2099-09-03T12:00:00.000Z",
      cached: true,
      cacheEligible: true,
      allowLocalSuppression: true,
      result: result(card, "normal"),
    },
  });
  await page.route("**/api/analyze**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ configured: true, failureSuppression: { bypass: true, allowLocalSuppression: false } }) });
      return;
    }
    posts += 1;
    submittedBody = route.request().postDataJSON();
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(result(card, "normal")) });
  });
  await page.route("**/api/analyze/suppression", async (route) => {
    expect(route.request().postDataJSON()).toEqual({ mode: "url", url: canonical });
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ failureSuppression: { bypass: true, allowLocalSuppression: false } }),
    });
  });
  await page.goto("/analyze");
  await page.getByLabel("Public opportunity URL").fill(canonical);
  await page.getByRole("button", { name: "Analyze", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your opportunity overview is ready." })).toBeVisible();
  expect(posts).toBe(1);
  expect(submittedBody).toEqual({ mode: "url", url: canonical });
  const storageValue = await page.evaluate((key) => localStorage.getItem(key), `opportunity-facts:quality-failure:${ANALYZER_VERSION}:${canonical}`);
  expect(storageValue).toBeNull();
});

test("competition-facing navigation hides batch analysis when the flag is disabled", async ({ page }) => {
  await page.goto("/analyze");
  await expect(page.getByRole("link", { name: /Batch analyze/i })).toHaveCount(0);
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Batch analyze/i })).toHaveCount(0);
});
