# GTOP design upgrade

This is the permanent entry point for the fresh GTOP design review started on **8 October 2026**. A collaborator with repository access can resume here without the chat.

**Current checkpoint:** Step 2 complete for the agreed scope. The user excluded the unused Action Plan page on 9 October 2026. The archive retains all 40 route entries / 39 URL patterns; the design-upgrade scope now includes 39 route entries / 38 URL patterns. **Next: Step 3 — premium reference research and criteria calibration.** No screen has been rated and no redesign has been accepted.

## Start here

1. [Sitemap — all routes and roles](sitemap/README.md)
2. [Desktop/mobile screenshot gallery](sitemap/gallery.md)
3. [Coverage review and accepted exclusion](evidence/baseline/review.md)
4. [Current status and exact next action](status.json)
5. [Plan and stage boundaries](plan.md)
6. [Evaluation criteria v1.0](evaluations/criteria.md)
7. [Decisions and feedback](decisions.md)

Capture provenance: [baseline catalog](screens/baseline-catalog.json) · [capture method](evidence/baseline/README.md) · [inspection record](evidence/baseline/inspection.json). The earlier [readiness archive](evidence/readiness/README.md) remains separate.

The user's direction for this initiative is a fresh approach: previous design directions, Central > Design and earlier design workflows do not determine the outcome. Existing screens establish the baseline. The user's acceptance of the proposed designs is required before application development.

## What is authoritative

| Material | Canonical location |
|---|---|
| Scope, sequence and completion criteria | [plan.md](plan.md) |
| Progress, blockers and exact next action | [status.json](status.json) |
| Screen captures and provenance | `screens/2026-10-09-baseline/` and [baseline catalog](screens/baseline-catalog.json) |
| Route/state evidence and gaps | [Sitemap](sitemap/README.md), [coverage data](sitemap/coverage.json), [review report](evidence/baseline/review.md) |
| Earlier readiness samples | `screens/2026-10-08-readiness/` and [readiness catalog](screens/catalog.json) |
| Capture procedure and naming contract | [screens/README.md](screens/README.md) |
| Benchmark candidates and accepted references | [references/README.md](references/README.md) |
| Evaluation framework and future scorecards | [evaluations/criteria.md](evaluations/criteria.md), [evaluations/TEMPLATE.md](evaluations/TEMPLATE.md) |
| Accepted decisions and unresolved design choices | [decisions.md](decisions.md) |
| Raw manifests, fixtures and diagnostic evidence | `evidence/baseline/2026-10-09/` and `evidence/readiness/` |
| Future proposed designs | `mockups/` (created when Step 5 begins) |

Chat previews and downloadable exports are convenient views of this record. GitHub Actions artifacts are temporary transfer sources; imported repository files have no Actions retention expiry. Git history preserves revisions. Capture originals are append-only; a newer capture receives a new dated path and supersession metadata.

## Evidence boundary

The application baseline is `00116b57042df34a49b99031dbea3c1bebe897a4`, matching live `version.json` during the 9 October captures. The current application is under `gtop-app/`; the presence of `gtop-v2/` does not make it the baseline.

The Step 2 collection contains live public landing captures and isolated Firebase-emulator learner/admin states at 390 × 844 and 1440 × 1000. The authenticated screens render controlled synthetic data through the unchanged application. Step 2 is closed with the user's explicit exclusion of the unused Action Plan page; its existing evidence is retained as history. These screenshots are not physical-device tests, a user study, production-data evidence or a finished reference comparison.

## Delivery authorization

On **9 October 2026**, the user instructed: “For this work we are doing here, deploy everything in main as we go.” Publish each completed stage of this initiative to `main`; a separate merge approval is not required. This project-specific authorization overrides the earlier branch-only handling for this work. The foundation was merged in [PR #63](https://github.com/Wolfrine/gtop-app/pull/63).

Publishing research, captures, evaluations and mockups to `main` does not waive the agreed sequence: application development starts only after the user accepts the proposed designs. Document-only changes are repository publication; report a live application deployment only when deployment has actually run and been verified.

## Resume protocol

- Read `status.json`, this page, the relevant criterion and the latest decisions.
- Confirm the current live release before adding audit captures. Preserve this baseline if the release has changed.
- For Step 2, derive an inventory from routes, navigation, role guards and actual UI. Include dialogs, tabs, navigation states and repeated-use states. Record explicit exclusions.
- Use the established isolated fixtures for controlled data. Keep live and synthetic evidence labeled.
- Update the catalog and status in the same change as new evidence. Record feedback and acceptance explicitly; a model score is not user acceptance.
- Stop at the current stage boundary. Mockups follow the evaluation; implementation follows accepted designs.

Repository access is required. This record does not make private GTOP material publicly accessible.
