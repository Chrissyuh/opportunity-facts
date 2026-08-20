import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { opportunityCardSchema, type OpportunityCard } from "@/lib/opportunity/schema";
import { expect, expectNoPageOverflow, test } from "./support";

async function automatedCard(): Promise<OpportunityCard> {
  const source = opportunityCardSchema.parse(JSON.parse(await readFile(
    join(process.cwd(), "data/demo/lantern-bay-robotics-field-lab.json"),
    "utf8",
  )) as unknown);
  return opportunityCardSchema.parse({
    ...source,
    cardVersion: source.cardVersion + 1,
    slug: "streamed-student-research-draft",
    summary: "A deterministic browser fixture for the student research experience.",
    reviewState: "automated_draft",
    reviewedAt: null,
    facts: {
      ...source.facts,
      opportunity_name: {
        ...source.facts.opportunity_name,
        value: "Streamed Student Research Draft",
        displayValue: "Streamed Student Research Draft",
      },
    },
  });
}

function analysisResult(card: OpportunityCard) {
  return {
    kind: "card",
    card,
    reviewedPages: [{
      id: "program",
      url: "https://streamed.example/program",
      title: "Current program page",
      pageType: "user_supplied",
      accessedAt: "2026-08-20T12:00:00.000Z",
      truncated: false,
      truncatedForModel: false,
      contentUnavailable: false,
    }],
    pageWarnings: [],
    evidenceWarnings: [],
    attentionItems: [{
      id: "cost-needs-checking",
      category: "cost",
      priority: "high",
      title: "Total cost needs checking",
      explanation: "The retained record does not establish one complete mandatory total.",
      fieldIds: ["estimated_total_mandatory_cost"],
      claimIds: [],
      sourceIds: [],
      suggestedNextStep: "Review every required fee before budgeting.",
      origin: "deterministic_fallback",
    }],
  };
}

test("streamed research shows only observable work and validated preview facts", async ({ page }) => {
  const card = await automatedCard();
  const result = analysisResult(card);
  await page.addInitScript(({ completedResult }) => {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const requestUrl = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (!requestUrl.endsWith("/api/analyze")) return nativeFetch(input, init);
      const method = init?.method ?? (input instanceof Request ? input.method : "GET");
      if (method === "GET") {
        return new Response(JSON.stringify({ configured: true, model: "browser-fixture" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      const encoder = new TextEncoder();
      const messages = [
        { delay: 0, value: { type: "progress", event: { type: "accepted", sequence: 1, elapsedMs: 0 } } },
        { delay: 40, value: { type: "progress", event: { type: "source_acquired", sourceId: "program", title: "Current program page", url: "https://streamed.example/program", sequence: 2, elapsedMs: 40 } } },
        { delay: 90, value: { type: "progress", event: { type: "family_started", family: "facts", sequence: 3, elapsedMs: 90 } } },
        { delay: 380, value: { type: "progress", event: { type: "validated_fact", fieldId: "tuition", label: "Tuition", displayValue: "$450", evidenceCount: 1, sequence: 4, elapsedMs: 380 } } },
        { delay: 760, value: { type: "complete", result: completedResult } },
      ];
      return new Response(new ReadableStream({
        start(controller) {
          for (const message of messages) {
            window.setTimeout(() => {
              controller.enqueue(encoder.encode(`${JSON.stringify(message.value)}\n`));
              if (message === messages.at(-1)) controller.close();
            }, message.delay);
          }
        },
      }), { status: 200, headers: { "Content-Type": "application/x-ndjson" } });
    };
  }, { completedResult: result });

  await page.goto("/analyze");
  await page.getByLabel("Public opportunity URL").fill("https://streamed.example/program");
  await page.getByRole("button", { name: "Analyze", exact: true }).click();
  await expect(page.getByText("Current program page reviewed")).toBeVisible();
  await expect(page.getByText("Reviewing facts")).toBeVisible();
  await expect(page.getByText("Tuition: $450")).toBeVisible();
  await expect(page.getByText("Unsupported candidate", { exact: false })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 3, name: "Streamed Student Research Draft" })).toBeVisible();
  await expect(page.locator(".attention-item")).toHaveCount(1);
  await page.locator(".attention-list > .attention-item > summary").click();
  await expect(page.getByText("The retained record does not establish one complete mandatory total.")).toBeVisible();
  await expectNoPageOverflow(page);
});

test("eligible minefield failures suppress cards and block an unchanged same-browser retry", async ({ page }) => {
  let posts = 0;
  await page.route("**/api/analyze", async (route) => {
    if (route.request().method() === "GET") {
        await route.fulfill({ contentType: "application/json", body: JSON.stringify({ configured: true, model: "browser-fixture", failureSuppression: { bypass: false, allowLocalSuppression: true } }) });
      return;
    }
    posts += 1;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        kind: "quality_failure",
        cached: false,
        cacheEligible: true,
        quality: {
          classification: "INSUFFICIENT_SOURCE_QUALITY",
          reasons: [{
            code: "TOO_FEW_SUPPORTED_FACTS",
            title: "Too little source-backed information",
            explanation: "The available page did not support enough practical facts for a reliable overview.",
            priority: "high",
          }],
          createdAt: "2026-08-20T12:00:00.000Z",
          expiresAt: "2099-09-03T12:00:00.000Z",
          analyzerVersion: "student-research-v1",
        },
      }),
    });
  });
  await page.goto("/analyze");
  await page.getByLabel("Public opportunity URL").fill("https://minefield.example/program");
  await page.getByRole("button", { name: "Analyze", exact: true }).click();
  await expect(page.getByRole("heading", { name: "We couldn’t build a reliable Opportunity Facts card from this page." })).toBeVisible();
  await expect(page.getByText("Too little source-backed information")).toBeVisible();
  await expect(page.locator(".analysis-result")).toHaveCount(0);
  await page.getByRole("button", { name: "Try another official page" }).click();
  await page.getByRole("button", { name: "Analyze", exact: true }).click();
  await expect(page.getByText("We already checked this unchanged page.")).toBeVisible();
  expect(posts).toBe(1);
});

test("same-browser cooldown reuses an insufficient result even when durable caching is ineligible", async ({ page }) => {
  let posts = 0;
  await page.route("**/api/analyze", async (route) => {
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
        cacheEligible: false,
        quality: {
          reasons: [{ code: "INSUFFICIENT_SOURCE_COVERAGE", title: "A source was temporarily unavailable", explanation: "Important pages could not be acquired during this attempt.", priority: "high" }],
          expiresAt: "2099-09-03T12:00:00.000Z",
        },
      }),
    });
  });
  await page.goto("/analyze");
  await page.getByLabel("Public opportunity URL").fill("https://temporary.example/program");
  await page.getByRole("button", { name: "Analyze", exact: true }).click();
  await expect(page.getByText("A source was temporarily unavailable")).toBeVisible();
  await page.getByRole("button", { name: "Try another official page" }).click();
  await page.getByRole("button", { name: "Analyze", exact: true }).click();
  await expect(page.getByText("We already checked this unchanged page.")).toBeVisible();
  expect(posts).toBe(1);
});

test("batch analysis limits concurrency, skips a cancelled queue item, and isolates one failure", async ({ page }) => {
  const card = await automatedCard();
  const result = analysisResult(card);
  const urls = [
    "https://one.example/program",
    "https://fail.example/program",
    "https://cancel.example/program",
    "https://four.example/program",
  ];
  let active = 0;
  let maximumActive = 0;
  const analyzed: string[] = [];

  await page.route("**/api/analyze/batch", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ urls, duplicateCount: 0, maximum: 5, concurrency: 2 }),
    });
  });
  await page.route("**/api/analyze", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ configured: true }) });
      return;
    }
    const submitted = JSON.parse(route.request().postData() ?? "{}") as { url?: string };
    const submittedUrl = submitted.url ?? "";
    analyzed.push(submittedUrl);
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    await new Promise((resolve) => setTimeout(resolve, 250));
    active -= 1;
    if (submittedUrl.includes("fail.example")) {
      await route.fulfill({
        contentType: "application/x-ndjson",
        body: `${JSON.stringify({ type: "error", message: "The provider was temporarily unavailable." })}\n`,
      });
      return;
    }
    await route.fulfill({
      contentType: "application/x-ndjson",
      body: `${JSON.stringify({ type: "complete", result })}\n`,
    });
  });

  await page.goto("/analyze/batch");
  await page.getByLabel("Opportunity URLs").fill(urls.join("\n"));
  await page.getByRole("button", { name: "Analyze batch" }).click();
  const cancelled = page.locator(".batch-item").filter({ hasText: "cancel.example" });
  await cancelled.getByRole("button", { name: "Cancel" }).click();

  await expect(cancelled).toHaveAttribute("data-state", "cancelled");
  await expect(page.locator(".batch-item[data-state='ready']")).toHaveCount(2);
  await expect(page.locator(".batch-item[data-state='failed']")).toHaveCount(1);
  expect(maximumActive).toBe(2);
  expect(analyzed).toEqual(expect.arrayContaining([urls[0], urls[1], urls[3]]));
  expect(analyzed).not.toContain(urls[2]);
});
