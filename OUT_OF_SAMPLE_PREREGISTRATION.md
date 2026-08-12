# Opportunity Facts out-of-sample extraction preregistration

Preregistered: 2026-08-12T06:10:49Z  
Evaluation set: seven current or clearly upcoming student opportunities  
Frozen extractor commit: `f5def78cc581b3c0896662c62c2503d173793a43`  
Frozen tag: `evaluation-v2-frozen`  
Schema: `2.0.0`  

**The seven opportunities were selected before automated extraction results were observed.**

No candidate URL was submitted to the Opportunity Facts analyzer during selection. Selection used public official pages only to establish that each opportunity exists, its target cycle, and its broad structure. The development-set cards—NASA TechRise 2026–2027, Lumiere Fall 2026, and Diamond Challenge 2027—are excluded, as is Lumos Fellows.

## Locked evaluation set

| # | Opportunity and target cycle | Canonical starting URL | Category | Selection rationale |
| ---: | --- | --- | --- | --- |
| 1 | Congressional App Challenge — 2026 | <https://www.congressionalappchallenge.us/students/rules/> | Government/civic technology competition | A current district-based public-sector challenge with individual or team entry, district eligibility, locally administered judging, and mostly in-kind/public-recognition outcomes. It tests distributed administration without choosing an obscure or intentionally hostile site. |
| 2 | Coca-Cola Scholars Program — 2027 | <https://www.coca-colascholarsfoundation.org/apply/> | Large achievement scholarship | A current $20,000 scholarship with four disclosed selection phases, changing application requirements, interviews, a required Scholars Weekend, and a large applicant funnel. |
| 3 | Yale Young Global Scholars — Summer 2027 | <https://globalscholars.yale.edu/> | University-operated paid pre-college program | A clearly announced 2027 Yale program with three sessions, three academic offerings per session, residential participation, application fees, tuition, and need-based aid. It tests university operation, session matrices, price/aid, and an upcoming application whose details may still be incomplete. |
| 4 | Polygence Core Program — rolling / Fall 2026 entry | <https://www.polygence.org/core-program> | Paid independent research-mentorship program | A current, independently operated online program with rolling cohorts, mentor matching, multiple support components, optional outcomes, tuition/payment plans, financial aid, and conditional refunds. It is structurally related to—but independent of—the excluded Lumiere development card. |
| 5 | MITES Summer — Summer 2027 | <https://mites.mit.edu/discover-mites/mites-summer/> | Free selective university STEM program | A clearly upcoming, selective six-week residential MIT program whose 2027 dates are not yet final. It is free except for participant transportation and shares one application with MITES Semester. It tests zero tuition, shared application pathways, in-person residential commitments, and honest handling of TBD dates. |
| 6 | Breakthrough Junior Challenge — 2026 | <https://breakthroughjuniorchallenge.org/> | Global science communication competition | A current individual competition with peer review, expert review, popular-vote and finalist stages, plus a deliberately unusual multi-recipient prize: student scholarship, teacher cash, and a school laboratory. |
| 7 | QuestBridge National College Match — 2026 Match / Fall 2027 enrollment | <https://www.questbridge.org/apply-to-college/programs/national-college-match> | Multi-institution college-match and scholarship pathway | A current free application with Finalist selection, ranked college choices, partner-specific requirements, binding/non-binding pathways, Match Day, Regular Decision fallback, and a full four-year scholarship whose exact composition depends on the matched college. This adds a ranked multi-party pathway not covered by the first six. |

The order above is fixed and is also the run order.

## Diversity matrix

| Opportunity | Individual / team | Cost structure | Primary form | Selection structure | Outcomes | Format / source structure |
| --- | --- | --- | --- | --- | --- | --- |
| Congressional App Challenge | Individual or team of up to four | No entry fee disclosed; participant costs require review | Civic competition | District eligibility and local judging | Display/publication, event invitation, fee waiver, possible sponsor prizes | Digital submission; national rules plus district-specific administration |
| Coca-Cola Scholars | Individual | No application fee disclosed; scholarship | Scholarship | Application → semifinalist supplement → regional interview → Scholar | $20,000 scholarship and required Scholars Weekend | National; concentrated official page plus policies |
| Yale YYGS | Individual | Application fee, tuition, need-based aid, participant travel | Academic program | Application pools and admission | Program seat, certificate/academic experience, aid | Residential at Yale; multiple sessions and offerings |
| Polygence Core | Individual | Paid tuition, installment surcharge, aid, conditional refund | Independent research program | Application → consultation/matching → mentored project | Research project, mentor support, writing feedback, optional showcase/record | Remote; product, FAQ, aid, and policy pages |
| MITES Summer | Individual | Free tuition/room/board; transportation borne by student unless aided | Selective STEM program | Shared MITES application → holistic review → one-program offer | Six-week residential coursework, projects, instructor evaluation | In person at MIT; shared application with a virtual sibling program |
| Breakthrough Junior Challenge | Individual | No purchase required | Global competition | Peer review → expert review → popular vote/finalists → winner | Student scholarship, teacher cash, school lab | Online video entry with public voting and legal/rules pages |
| QuestBridge Match | Individual | Free application; college-specific financial package | College match / scholarship pathway | Application → Finalist → rankings → partner requirements → Match or RD | Admission plus full four-year scholarship when matched | Distributed across QuestBridge and many partner-college requirements |

This set contains individual and team opportunities; free, paid, and aid-dependent participation; scholarships, academic programs, competitions, and a college-match pathway; simple and branching processes; cash, scholarship, restricted/in-kind, and multi-recipient outcomes; remote, residential, and mixed pathways; and both concentrated and distributed official-source ecosystems.

## Inclusion and exclusion rules

An opportunity was eligible only if, before inference:

1. an official public source showed a current cycle or a clearly applicable upcoming cycle;
2. enough official public material existed to make a human V2 review meaningful;
3. it served secondary students or a directly adjacent college-entry transition;
4. it contributed a required category or a structure not already covered; and
5. it was a realistic opportunity a student might research, not selected for crawl ease or failure likelihood.

Excluded were the three development programs, Lumos Fellows, expired opportunities with no clear upcoming cycle, account-only programs with insufficient public evidence, opportunities selected after observing analyzer behavior, and duplicates that did not materially improve the diversity matrix. No candidate was accepted or rejected because Opportunity Facts could or could not crawl it.

If a locked opportunity literally ceases to exist or its canonical URL is invalid before inference, any replacement must be documented and committed before that replacement is analyzed. A source that is blocked, JavaScript-only, oversized, PDF-only, cross-origin, or otherwise inaccessible to the product is not a replacement trigger; it is an acquisition result.

## Frozen system and run rules

- Provider: OpenAI Responses API through the production `analyzePublicUrl` path.
- Model: `gpt-5.6-terra`; no substitution.
- Privacy: `store: false`.
- Reasoning effort: `low`.
- Maximum output: 24,000 tokens.
- Request timeout: 120,000 ms.
- Retries: zero.
- Schema: Opportunity Card `2.0.0`.
- Starting input: the single canonical URL in the locked table.
- Runs: exactly one primary URL-path run per opportunity, in table order.
- No human card, hidden hint, manually selected excerpt, pasted-source supplement, or target-cycle hint is supplied to the model.
- A timeout, fetch failure, provider failure, or schema failure is retained as the primary result and is not rerun.
- The extractor, acquisition, ranking, normalization, evidence validation, model schema/prompt, and projections remain those in `f5def78cc581b3c0896662c62c2503d173793a43` until all seven first-pass artifacts are saved.

## Ground-truth and anti-leakage procedure

All seven human-reviewed V2 cards and their review notes will be completed and committed before any of the seven URLs is submitted to the analyzer. Human review may use web search to find official sources, but not Opportunity Facts automated analysis or model-generated card suggestions. Every displayed disclosed or conflicting claim must have an exact excerpt and matching source inventory record. Conservative statuses are valid outcomes. Ground-truth cards will be marked `human_reviewed` only after the review checklist and deterministic card validation pass.

The automated drafts will never be used to change the frozen human cards or their scoring key.

## Prespecified scoring rules

Metrics retain the development-benchmark definitions and always report numerator and denominator. Undefined denominators remain undefined.

### Source acquisition

- **Reviewed source-category acquisition recall:** reviewed source categories represented by at least one acquired page / all reviewed source categories.
- **Exact reviewed-URL acquisition:** exact reviewed canonical URLs acquired / reviewed canonical URLs, reported where URL identity is meaningful.
- **Relevant pages missed:** reviewed source categories with no acquired page.
- **Irrelevant pages included:** acquired pages that do not materially support any reviewed claim or necessary program context.
- Fetch and parser failures are reported separately from model failures.

Redirect-equivalent and alternate-format official pages may satisfy category recall but not exact-URL overlap. Cross-origin official pages missed by the frozen same-origin crawler remain misses.

### Supported summary claims

An automated supported claim is one displayed flat fact with status `disclosed`, or one displayed candidate in a `conflicting` fact. A claim is semantically correct only when its value, field, object, scope, attribution, and uncertainty agree with the human-reviewed card and every required interpretation is supported by its cited excerpt.

- **Supported-claim precision:** semantically correct automated supported claims / all automated supported claims.
- **Supported summary recall:** correctly recovered human-reviewed disclosed or conflicting summary dimensions / all human-reviewed disclosed or conflicting summary dimensions.
- **Status agreement:** flat facts whose five-state status exactly matches ground truth / all 59 registry facts.
- **Semantic evidence correctness:** evidence attachments that semantically support their attached claim, object, scope, and attribution / all displayed evidence attachments.

Exact excerpt presence is necessary but not sufficient. A correct quote attached to the wrong organization, tier, stage, recipient, or field is incorrect.

### Structured V2 entities

Structured precision and recall are scored over organizations, roles, institution/person relationships, variants, stages, pathways, cost items, and outcomes. An output entity matches a ground entity only when its material identity and type match and all displayed material bindings—scope, amount/range, date precision, recipient, distribution, condition, funding nature, and relationship semantics—are correct. IDs need not lexically equal human IDs; they must resolve to the same semantic entity and references. One flattened entity cannot match several ground entities.

- **Structured-entity precision:** correctly matched automated entities / automated entities.
- **Structured-entity recall:** correctly matched automated entities / human-reviewed entities in the scored families.

Cycle is reviewed separately for label, status, years/season, and timing precision. Collection state without a surviving entity does not count as entity recall.

### Critical errors

Critical misleading errors are counted individually and include at minimum project funding presented as personal cash, person affiliation upgraded to institutional partnership, team prize presented as individual, wrong mandatory cost, wrong deadline, wrong eligibility, unsupported refund claim, unsupported college-credit claim, or an equally material object/scope error likely to change a student's decision. A deterministically rejected candidate is a validator catch, not a displayed critical error.

### Correction burden

Concrete human actions needed to transform the automated draft into ground truth are counted in seven non-overlapping categories:

1. add missing claim;
2. remove unsupported claim;
3. change status;
4. change value;
5. change relationship or scope;
6. change evidence; and
7. restructure object.

One correction may change more than one stored property, but it is counted once under the primary semantic action. Adding one missing structured record counts as one missing claim plus one structural correction; its atomic subclaims are not each inflated into separate corrections unless independently absent claims require separate reviewer actions. The same rule will be applied to every card.

## Inaccessible-source handling

The normal URL path is the evaluated product. If the submitted page or discovered page cannot be acquired, the failure, reason, and elapsed time are retained. The primary score receives no credit for source content the production path did not acquire. No pasted-source or manual-source run replaces or augments the seven primary outputs. Any later diagnostic is labeled separately and cannot change the frozen metrics.

## Reporting and interpretation

The seven cards are an out-of-sample evaluation set relative to the three-card development benchmark, not a statistically representative sample of all student opportunities. Results will be described as: “On this preregistered seven-opportunity evaluation set…” No overall accuracy score, legitimacy score, ranking, or population-level claim will be produced.

Development-set and out-of-sample metrics will remain separate. Production tuning is prohibited until the seven run artifacts, human semantic judgments, per-card ledgers, and aggregate report are frozen.

## Frozen implementation fingerprints

- Git commit: `f5def78cc581b3c0896662c62c2503d173793a43`
- Tag: `evaluation-v2-frozen`
- Public schema SHA-256: `16fa74eb4af5348c1f1728b1903f1dc7470a6d01520d342f8e741527a98039ef`
- Lockfile SHA-256: `17bdca5e7012a0ffa5a756a2385945411cb473cfc5797fc0ae99306e5a1a9a9c`
- Runtime at preregistration: Node.js `25.2.1`, npm `11.6.2`, OpenAI SDK `6.49.0`, Windows 11.

