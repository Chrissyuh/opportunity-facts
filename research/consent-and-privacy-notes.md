# Consent and privacy notes for Opportunity Facts research

Status: planning guidance and editable language, not a record of approval or consent.

This document is not legal advice and cannot determine whether a particular study is exempt from institutional, school-district, fair, sponsor, or human-subjects review. Obtain that determination from the responsible qualified reviewer **before** recruitment. Requirements vary by participant age, location, institution, funding, publication plan, and data collected.

## Privacy-first default

The comprehension protocol can run without collecting names or sending study responses to a server. Use that design unless the research question genuinely requires something else.

Collect only:

- a random participant ID that is not derived from identity;
- assigned condition and fixture;
- coded answers and correctness;
- confidence and elapsed time;
- coarse device class if needed for usability analysis;
- controlled, nonidentifying codes for accommodations, skips, and deviations.

Do not collect by default:

- names, email addresses, phone numbers, usernames, or signatures in the analytic file;
- school, employer, precise location, IP address, or device fingerprint;
- exact date of birth or unnecessary demographics;
- grades, application history, immigration/citizenship details, disability details, or financial information;
- typed free-text feedback, screen/audio/video recordings, keystrokes, or unrelated browsing;
- the contents of a participant's real opportunity application.

If an additional field is proposed, document why it is necessary, who can access it, its deletion date, and why a less identifying substitute is insufficient.

## Adults, minors, permission, and assent

For a first low-risk evaluation, recruiting adults is operationally simpler. If participants under 18 are included, do not rely on the product's audience or an educational setting as an exemption. Obtain the required institutional determination, guardian permission, and age-appropriate participant assent unless the responsible reviewer documents a lawful waiver.

Assent is not a forced signature. The young person should understand, in suitable language:

- participation is optional;
- the task is research or evaluation, not a graded assignment;
- choosing not to participate will not affect school, programs, services, or relationships;
- they may skip a question or stop;
- what is recorded, who will see it, and when it will be deleted.

Do not recruit students through a teacher or program gatekeeper in a way that makes participation appear required. Avoid compensation large enough to pressure participation, and never condition compensation on correct answers.

## Consent information that must be supplied

Adapt and review the following content before use. Replace every bracketed item; bracketed text is not approved consent language.

> **Purpose:** We are studying how people find factual disclosures about a fictional student opportunity. We are not evaluating you.
>
> **What you will do:** You will review two information formats and answer factual questions. The session will take about [duration].
>
> **What is recorded:** A random study ID, the materials shown, coded answers, confidence, timing, and [any other approved fields]. Your name, email, school, and IP address are not included in the research results file.
>
> **Risks and discomforts:** Risks are expected to be no greater than ordinary web use, but you may find a question tiring or unclear. [Add any reviewed risks from the actual procedure.]
>
> **Benefits:** You may receive no direct benefit. The study may help evaluate how disclosure information is presented; improvement is not guaranteed.
>
> **Choice:** Participation is voluntary. You may skip a question or stop without penalty. [State compensation handling.]
>
> **Storage and sharing:** Study data will be stored [where], accessible to [roles], and deleted or deidentified by [date/event]. Public reports will use aggregate results and will not identify you. [Disclose every processor or transfer.]
>
> **Withdrawal:** You may request withdrawal using [method and participant-held code] until [cutoff]. After the linkage is deleted or aggregate results are published, removal may no longer be possible.
>
> **Questions or concerns:** Contact [research contact]. For questions about participant rights, contact [independent/institutional contact when applicable].

Consent must happen before task data collection. Record that the gate passed, but keep signed forms, guardian records, recruitment contacts, and participant identities outside the analytic dataset.

## Withdrawal without an identity database

A random-ID design creates a tradeoff: data that cannot be linked to identity is safer, but later withdrawal may be impossible. Choose and disclose one approach before collection:

1. **Participant-held code:** give the participant their random code. Accept withdrawal requests containing that code until a stated cutoff. Maintain no name-code mapping.
2. **Temporary contact linkage:** maintain an encrypted, access-limited mapping separate from responses. Delete it on a declared date. This adds privacy risk and needs a documented reason.
3. **Anonymous submission:** collect no linkage and clearly explain that individual data cannot be removed after submission. Use only if approved and genuinely necessary.

Never promise unlimited withdrawal if the data design cannot honor it.

## Data flow and retention record

Complete this table for the actual study before recruitment:

| Stage | Data | Location | Who can access | Encryption | Deletion/deidentification event |
| --- | --- | --- | --- | --- | --- |
| Recruitment | | | | | |
| Consent/permission | | | | | |
| Local task capture | | | | | |
| Raw export | | | | | |
| Clean analytic data | | | | | |
| Aggregate publication | | | | | |
| Backup copies | | | | | |

Use access-controlled, encrypted storage for any nonpublic research data. Do not put raw participant data in Git, issue trackers, shared classroom folders, public cloud links, application logs, or the deployed Opportunity Facts repository. Define deletion for backups as well as primary copies.

The production application's “no permanent storage” promise does not automatically cover a separate research workflow. If a hosted survey, analytics tool, cloud drive, model API, or communication service is used, disclose that processor and review its retention settings before consent. Prefer frozen fictional fixtures so participant content is never sent to an external model.

## Local runner requirements

If a local-only study runner is built, it should:

- generate a cryptographically random ID and display it to the participant;
- gate all recording behind consent/assent confirmation;
- use monotonic elapsed timers and store UTC only when needed;
- write only fields in the approved codebook;
- keep task state on the device and send no telemetry;
- export a CSV locally after an explicit researcher action;
- provide a visible delete/reset action with confirmation;
- avoid browser fingerprinting, remote fonts, third-party scripts, and network-loaded study assets;
- prevent free text unless it has a reviewed purpose and redaction process.

Verify network behavior in browser developer tools before collection. “Local-only” is an implementation claim that must be tested, not inferred from the interface.

## Publication and re-identification controls

Publish aggregate results only after a second person checks the export for direct and indirect identifiers. Use minimum-cell suppression or broader grouping when combinations of demographics, accommodations, dates, or recruitment context could identify someone. Do not publish participant-level timing traces or exact timestamps.

Quotes require separate explicit permission and a redaction review. Do not imply that a quotation is representative of all participants. Never fabricate, clean up, or attribute a quote that was not actually collected under the approved protocol.

Public materials should state:

- the actual sample and recruitment context;
- whether participants were adults or an approved minor population, without exposing identifying subgroups;
- what was collected and retained;
- missing data, exclusions, deviations, and limitations;
- that participation and comprehension outcomes do not validate the opportunities described.

## Incident and stop procedure

Stop collection if consent is bypassed, data reaches an undisclosed server, identifiers appear in the analytic export, a device is lost, access is broader than approved, or a participant reports harm or coercion. Preserve only the minimum information needed to investigate. Notify the responsible supervisor/privacy contact, contain access, document affected records and decisions, and follow applicable notification requirements. Do not quietly repair the dataset and continue.

## Authoritative starting points for U.S. review

These sources help a responsible reviewer make an applicability decision; linking them does not mean federal human-subjects regulations necessarily govern this project or replace state, local, school, sponsor, or fair requirements.

- [HHS Office for Human Research Protections: Informed Consent FAQs](https://www.hhs.gov/ohrp/regulations-and-policy/guidance/faq/informed-consent/index.html) explains prospective, understandable, voluntary consent and the role of an IRB in documenting any waiver or alteration.
- [45 CFR part 46, Subpart D](https://www.hhs.gov/ohrp/regulations-and-policy/regulations/45-cfr-46/common-rule-subpart-d/index.html) is the HHS regulation for additional protections when covered research involves children.
- [OHRP Research with Children FAQs](https://www.hhs.gov/ohrp/regulations-and-policy/guidance/faq/children-research/index.html) discusses parental permission, affirmative assent, age/maturity considerations, documentation, and IRB responsibilities.

Check the publication/update dates and current applicability at the time the protocol is approved. Do not self-declare an exemption or waiver from a template.
