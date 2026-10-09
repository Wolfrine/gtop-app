# Decisions and feedback

## D-001 · Fresh process · Accepted by user · 8 October 2026

The user requested a fresh approach, excluding previous design directions, Central > Design and earlier design workflows. Order: evaluation framework, complete baseline, premium references, screen analysis, mockup images, then development after acceptance. Existing product behavior remains the baseline to inspect.

## D-002 · Resolve practical access limits first · Accepted by user · 8 October 2026

Verify capture/source/role paths before evaluation. The user authorized Playwright, Firebase emulators and suitable alternatives. Readiness was demonstrated on a fixed production source commit; intrinsic limitations remain explicit validation requirements.

## D-003 · Permanent repository record · Accepted by user · 8 October 2026

The user required a persistent base accessible beyond the chat. The agreed entry point is `design-upgrade/README.md` in GTOP's repository, covering plan/status, sitemap, original screenshots, references, evaluations, mockups and decisions. Temporary Actions artifacts are not the permanent store. Repository access is required.

## D-004 · Presentation route · Confirmed usable by user · 8 October 2026

The shared HTML opened as code and the PDF also failed to load in the user's chat viewport. A direct in-chat preview was confirmed usable. Keep previews as presentation; repository Markdown and original assets remain the durable record. Do not claim that the original attachment-loading issue was diagnosed or fixed.

## D-005 · Evaluation framework · Prepared, awaiting calibration/review · 8 October 2026

Step 1 defines independent visual and journey scores, separate desktop/mobile evidence, explicit confidence/unknowns and benchmark anchors. This is a methodology output, not acceptance of a design or a rating of current GTOP screens. Benchmark calibration occurs in Step 3 before Step 4 scoring.

## D-006 · Publish this initiative to main as it progresses · Authorized by user · 9 October 2026

The user instructed: “For this work we are doing here, deploy everything in main as we go.” Merge the foundation record and publish each completed stage to `main` without asking for a separate merge approval. This supersedes the earlier branch-only handling for this initiative. The authorization concerns delivery; D-001's stage order and the requirement for design acceptance before application development remain in force. PR #63 preserves the foundation review trail.

## D-007 · Step 2 baseline and state gap · Evidence recorded; no exclusion accepted · 9 October 2026

Inventoried 40 concrete route entries and 39 URL patterns. Captured and inspected the current interface at desktop and mobile sizes with separate live-public and synthetic-authenticated provenance. Original runs are append-only; inspected selections, diagnostics, supersession and route redirects are indexed in the baseline catalog.

The Action Plan route renders an unavailable state. Its populated cards/expanded criteria/edit/filtered-empty state remains unverified because the unchanged isolated application reports a Firebase query-type mismatch even though a direct authenticated admin rules read succeeds. The [review report](evidence/baseline/review.md) gives the evidence and closure path. No exclusion is accepted on behalf of the user; Step 2's full-state completion gate remains open. Application code was not changed. Step 3, ratings, mockups and development have not started.

## D-008 · Exclude unused Action Plan; close Step 2 · Accepted by user · 9 October 2026

The user instructed: “Action plan page is not in use so can ignore it.” Exclude `/admin/action-plan` (R23) and its states from this design-upgrade initiative unless the user restores it. This resolves the stage blocker in D-007 by an accepted scope exclusion, not by a functional repair. Preserve the screenshots and diagnostic history. Application source remains unchanged.

Step 2 is complete for the agreed scope: 39 included route entries covering 38 distinct URL patterns. The historical inventory still records all 40 route entries / 39 patterns and 491 original screenshots. Next is Step 3, premium reference research and calibration; screen ratings, mockups and development remain pending their agreed gates.

## D-009 · Step 3 reference study · Completed for review · 9 October 2026

The user authorized Step 3 after discussing motion, aesthetic characterization and human appeal. Screened fifteen candidates, captured nine and retained seven core references spanning expressive identity, public education, explanatory learning and dense component behavior. Lando/Igloo remain contextual/diagnostic because desktop evidence was incomplete. Failed attempts and superseded captures remain in git.

The [report](references/report.md), [gallery](references/gallery.md) and [interaction register](references/interactions.md) distinguish observations, interpretation and unknowns. Brilliant playback control remains unverified and is excluded as a positive interaction example. Criteria v1.1 adds named property anchors; all weights and score-band meanings stay unchanged, and v1.0 is preserved. No GTOP screen is scored. This is completion of research for review, not user acceptance of a design. Step 4 follows confirmation that the reference base is on track; development remains gated by accepted mockups.

## D-010 · Begin screen evaluation · Authorized by user · 9 October 2026

After reviewing Step 3 and its lessons, the user said “Very good. Let’s move to the next step now.” The reference base is accepted as on track for Step 4. Evaluate all included GTOP routes using criteria v1.1; preserve separate desktop/mobile craft judgments and bounded journey evidence. This authorizes evaluation, not mockups or application development. Publish to main under D-006.
