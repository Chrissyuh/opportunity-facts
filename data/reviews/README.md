# Human-review attestations

This directory stores repository-side attestations created by the interactive local
human-review workflow. A card using `reviewState: "human_reviewed"` must have a
matching `<slug>.human-review.json` file here.

The validator binds that attestation to the card slug, opportunity ID, schema
version, card revision, complete review-manifest item set, reviewed-content SHA-256
digest, reviewer-entered identifier, review date, and explicit confirmation.
Changing source-backed card content or advancing the card revision makes an old
attestation stale. The public analyzer, builder, and AI audit code cannot create or
publish these attestations.

Do not add participant or applicant personal information to an attestation.
