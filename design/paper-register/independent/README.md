# Independent paper-register design evidence

This directory preserves source evidence from `/workspace/scratch/0a41fddf9e8a/independent-paper-design` for the 4 October 2026 design exercise. Copied artifacts are byte-identical to the source snapshot. `SHA256-MANIFEST.json` records source paths, packaged paths, byte counts and matching source/package hashes.

## Provenance and limits

The user explicitly required a fresh independent designer without the old UI, code, screenshots or parent design proposals. The original designer worked from neutral requirements and outside-product references. This package does not claim a comparison against the old product baseline.

- `proposal.txt` is the frozen original independent proposal. Its three directions and early capability assumptions remain unchanged for traceability.
- `renders/neutral-*.png` are the six neutral desktop/phone candidate images. `clean-selection-review.md` preserves the isolated selector's review of neutral candidates and reference images, without the proposal, application or parent recommendation. It selected C, the durable paper register, as a credible exploratory foundation; its scores and unresolved weaknesses are not implementation acceptance.
- `central-release.json` records the Central guidance release used for the design exercise.
- `references/` contains the three requested external-product reference images. They informed interaction mechanisms rather than a copied layout. The clean selection also cites `intercom-inbox.webp`; that fourth image remains in the existing sibling `../references/` directory and was not recopied in this bounded package. The large Google Drive GIF is excluded.
- `refinement-v2/handoff-service-annotated.txt` and `refinement-v2/capability-map.txt` preserve later service-truth annotations. They distinguish supported behavior from proposed controls and correct the original assumptions for delivery: admin-wide access, immutable creator attribution, in-app and opt-in push notifications, and saved HTML with browser Print / Save PDF. Read those annotations when interpreting the concept renders; do not edit the frozen original to erase the distinction.
- `refinement-v2/renders/` includes the requested index, clarification, completed and active-revision desktop/phone views. The pre-existing new-request renders, `candidates.html` and `refinement-v2/refinement.html` are retained as additional static concept evidence. The candidate HTML was not input to the clean selector.

All pictured records, counts and controls are concept examples. These files do not prove real retrieval, persistence, permissions, notification delivery, generation, print behavior, production release or owner acceptance. The original proposal and refined service annotations remain separate evidence layers.

Current application implementation and review evidence are owned elsewhere under `../`; `../design-record.md` is the separate implementation record. This archival package does not update that record or adjudicate current review results. The mutable independent-critic aggregate JSON is deliberately excluded pending its final integration by the implementer.

## Packaging

The manifest covers 22 requested source artifacts and four pre-existing concept artifacts. Earlier flat `selected-*` copies were consolidated into source-relative `refinement-v2/` paths only after confirming byte identity. No application files, product-memory drafts, sibling reference files or other review records were changed by this packaging task. No commit or push is implied by the package.
