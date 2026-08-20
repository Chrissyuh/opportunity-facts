import type { CSSProperties } from "react";
import type {
  CostItemRecord,
  EvidenceSource,
  OpportunityCard,
  OutcomeRecord,
  Scope,
  StageRecord,
} from "@/lib/opportunity/schema";
import { EvidenceList } from "./evidence-list";
import { StatusBadge } from "./status-badge";

type StructuredStatus =
  | "disclosed"
  | "not_found"
  | "unclear"
  | "conflicting"
  | "not_applicable";

type DisplayClaim = {
  claimId: string;
  status: StructuredStatus;
  displayValue: string | null;
  note: string | null;
  sources: EvidenceSource[];
  conflictingValues: Array<{
    displayValue: string;
    note: string | null;
    sources: EvidenceSource[];
  }>;
};

const organizationRoleLabels = {
  operator: "Operator",
  manager: "Program manager",
  administrator: "Administrator",
  sponsor: "Sponsor",
  funder: "Funder",
  host: "Host",
  academic_partner: "Academic partner",
  platform_provider: "Platform provider",
  other: "Other role",
} as const;

const relationshipLabels = {
  institution_operated: "Institution operated",
  institution_sponsored: "Institution sponsored",
  institution_partnered: "Institution partnership",
  hosted_at_institution: "Hosted at institution",
  credit_partnership: "Credit partnership",
  founders_affiliated_with: "Founders affiliated with",
  mentors_affiliated_with: "Mentors affiliated with",
  staff_affiliated_with: "Staff affiliated with",
  independent: "Independent",
  unclear: "Relationship unclear",
  other: "Other relationship",
} as const;

const costKindLabels = {
  application_fee: "Application fee",
  deposit: "Deposit",
  tuition: "Tuition",
  travel: "Travel",
  lodging: "Lodging",
  meals: "Meals",
  materials: "Materials",
  other: "Other cost",
} as const;

const requirementLabels = {
  required: "Required",
  optional: "Optional",
  conditional: "Conditional",
} as const;

const outcomeGroups = [
  {
    id: "cash",
    label: "Cash to participant(s)",
    types: ["personal_cash_prize", "team_cash_prize", "stipend"],
  },
  {
    id: "project",
    label: "Project funding and reimbursement",
    types: ["project_budget", "reimbursement"],
  },
  {
    id: "educator",
    label: "Benefits for educators",
    types: ["educator_cash_prize"],
  },
  {
    id: "tuition",
    label: "Tuition and scholarship support",
    types: ["tuition_waiver", "scholarship"],
  },
  {
    id: "in-kind",
    label: "In-kind and other benefits",
    types: [
      "program_seat",
      "travel_support",
      "mentorship",
      "flight_or_experiment_opportunity",
      "certificate",
      "college_credit",
      "equipment",
      "other_in_kind",
      "other",
    ],
  },
] as const;

const outcomeTypeLabels = {
  personal_cash_prize: "Personal cash prize",
  team_cash_prize: "Team cash prize",
  educator_cash_prize: "Educator cash prize",
  stipend: "Stipend",
  project_budget: "Restricted project budget",
  reimbursement: "Reimbursement",
  tuition_waiver: "Tuition waiver",
  scholarship: "Scholarship",
  program_seat: "Program seat",
  travel_support: "Travel support",
  mentorship: "Mentorship",
  flight_or_experiment_opportunity: "Flight or experiment opportunity",
  certificate: "Certificate",
  college_credit: "College credit",
  equipment: "Equipment",
  other_in_kind: "Other in-kind benefit",
  other: "Other outcome",
} as const;

function modeledRecords<T>(collection: { status: string; records: T[] }) {
  return collection.status === "modeled" ? collection.records : [];
}

function claimFallback(claim: DisplayClaim) {
  if (claim.status === "not_found") return "Not found in the sources checked";
  if (claim.status === "not_applicable") return "Does not apply";
  if (claim.status === "unclear") return claim.note ?? "The source wording is unclear";
  if (claim.status === "conflicting") return "Reviewed sources support different values";
  return claim.displayValue ?? "Disclosed value unavailable";
}

function ClaimLine({
  claim,
  label,
  compact = false,
}: {
  claim: DisplayClaim;
  label: string;
  compact?: boolean;
}) {
  return (
    <div className={`structured-claim ${compact ? "structured-claim-compact" : ""}`}>
      <div className="structured-claim-value">
        <StatusBadge status={claim.status} />
        <span>{claimFallback(claim)}</span>
      </div>
      {claim.status === "conflicting" ? (
        <div className="structured-conflicts">
          {claim.conflictingValues.map((candidate, index) => (
            <div key={`${candidate.displayValue}-${index}`}>
              <strong>{candidate.displayValue}</strong>
              {candidate.note ? <p>{candidate.note}</p> : null}
              <EvidenceList
                sources={candidate.sources}
                label={`${label}: evidence for value ${index + 1}`}
              />
            </div>
          ))}
        </div>
      ) : (
        <EvidenceList sources={claim.sources} label={`Evidence for ${label}`} />
      )}
    </div>
  );
}

function AssertionEvidence({
  sources,
  label,
}: {
  sources: EvidenceSource[];
  label: string;
}) {
  return <EvidenceList sources={sources} label={`Evidence for ${label}`} />;
}

function organizationName(card: OpportunityCard, organizationId: string | null) {
  if (organizationId === null) return null;
  return modeledRecords(card.organizations).find((organization) => organization.id === organizationId)
    ?.name.value ?? null;
}

function variantName(card: OpportunityCard, variantId: string) {
  return modeledRecords(card.variants).find((variant) => variant.id === variantId)
    ?.definition.value.label ?? variantId;
}

function stageName(card: OpportunityCard, stageId: string) {
  return modeledRecords(card.stages).find((stage) => stage.id === stageId)
    ?.definition.value.label ?? stageId;
}

function pathwayName(card: OpportunityCard, pathwayId: string) {
  return modeledRecords(card.pathways).find((pathway) => pathway.id === pathwayId)
    ?.definition.value.label ?? pathwayId;
}

function ScopeChips({ card, scope }: { card: OpportunityCard; scope: Scope }) {
  const labels = [
    ...scope.variantIds.map((id) => `Program: ${variantName(card, id)}`),
    ...scope.stageIds.map((id) => `Stage: ${stageName(card, id)}`),
    ...scope.pathwayIds.map((id) => `Path: ${pathwayName(card, id)}`),
  ];
  if (labels.length === 0) return <span className="scope-shared">Shared across programs and paths</span>;
  return (
    <ul className="scope-chips" aria-label="Applies to">
      {labels.map((label) => <li key={label}>{label}</li>)}
    </ul>
  );
}

function collectionMessage(collection: { status: string; note: string | null }, noun: string) {
  if (collection.status === "unassessed") return `${noun} have not been modeled for this card.`;
  if (collection.status === "not_applicable") return collection.note ?? `${noun} do not apply.`;
  if (collection.status === "none_found") return collection.note ?? `No ${noun.toLowerCase()} were found in the reviewed sources.`;
  return null;
}

function CollectionNote({ note }: { note: string | null }) {
  return note ? <p className="structured-collection-note">{note}</p> : null;
}

export function OrganizationRelationshipPanel({ card }: { card: OpportunityCard }) {
  const organizations = modeledRecords(card.organizations);
  const roles = modeledRecords(card.organizationRoles);
  const relationships = modeledRecords(card.institutionRelationships);
  const emptyMessage = collectionMessage(card.organizationRoles, "Organization roles");

  return (
    <div className="structured-panel-body">
      <CollectionNote note={card.organizations.note} />
      <CollectionNote note={card.organizationRoles.note} />
      {roles.length ? (
        <dl className="organization-role-ledger">
          {roles.map((role) => {
            const organization = organizations.find((candidate) => candidate.id === role.organizationId);
            const label = role.role.value.roleLabel ?? organizationRoleLabels[role.role.value.role];
            return (
              <div key={role.id}>
                <dt>{label}</dt>
                <dd>
                  <strong>{organization?.name.value ?? role.organizationId}</strong>
                  <ScopeChips card={card} scope={role.role.value.scope} />
                  {organization ? (
                    <AssertionEvidence sources={organization.name.sources} label={`${organization.name.value} name`} />
                  ) : null}
                  <AssertionEvidence sources={role.role.sources} label={`${label} role`} />
                </dd>
              </div>
            );
          })}
        </dl>
      ) : emptyMessage ? <p className="structured-empty">{emptyMessage}</p> : null}

      {relationships.length ? (
        <div className="institution-relationships">
          <h4>Institution relationships</h4>
          <CollectionNote note={card.institutionRelationships.note} />
          <ul>
            {relationships.map((relationship) => {
              const assertion = relationship.assertion;
              if (assertion.status !== "disclosed") {
                return <li key={relationship.id}><ClaimLine claim={assertion} label="institution relationship" /></li>;
              }
              const value = assertion.value;
              const target = organizationName(card, value.targetOrganizationId) ?? value.targetInstitutionName;
              const subject = value.subject === "opportunity"
                ? organizationName(card, value.subjectOrganizationId) ?? "Opportunity"
                : `${value.subject.charAt(0).toUpperCase()}${value.subject.slice(1)}`;
              const relationLabel = relationshipLabels[value.relationshipType];
              return (
                <li key={relationship.id}>
                  <div className="relationship-topline">
                    <span>{relationLabel}</span>
                    <strong>{target ? `${subject} — ${target}` : subject}</strong>
                  </div>
                  <p>{value.description}</p>
                  <ScopeChips card={card} scope={value.scope} />
                  <AssertionEvidence sources={assertion.sources} label={relationLabel.toLowerCase()} />
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="structured-empty">
          {collectionMessage(card.institutionRelationships, "Institution relationships")}
        </p>
      )}
    </div>
  );
}

function claimsForVariant(card: OpportunityCard, variantId: string) {
  const details: Array<{ label: string; claim: DisplayClaim }> = [];
  for (const stage of modeledRecords(card.stages)) {
    const addClaims = (label: string, claims: Array<DisplayClaim & { value?: unknown }>) => {
      for (const claim of claims) {
        if (claim.status !== "disclosed") continue;
        const value = claim.value as { scope?: Scope } | undefined;
        const claimIsScoped = value?.scope?.variantIds.includes(variantId) ?? false;
        const stageIsScoped = stage.definition.value.scope.variantIds.includes(variantId);
        if (claimIsScoped || (stageIsScoped && value?.scope?.variantIds.length === 0)) {
          details.push({ label, claim });
        }
      }
    };
    addClaims("Schedule", stage.timings);
    addClaims("Duration", stage.durations);
    addClaims("Time commitment", stage.timeCommitments);
    addClaims("Format", stage.formats);
    addClaims("Location", stage.locations);
  }
  for (const cost of modeledRecords(card.costItems)) {
    if (cost.definition.value.scope.variantIds.includes(variantId)) {
      details.push({ label: "Cost", claim: cost.amount });
    }
  }
  return details;
}

export function VariantPanel({ card }: { card: OpportunityCard }) {
  const variants = modeledRecords(card.variants);
  if (!variants.length) {
    return <p className="structured-empty">{collectionMessage(card.variants, "Program variants")}</p>;
  }
  return (
    <>
      <CollectionNote note={card.variants.note} />
      <ul className="structured-variant-list">
      {variants.map((variant) => {
        const overrides = claimsForVariant(card, variant.id);
        return (
          <li key={variant.id}>
            <div className="variant-heading">
              <strong>{variant.definition.value.label}</strong>
              <span>{variant.definition.value.kind.replaceAll("_", " ")}</span>
            </div>
            {variant.definition.value.parentVariantId ? (
              <p>Within {variantName(card, variant.definition.value.parentVariantId)}</p>
            ) : null}
            {overrides.length ? (
              <dl className="variant-overrides">
                {overrides.map(({ label, claim }) => (
                  <div key={claim.claimId}>
                    <dt>{label}</dt>
                    <dd><ClaimLine claim={claim} label={`${variant.definition.value.label} ${label.toLowerCase()}`} compact /></dd>
                  </div>
                ))}
              </dl>
            ) : <p className="structured-empty">Uses the shared schedule, format, and cost details below.</p>}
            {variant.eligibilityDifferences.length ? (
              <div className="variant-notes">
                <strong>Eligibility differences</strong>
                {variant.eligibilityDifferences.map((difference) => (
                  <ClaimLine
                    claim={difference}
                    label={`${variant.definition.value.label} eligibility difference`}
                    compact
                    key={difference.claimId}
                  />
                ))}
              </div>
            ) : null}
            {variant.notes.map((note) => (
              <div className="structured-subclaim" key={note.claimId}>
                <strong>Program note:</strong> {note.value}
                <AssertionEvidence sources={note.sources} label={`${variant.definition.value.label} program note`} />
              </div>
            ))}
            <AssertionEvidence sources={variant.definition.sources} label={`${variant.definition.value.label} program definition`} />
          </li>
        );
      })}
      </ul>
    </>
  );
}

function StageClaimList({
  card,
  stage,
}: {
  card: OpportunityCard;
  stage: StageRecord;
}) {
  const groups: Array<{ label: string; claims: DisplayClaim[] }> = [
    { label: "Date", claims: stage.timings },
    { label: "Duration", claims: stage.durations },
    { label: "Time", claims: stage.timeCommitments },
    { label: "Format", claims: stage.formats },
    { label: "Location", claims: stage.locations },
    { label: "Selection", claims: stage.selectionRules },
    { label: "Advancement", claims: stage.advancement },
    { label: "Travel", claims: stage.travelRequirements },
  ];
  const shown = groups.flatMap(({ label, claims }) => claims.map((claim) => ({ label, claim })));
  return (
    <>
      {shown.length ? (
        <dl className="stage-claim-list">
          {shown.map(({ label, claim }) => {
            const scope = claim.status === "disclosed"
              ? (claim as DisplayClaim & { value: { scope?: Scope } }).value.scope
              : undefined;
            return (
              <div key={claim.claimId}>
                <dt>{label}</dt>
                <dd>
                  <ClaimLine claim={claim} label={`${stage.definition.value.label} ${label.toLowerCase()}`} compact />
                  {scope ? <ScopeChips card={card} scope={scope} /> : null}
                </dd>
              </div>
            );
          })}
        </dl>
      ) : null}
      {stage.requirements.length ? (
        <ul className="stage-requirements">
          {stage.requirements.map((requirement) => (
            <li key={requirement.claimId}>
              {requirement.value.requirement}
              <ScopeChips card={card} scope={requirement.value.scope} />
              <AssertionEvidence sources={requirement.sources} label={`${stage.definition.value.label} requirement`} />
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

export function StagePathwayPanel({ card }: { card: OpportunityCard }) {
  const stages = [...modeledRecords(card.stages)].sort((a, b) => a.order - b.order);
  const pathways = modeledRecords(card.pathways);
  if (!stages.length && !pathways.length) {
    return <p className="structured-empty">{collectionMessage(card.stages, "Process stages")}</p>;
  }
  return (
    <div className="process-ledger">
      <CollectionNote note={card.stages.note} />
      <CollectionNote note={card.pathways.note} />
      {pathways.length ? (
        <div className="pathway-list">
          <h4>{pathways.length === 1 ? "Selection path" : "Selection paths"}</h4>
          {pathways.map((pathway) => (
            <article key={pathway.id}>
              <strong>{pathway.definition.value.label}</strong>
              {pathway.definition.value.variantIds.length ? (
                <span>{pathway.definition.value.variantIds.map((id) => variantName(card, id)).join(", ")}</span>
              ) : <span>Shared path</span>}
              <ol>
                {pathway.steps.map((step) => (
                  <li key={step.claimId}>
                    <span>{stageName(card, step.value.stageId)}</span>
                    {step.value.enterWhen ? <small>{step.value.enterWhen}</small> : null}
                    <AssertionEvidence sources={step.sources} label={`${pathway.definition.value.label} step`} />
                  </li>
                ))}
              </ol>
              <AssertionEvidence sources={pathway.definition.sources} label={`${pathway.definition.value.label} path`} />
            </article>
          ))}
        </div>
      ) : null}
      {stages.length ? (
        <ol className="stage-timeline">
          {stages.map((stage) => (
            <li key={stage.id}>
              <div className="stage-marker" aria-hidden="true" />
              <article>
                <div className="stage-heading">
                  <strong>{stage.definition.value.label}</strong>
                  <span>{stage.definition.value.kind.replaceAll("_", " ")}</span>
                </div>
                <ScopeChips card={card} scope={stage.definition.value.scope} />
                <StageClaimList card={card} stage={stage} />
                <AssertionEvidence sources={stage.definition.sources} label={`${stage.definition.value.label} stage`} />
              </article>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function CostItem({ card, cost }: { card: OpportunityCard; cost: CostItemRecord }) {
  const definition = cost.definition.value;
  return (
    <li>
      <div className="structured-item-heading">
        <div>
          <strong>{definition.label}</strong>
          <span>{costKindLabels[definition.kind]}</span>
        </div>
        <span className={`cost-requirement cost-requirement-${definition.requirement}`}>
          {requirementLabels[definition.requirement]}
        </span>
      </div>
      <ScopeChips card={card} scope={definition.scope} />
      <ClaimLine claim={cost.amount} label={`${definition.label} amount`} />
      {cost.chargeBasis ? <ClaimLine claim={cost.chargeBasis} label={`${definition.label} charge basis`} compact /> : null}
      {cost.treatment ? <ClaimLine claim={cost.treatment} label={`${definition.label} treatment`} compact /> : null}
      {cost.refundability ? <ClaimLine claim={cost.refundability} label={`${definition.label} refund terms`} compact /> : null}
      {cost.includedItems.map((item) => (
        <div className="structured-subclaim" key={item.claimId}>
          <strong>Included:</strong> {item.value}
          <AssertionEvidence sources={item.sources} label={`${definition.label} included item`} />
        </div>
      ))}
      {cost.excludedItems.map((item) => (
        <div className="structured-subclaim" key={item.claimId}>
          <strong>Not included:</strong> {item.value}
          <AssertionEvidence sources={item.sources} label={`${definition.label} excluded item`} />
        </div>
      ))}
      {cost.conditions.map((condition) => (
        <div className="structured-subclaim" key={condition.claimId}>
          <strong>Condition:</strong> {condition.value}
          <AssertionEvidence sources={condition.sources} label={`${definition.label} condition`} />
        </div>
      ))}
      <AssertionEvidence sources={cost.definition.sources} label={`${definition.label} cost type`} />
    </li>
  );
}

export function CostPanel({ card }: { card: OpportunityCard }) {
  const costs = modeledRecords(card.costItems);
  if (!costs.length) {
    return <p className="structured-empty">{collectionMessage(card.costItems, "Structured costs")}</p>;
  }
  return (
    <>
      {card.costItems.status === "modeled" && card.costItems.completeness === "incomplete" ? (
        <div className="notice structured-cost-warning">
          <strong>No complete total is asserted.</strong>{" "}
          {card.costItems.note ?? "The reviewed sources establish these line items but do not establish a complete inventory of every applicable mandatory charge."}
        </div>
      ) : null}
      {card.costItems.status === "modeled" && card.costItems.completeness === "complete" ? (
        <CollectionNote note={card.costItems.note} />
      ) : null}
      <ul className="structured-item-list cost-item-list">{costs.map((cost) => <CostItem card={card} cost={cost} key={cost.id} />)}</ul>
    </>
  );
}

function OutcomeItem({ card, outcome }: { card: OpportunityCard; outcome: OutcomeRecord }) {
  const definition = outcome.definition.value;
  const displayLabel = outcome.definition.displayValue;
  const claims = [
    ["Recipient", outcome.recipientScope],
    ["Value type", outcome.monetaryNature],
    ["Amount", outcome.amount],
    ["Distribution", outcome.distribution],
    ["Placement", outcome.rank],
    ["Track", outcome.track],
    ["Quantity", outcome.quantity],
    ["Use restriction", outcome.useRestriction],
    ["Can combine", outcome.combinability],
  ] as const;
  return (
    <li>
      <div className="structured-item-heading">
        <div>
          <strong>{displayLabel}</strong>
          <span>{outcomeTypeLabels[definition.outcomeType]}</span>
        </div>
      </div>
      <ScopeChips card={card} scope={definition.scope} />
      <dl className="outcome-claim-list">
        {claims.map(([label, claim]) => claim ? (
          <div key={label}>
            <dt>{label}</dt>
            <dd><ClaimLine claim={claim} label={`${displayLabel} ${label.toLowerCase()}`} compact /></dd>
          </div>
        ) : null)}
      </dl>
      {outcome.conditions.map((condition) => (
        <div className="structured-subclaim" key={condition.claimId}>
          <strong>Condition:</strong> {condition.value}
          <AssertionEvidence sources={condition.sources} label={`${displayLabel} condition`} />
        </div>
      ))}
      <AssertionEvidence sources={outcome.definition.sources} label={`${displayLabel} outcome type`} />
    </li>
  );
}

export function OutcomePanel({ card }: { card: OpportunityCard }) {
  const outcomes = modeledRecords(card.outcomes);
  if (!outcomes.length) {
    return <p className="structured-empty">{collectionMessage(card.outcomes, "Structured outcomes")}</p>;
  }
  return (
    <div className="outcome-groups">
      <CollectionNote note={card.outcomes.note} />
      {outcomeGroups.map((group) => {
        const records = outcomes.filter((outcome) => group.types.some((type) => type === outcome.definition.value.outcomeType));
        if (!records.length) return null;
        return (
          <section key={group.id} aria-label={group.label}>
            <h4>{group.label}</h4>
            <ul className="structured-item-list">{records.map((outcome) => <OutcomeItem card={card} outcome={outcome} key={outcome.id} />)}</ul>
          </section>
        );
      })}
    </div>
  );
}

export function hasStructuredOpportunityData(card: OpportunityCard) {
  return card.cycle.status === "modeled" || [
    card.organizations,
    card.organizationRoles,
    card.institutionRelationships,
    card.variants,
    card.stages,
    card.pathways,
    card.costItems,
    card.outcomes,
  ].some((collection) => collection.status === "modeled");
}

export function StructuredOpportunityDetails({
  card,
  embedded = false,
}: {
  card: OpportunityCard;
  embedded?: boolean;
}) {
  if (!hasStructuredOpportunityData(card)) return null;
  const cycle = card.cycle.status === "modeled" ? card.cycle.value.label.value : "Cycle not modeled";
  const Heading = embedded ? "h4" : "h2";
  return (
    <section className="structured-opportunity" aria-label="Structured program details">
      <details suppressHydrationWarning>
        <summary>
          <span>
            <strong>Explore structured details</strong>
            <small>{cycle} · Roles, programs, process, costs, and outcomes</small>
          </span>
          <span>Show / hide</span>
        </summary>
        <div className="structured-opportunity-body">
          <section className="structured-panel">
            <Heading>Organizations and relationships</Heading>
            <OrganizationRelationshipPanel card={card} />
          </section>
          <section className="structured-panel">
            <Heading>Programs and cohorts</Heading>
            <VariantPanel card={card} />
          </section>
          <section className="structured-panel">
            <Heading>Schedule and selection paths</Heading>
            <StagePathwayPanel card={card} />
          </section>
          <section className="structured-panel">
            <Heading>Costs</Heading>
            <CostPanel card={card} />
          </section>
          <section className="structured-panel">
            <Heading>Outcomes and prizes</Heading>
            <OutcomePanel card={card} />
          </section>
        </div>
      </details>
    </section>
  );
}

const comparisonGroups = [
  { id: "relationships", label: "Organizations and relationships", Panel: OrganizationRelationshipPanel },
  { id: "variants", label: "Programs and cohorts", Panel: VariantPanel },
  { id: "process", label: "Schedule and selection paths", Panel: StagePathwayPanel },
  { id: "costs", label: "Costs and conditions", Panel: CostPanel },
  { id: "outcomes", label: "Outcomes, funding, and prizes", Panel: OutcomePanel },
] as const;

export function StructuredComparison({
  cards,
}: {
  cards: OpportunityCard[];
}) {
  if (!cards.some(hasStructuredOpportunityData)) return null;
  return (
    <section className="structured-comparison" aria-labelledby="structured-comparison-title">
      <div className="structured-comparison-heading">
        <div>
          <p className="eyebrow">Structured detail</p>
          <h2 id="structured-comparison-title">Compare distinctions the summary rows cannot hold.</h2>
        </div>
        <p>Open only the relationship, program, process, cost, or outcome detail you need.</p>
      </div>
      <div className="structured-comparison-groups">
        {comparisonGroups.map(({ id, label, Panel }) => (
          <details key={id}>
            <summary>{label}</summary>
            <div className="structured-comparison-grid" style={{ "--comparison-columns": cards.length } as CSSProperties}>
              {cards.map((card) => (
                <article key={card.slug}>
                  <h3>{card.facts.opportunity_name.displayValue ?? card.slug}</h3>
                  <Panel card={card} />
                </article>
              ))}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
