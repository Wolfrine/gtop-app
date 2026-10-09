# GTOP design upgrade

This is the permanent entry point for the fresh GTOP design review started on **8 October 2026**. A collaborator with repository access can resume here without the chat.

**Current checkpoint:** capture readiness verified; Step 1 evaluation framework defined. **Next:** Step 2, reconcile the sitemap and capture every applicable screen/state on desktop and mobile. No screen has been rated and no redesign has been accepted.

## Start here

1. [Plan and stage boundaries](plan.md)
2. [Current status and next action](status.json)
3. [Evaluation criteria v1.0](evaluations/criteria.md)
4. [Readiness evidence and capture gallery](evidence/readiness/README.md)
5. [Capture catalog](screens/catalog.json)
6. [Decisions and feedback](decisions.md)

The user's direction for this initiative is a fresh approach: previous design directions, Central > Design and earlier design workflows do not determine the outcome. Existing screens establish the baseline. The user's acceptance of the proposed designs is required before application development.

## What is authoritative

| Material | Canonical location |
|---|---|
| Scope, sequence and completion criteria | [plan.md](plan.md) |
| Progress, blockers and exact next action | [status.json](status.json) |
| Screen captures and provenance | `screens/2026-10-08-readiness/` and [screens/catalog.json](screens/catalog.json) |
| Capture procedure and naming contract | [screens/README.md](screens/README.md) |
| Benchmark candidates and accepted references | [references/README.md](references/README.md) |
| Evaluation framework and future scorecards | [evaluations/criteria.md](evaluations/criteria.md), [evaluations/TEMPLATE.md](evaluations/TEMPLATE.md) |
| Accepted decisions and unresolved design choices | [decisions.md](decisions.md) |
| Test results, setup diagnostics and import checksums | `evidence/readiness/` |
| Future proposed designs | `mockups/` (created when Step 5 begins) |

Chat previews and downloadable exports are convenient views of this record. GitHub Actions artifacts are temporary transfer sources; imported repository files have no Actions retention expiry. Git history preserves revisions. Capture originals are append-only; a newer capture receives a new dated path and supersession metadata.

## Evidence boundary

The application baseline is `00116b57042df34a49b99031dbea3c1bebe897a4`, matching live `version.json` during capture on 8 October. The current application is under `gtop-app/`; the presence of `gtop-v2/` does not make it the baseline.

The readiness collection contains live public pages and isolated Firebase-emulator learner/admin states at 390 × 844 and 1440 × 1000. It demonstrates working capture methods. It is **not** a complete sitemap, physical-device test, user study or finished reference comparison. Unknown route/state details remain explicit in the catalog until Step 2 verifies them.

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
