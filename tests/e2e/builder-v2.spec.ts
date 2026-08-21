import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { FIELD_IDS } from "../../lib/opportunity/fields";
import {
  opportunityCardSchema,
  v1OpportunityCardSchema,
  type OpportunityCard,
  type V1OpportunityCard,
} from "../../lib/opportunity/schema";
import { expect, expectNoPageOverflow, test } from "./support";

const builderCardKey = "opportunity-facts:builder:v1";
const builderTouchedKey = "opportunity-facts:builder-touched:v1";

async function repositoryCard(path: string) {
  return opportunityCardSchema.parse(
    JSON.parse(await readFile(join(process.cwd(), path), "utf8")) as unknown,
  );
}

function legacyFixture(card: OpportunityCard): V1OpportunityCard {
  const migratedFrom = card.migratedFrom;
  if (migratedFrom === null) throw new Error("The fixture must retain V1 migration metadata.");
  return v1OpportunityCardSchema.parse({
    schemaVersion: "1.0.0",
    cardVersion: migratedFrom.cardVersion,
    slug: card.slug,
    summary: card.summary,
    reviewState: card.reviewState,
    reviewedAt: migratedFrom.reviewedAt,
    sourcePagesChecked: card.sourcePagesChecked,
    conflicts: card.conflicts,
    facts: Object.fromEntries(
      FIELD_IDS.map((fieldId) => [
        fieldId,
        { ...card.facts[fieldId], projection: null },
      ]),
    ),
  });
}

function task(page: Parameters<typeof expectNoPageOverflow>[0], title: string) {
  return page.locator("details.structured-builder-task").filter({
    has: page.locator("summary strong", { hasText: title }),
  });
}

async function openTask(page: Parameters<typeof expectNoPageOverflow>[0], title: string) {
  const section = task(page, title);
  if (!(await section.evaluate((element) => element.hasAttribute("open")))) {
    await section.locator(":scope > summary").click();
  }
  await expect(section).toHaveAttribute("open", "");
  return section;
}

async function addCheckedPage(page: Parameters<typeof expectNoPageOverflow>[0]) {
  await page.getByLabel("Page URL", { exact: true }).fill("https://builder-v2.example/program");
  await page.getByLabel("Page title", { exact: true }).fill("Builder V2 source");
  await page.getByRole("button", { name: "Add checked page" }).click();
  await expect(page.getByRole("status")).toContainText("Checked source page added");
}

test("the public builder cannot issue a Human reviewed attestation", async ({ page }) => {
  await page.goto("/build");
  await expect(page.getByRole("option", { name: "Human reviewed" })).toHaveCount(0);
  await expect(page.getByText(/Human reviewed is issued only through the local repository review workflow/i)).toBeVisible();
  await page.locator("#builder-review-state").evaluate((select) => {
    const option = document.createElement("option");
    option.value = "human_reviewed";
    option.textContent = "Human reviewed";
    select.append(option);
    (select as HTMLSelectElement).value = "human_reviewed";
  });
  await page.getByRole("button", { name: "Save card metadata" }).click();
  await expect(page.locator(".error-summary")).toContainText(/only by the local repository review workflow/i);
});

test("mapped summaries are read-only and a structured change autosaves its projection", async ({ page }) => {
  await page.goto("/build");
  await addCheckedPage(page);

  const cycle = await openTask(page, "Cycle identity");
  await cycle.getByLabel("Cycle label").fill("Fall 2027");
  await cycle.getByLabel("Current status").selectOption("announced");
  await cycle.getByLabel("Cycle type").selectOption("cohort");
  const cycleEvidence = cycle.getByRole("group", { name: "Cycle label evidence" });
  await cycleEvidence.getByLabel("Checked source page").selectOption({ index: 1 });
  await cycleEvidence.getByLabel("Exact excerpt supporting every value entered above").fill(
    "The Fall 2027 cohort has been announced.",
  );
  await cycle.getByRole("button", { name: "Add cycle identity" }).click();
  await expect(page.getByRole("status")).toContainText("Cycle identity added");

  const organizations = await openTask(page, "Organizations and relationships");
  const organizationForm = organizations.locator("form").filter({
    has: page.getByRole("button", { name: "Add organization and role" }),
  });
  await organizationForm.getByLabel("Organization", { exact: true }).fill("Builder Research Lab");
  await organizationForm.getByLabel("Organization type").selectOption("education_provider");
  await organizationForm.getByLabel("Role", { exact: true }).selectOption("operator");
  const organizationEvidence = organizationForm.getByRole("group", { name: "Organization name evidence" });
  await organizationEvidence.getByLabel("Checked source page").selectOption({ index: 1 });
  await organizationEvidence.getByLabel("Exact excerpt supporting every value entered above").fill(
    "Builder Research Lab operates the Fall 2027 program.",
  );
  await organizationForm.getByRole("button", { name: "Add organization and role" }).click();
  await expect(page.getByRole("status")).toContainText("Organization and role added");

  const stored = opportunityCardSchema.parse(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null") as unknown, builderCardKey),
  );
  expect(stored.organizations.status).toBe("modeled");
  expect(stored.facts.operating_organization).toMatchObject({
    status: "disclosed",
    displayValue: "Builder Research Lab",
    projection: { schemaVersion: "2.2.0" },
  });

  const projectedEditor = page.locator(".projected-fact-editor").filter({
    has: page.getByRole("heading", { name: /Operating organization/ }),
  });
  await expect(projectedEditor.getByText("Read-only summary.")).toBeVisible();
  await expect(projectedEditor.locator("input, textarea, select")).toHaveCount(0);

  await page.reload();
  await expect(page.locator(".builder-preview")).toContainText("Builder Research Lab");
  const reloaded = opportunityCardSchema.parse(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null") as unknown, builderCardKey),
  );
  expect(reloaded.facts.operating_organization.displayValue).toBe("Builder Research Lab");
});

test("a V1 import migrates deterministically but remains blocked on structured review", async ({ page }) => {
  const demo = await repositoryCard("data/demo/lantern-bay-robotics-field-lab.json");
  const legacy = legacyFixture(demo);
  await page.goto("/build");
  await page.locator("#builder-import").setInputFiles({
    name: "legacy-card.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(legacy)),
  });

  await expect(page.getByRole("status")).toContainText(
    `Schema v1 card migrated to draft schema v2 revision ${legacy.cardVersion + 1}`,
  );
  const migrated = opportunityCardSchema.parse(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null") as unknown, builderCardKey),
  );
  expect(migrated).toMatchObject({
    schemaVersion: "2.2.0",
    cardVersion: legacy.cardVersion + 1,
    reviewState: "draft",
    reviewedAt: null,
    opportunityId: null,
    cycle: { status: "unassessed" },
    organizations: { status: "unassessed" },
  });
  expect(migrated.facts.opportunity_name.displayValue).toBe(
    legacy.facts.opportunity_name.displayValue,
  );
  await expect(page.getByRole("button", { name: "Export JSON" })).toBeDisabled();

  await page.getByLabel("Review state").selectOption("ai_audited");
  await page.getByRole("button", { name: "Save card metadata" }).click();
  await expect(page.locator(".error-summary")).toContainText("every field and structured section to be explicitly assessed");
});

test("absence assessments clear incompatible migrated summary values", async ({ page }) => {
  const demo = await repositoryCard("data/demo/lantern-bay-robotics-field-lab.json");
  const legacy = legacyFixture(demo);
  expect(legacy.facts.operating_organization.status).toBe("disclosed");
  await page.goto("/build");
  await page.locator("#builder-import").setInputFiles({
    name: "legacy-card.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(legacy)),
  });

  const organizations = await openTask(page, "Organizations and relationships");
  await organizations.getByRole("button", { name: "Reviewed: none found" }).first().click();
  await organizations.getByRole("button", { name: "Reviewed: none found" }).first().click();

  const stored = opportunityCardSchema.parse(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null") as unknown, builderCardKey),
  );
  expect(stored.organizations.status).toBe("none_found");
  expect(stored.organizationRoles.status).toBe("none_found");
  expect(stored.facts.operating_organization.status).toBe("not_found");
  expect(stored.facts.operating_organization.displayValue).toBeNull();
});

test("a populated real V2 card autosaves, survives reload, and remains usable at mobile width", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Mobile builder audit");
  const diamond = await repositoryCard("data/opportunities/diamond-challenge-2027.json");
  await page.goto("/build");
  await page.locator("#builder-import").setInputFiles({
    name: "diamond-challenge-2027.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(diamond)),
  });

  await expect(page.getByRole("status")).toContainText(
    `Attested card imported as draft revision ${diamond.cardVersion + 1}`,
  );
  const stored = opportunityCardSchema.parse(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null") as unknown, builderCardKey),
  );
  expect(stored.reviewState).toBe("draft");
  expect(stored.reviewedAt).toBeNull();
  expect(stored.cardVersion).toBe(diamond.cardVersion + 1);
  expect(stored.outcomes.status).toBe("modeled");
  if (stored.outcomes.status === "modeled") expect(stored.outcomes.records).toHaveLength(9);
  expect(JSON.parse(await page.evaluate((key) => localStorage.getItem(key) ?? "[]", builderTouchedKey))).toHaveLength(FIELD_IDS.length);
  await expect(page.getByRole("button", { name: "Export JSON" })).toBeEnabled();

  const outcomes = await openTask(page, "Outcomes and prizes");
  await expect(outcomes.getByText("Business Innovation 1st place", { exact: true })).toBeVisible();
  await outcomes.locator("li", { hasText: "Business Innovation 1st place" }).getByRole("button", { name: "Edit" }).click();
  await expect(outcomes.locator(".structured-retained-note")).toContainText("additional atomic entry is retained unchanged");
  await expectNoPageOverflow(page);
  await outcomes.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toContainText("Outcome updated");
  const afterOutcomeEdit = opportunityCardSchema.parse(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null") as unknown, builderCardKey),
  );
  if (afterOutcomeEdit.outcomes.status !== "modeled") throw new Error("Expected modeled outcomes after edit.");
  const editedPrize = afterOutcomeEdit.outcomes.records.find((outcome) => outcome.definition.value.label === "Business Innovation 1st place");
  expect(editedPrize?.distribution?.status).toBe("disclosed");
  if (editedPrize?.distribution?.status === "disclosed") expect(editedPrize.distribution.value).toHaveLength(2);

  await page.reload();
  await expect(page.locator(".builder-preview")).toContainText("Diamond Challenge");
  await expectNoPageOverflow(page);

  await page.getByLabel("Review state").selectOption("ai_audited");
  await page.getByRole("button", { name: "Save card metadata" }).click();
  const reviewed = opportunityCardSchema.parse(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null") as unknown, builderCardKey),
  );
  expect(reviewed.reviewState).toBe("ai_audited");
  expect(reviewed.reviewedAt).not.toBeNull();
});

test("cost and outcome authoring preserves distinct financial semantics and supports replacement", async ({ page }) => {
  await page.goto("/build");
  await addCheckedPage(page);

  const costs = await openTask(page, "Costs and aid");
  const costForm = costs.locator("form").filter({ has: page.getByRole("button", { name: "Add cost item" }) });
  await costForm.getByLabel("Cost label").fill("Research program tuition");
  await costForm.getByLabel("Type", { exact: true }).selectOption("tuition");
  await costForm.getByLabel("Requirement").selectOption("conditional");
  await costForm.getByLabel("Reviewed inventory").selectOption("incomplete");
  await costForm.getByLabel("Amount status").selectOption("range");
  await costForm.getByLabel("Amount or range minimum").fill("2990");
  await costForm.getByLabel("Range maximum").fill("6490");
  await costForm.getByLabel("Refund status").selectOption("conditional");
  await costForm.getByLabel("Refund condition (only when stated)").fill("Refund eligibility depends on the withdrawal date.");
  await costForm.getByLabel("General condition (optional)").fill("Tuition varies by program tier.");
  await costForm.getByLabel("Included item (optional)").fill("Individual research mentorship");
  await costForm.getByLabel("Excluded item (optional)").fill("Optional college-credit fee");
  const costDefinitionEvidence = costForm.getByRole("group", { name: "Cost definition evidence" });
  await costDefinitionEvidence.getByLabel("Checked source page").selectOption({ index: 1 });
  await costDefinitionEvidence.getByLabel("Exact excerpt supporting every value entered above").fill("The program offers several tuition tiers.");
  await costForm.getByText("Use different evidence for amount").click();
  const amountEvidence = costForm.getByRole("group", { name: "Amount evidence" });
  await amountEvidence.getByLabel("Checked source page").selectOption({ index: 1 });
  await amountEvidence.getByLabel("Exact excerpt supporting every value entered above").fill("Tuition ranges from $2,990 to $6,490.");
  await costForm.getByRole("button", { name: "Add cost item" }).click();
  await expect(page.getByRole("status")).toContainText("Cost item added");

  let stored = opportunityCardSchema.parse(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null") as unknown, builderCardKey),
  );
  expect(stored.costItems.status).toBe("modeled");
  if (stored.costItems.status !== "modeled") throw new Error("Expected modeled cost items.");
  expect(stored.costItems.completeness).toBe("incomplete");
  expect(stored.costItems.records).toHaveLength(1);
  const originalCostId = stored.costItems.records[0].id;
  expect(stored.costItems.records[0]).toMatchObject({
    amount: { status: "disclosed", value: { kind: "range", minimum: 2990, maximum: 6490 } },
    refundability: { status: "disclosed", value: { kind: "conditional", condition: "Refund eligibility depends on the withdrawal date." } },
    includedItems: [{ value: "Individual research mentorship" }],
    excludedItems: [{ value: "Optional college-credit fee" }],
    conditions: [{ value: "Tuition varies by program tier." }],
  });
  expect(stored.costItems.records[0].amount.sources[0].excerpt).toBe("Tuition ranges from $2,990 to $6,490.");
  expect(stored.costItems.records[0].definition.sources[0].excerpt).toBe("The program offers several tuition tiers.");

  await costs.locator("li", { hasText: "Research program tuition" }).getByRole("button", { name: "Edit" }).click();
  const editCostForm = costs.locator("form").filter({ has: page.getByRole("button", { name: "Save changes" }) });
  await editCostForm.getByLabel("Excluded item (optional)").fill("Travel is not included");
  await editCostForm.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toContainText("Cost item updated");
  stored = opportunityCardSchema.parse(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null") as unknown, builderCardKey),
  );
  if (stored.costItems.status !== "modeled") throw new Error("Expected modeled cost items.");
  expect(stored.costItems.records).toHaveLength(1);
  expect(stored.costItems.records[0].id).toBe(originalCostId);
  expect(stored.costItems.records[0].excludedItems[0].value).toBe("Travel is not included");

  const outcomes = await openTask(page, "Outcomes and prizes");
  const outcomeForm = outcomes.locator("form").filter({ has: page.getByRole("button", { name: "Add outcome" }) });
  await outcomeForm.getByLabel("Outcome label").fill("Experiment build budget");
  await outcomeForm.getByLabel("Outcome type").selectOption("project_budget");
  await outcomeForm.getByLabel("Amount", { exact: true }).selectOption("exact");
  await outcomeForm.getByLabel("Amount or range minimum").fill("1500");
  await outcomeForm.getByLabel("Use restriction (required for project funding)").fill("Funds may only be used to build the selected experiment.");
  await outcomeForm.getByLabel("Quantity minimum (optional)").fill("1");
  await outcomeForm.getByLabel("Quantity unit").selectOption("items");
  await outcomeForm.getByLabel("General award condition (optional)").fill("Available only to selected teams.");
  const outcomeDefinitionEvidence = outcomeForm.getByRole("group", { name: "Outcome definition evidence" });
  await outcomeDefinitionEvidence.getByLabel("Checked source page").selectOption({ index: 1 });
  await outcomeDefinitionEvidence.getByLabel("Exact excerpt supporting every value entered above").fill("Selected teams receive funding to build an experiment.");
  await outcomeForm.getByRole("button", { name: "Add outcome" }).click();
  await expect(page.getByRole("status")).toContainText("Outcome added");

  stored = opportunityCardSchema.parse(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null") as unknown, builderCardKey),
  );
  expect(stored.outcomes.status).toBe("modeled");
  if (stored.outcomes.status !== "modeled") throw new Error("Expected modeled outcomes.");
  expect(stored.outcomes.records[0]).toMatchObject({
    definition: { value: { outcomeType: "project_budget" } },
    recipientScope: { status: "disclosed", value: "project" },
    monetaryNature: { status: "disclosed", value: "restricted_funding" },
    amount: { status: "disclosed", value: { kind: "exact", amount: 1500 } },
    quantity: { status: "disclosed", value: { minimum: 1, unit: "items" } },
    useRestriction: { status: "disclosed", value: "Funds may only be used to build the selected experiment." },
    conditions: [{ value: "Available only to selected teams." }],
  });
  expect(stored.facts.cash_award.status).toBe("not_found");
  await expectNoPageOverflow(page);
});

test("stage and pathway authoring keeps month precision and per-step branch conditions", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Focused desktop process authoring regression");
  await page.goto("/build");
  await addCheckedPage(page);
  const process = await openTask(page, "Schedule and process");
  const stageForm = process.locator("form").filter({ has: page.getByRole("button", { name: "Add stage" }) });
  await stageForm.getByLabel("Stage label").fill("Live pitch");
  await stageForm.getByLabel("Kind").selectOption("pitch");
  await stageForm.getByLabel("Date meaning (optional)").selectOption("starts");
  await stageForm.getByLabel("Date precision").selectOption("month");
  await stageForm.getByLabel("Month").fill("2027-03");
  await stageForm.getByLabel("Date certainty").selectOption("expected");
  await stageForm.getByLabel("Duration minimum (optional)").fill("1");
  await stageForm.getByLabel("Duration unit").selectOption("days");
  await stageForm.getByLabel("Minimum hours (optional)").fill("2");
  await stageForm.getByLabel("Maximum hours (optional)").fill("3");
  await stageForm.getByLabel("Hours per").selectOption("total");
  await stageForm.getByLabel("Source-stated commitment label").fill("2–3 hours total");
  await stageForm.getByLabel("Selection rule (optional)").fill("Judges select advancing teams after the pitch.");
  await stageForm.getByLabel("Advancement count (optional)").fill("14");
  await stageForm.getByLabel("Advancement description").fill("14 finalist teams advance.");
  await stageForm.getByLabel("Participant requirement (optional)").fill("The adult adviser must attend.");
  await stageForm.getByLabel("Travel/attendance requirement").selectOption("required");
  const stageEvidence = stageForm.getByRole("group", { name: "Stage definition evidence" });
  await stageEvidence.getByLabel("Checked source page").selectOption({ index: 1 });
  await stageEvidence.getByLabel("Exact excerpt supporting every value entered above").fill("Teams pitch live in March 2027 before judges select 14 finalists.");
  await stageForm.getByRole("button", { name: "Add stage" }).click();
  await expect(page.getByRole("status")).toContainText("Process stage added");

  let stored = opportunityCardSchema.parse(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null") as unknown, builderCardKey),
  );
  expect(stored.stages.status).toBe("modeled");
  if (stored.stages.status !== "modeled") throw new Error("Expected modeled stages.");
  expect(stored.stages.records[0]).toMatchObject({
    timings: [{ value: { event: "starts", when: { precision: "month", year: 2027, month: 3, certainty: "expected" } } }],
    durations: [{ value: { duration: { minimum: 1, unit: "days" } } }],
    timeCommitments: [{ value: { minimumHours: 2, maximumHours: 3, period: "total" } }],
    advancement: [{ value: { count: 14 } }],
    travelRequirements: [{ value: { requirement: "required" } }],
  });

  await stageForm.getByLabel("Stage label").fill("Final summit");
  await stageForm.getByLabel("Kind").selectOption("summit_final");
  await stageForm.getByLabel("Order").fill("2");
  await stageForm.getByLabel("Date meaning (optional)").selectOption("");
  await stageForm.getByLabel("Date precision").selectOption("none");
  await stageForm.getByLabel("Month").fill("");
  await stageForm.getByLabel("Duration minimum (optional)").fill("");
  await stageForm.getByLabel("Minimum hours (optional)").fill("");
  await stageForm.getByLabel("Maximum hours (optional)").fill("");
  await stageForm.getByLabel("Source-stated commitment label").fill("");
  await stageForm.getByLabel("Selection rule (optional)").fill("");
  await stageForm.getByLabel("Advancement count (optional)").fill("");
  await stageForm.getByLabel("Advancement description").fill("");
  await stageForm.getByLabel("Participant requirement (optional)").fill("");
  await stageForm.getByLabel("Travel/attendance requirement").selectOption("");
  await stageEvidence.getByLabel("Checked source page").selectOption({ index: 1 });
  await stageEvidence.getByLabel("Exact excerpt supporting every value entered above").fill("Finalists attend the final summit.");
  await stageForm.getByRole("button", { name: "Add stage" }).click();
  await expect(page.getByRole("status")).toContainText("Process stage added");

  const pathwayForm = process.locator("form").filter({ has: page.getByRole("button", { name: "Add pathway" }) });
  await pathwayForm.getByLabel("Pathway label").fill("Live pitch pathway");
  const pitchStep = pathwayForm.locator(".structured-pathway-step-editor", { hasText: "Live pitch" });
  const summitStep = pathwayForm.locator(".structured-pathway-step-editor", { hasText: "Final summit" });
  await pitchStep.getByRole("checkbox").check();
  await summitStep.getByRole("checkbox").check();
  await summitStep.getByLabel("Entry/advancement condition (optional)").fill("Advance after finalist selection.");
  const pathwayEvidence = pathwayForm.getByRole("group", { name: "Pathway definition evidence" });
  await pathwayEvidence.getByLabel("Checked source page").selectOption({ index: 1 });
  await pathwayEvidence.getByLabel("Exact excerpt supporting every value entered above").fill("Selected finalists advance from live pitch to the final summit.");
  await pathwayForm.getByRole("button", { name: "Add pathway" }).click();
  await expect(page.getByRole("status")).toContainText("Selection pathway added");
  stored = opportunityCardSchema.parse(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null") as unknown, builderCardKey),
  );
  expect(stored.pathways.status).toBe("modeled");
  if (stored.pathways.status !== "modeled") throw new Error("Expected modeled pathways.");
  expect(stored.pathways.records[0].steps).toHaveLength(2);
  expect(stored.pathways.records[0].steps[1].value.enterWhen).toBe("Advance after finalist selection.");
});

test("a source-scope change invalidates publication and autosaves the assessment reset", async ({ page }) => {
  const diamond = await repositoryCard("data/opportunities/diamond-challenge-2027.json");
  await page.goto("/build");
  await page.locator("#builder-import").setInputFiles({
    name: "diamond-challenge-2027.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(diamond)),
  });
  await expect(page.getByRole("button", { name: "Export JSON" })).toBeEnabled();

  await addCheckedPage(page);
  await expect(page.getByRole("button", { name: "Export JSON" })).toBeDisabled();
  expect(await page.evaluate((key) => localStorage.getItem(key), builderTouchedKey)).toBe("[]");
  const stored = opportunityCardSchema.parse(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null") as unknown, builderCardKey),
  );
  expect(stored.reviewState).toBe("draft");
  expect(stored.sourcePagesChecked.some((source) => source.url === "https://builder-v2.example/program")).toBe(true);

  await page.getByLabel("Review state").selectOption("ai_audited");
  await page.getByRole("button", { name: "Save card metadata" }).click();
  await expect(page.locator(".error-summary")).toContainText("every field and structured section to be explicitly assessed");
});
