# Screens and capture contract

The Step 2 collection is indexed in [baseline-catalog.json](baseline-catalog.json), with a [paired gallery](../sitemap/gallery.md) and [review report](../evidence/baseline/review.md). Original PNG files are preserved under `2026-10-09-baseline/<run-id>/`, grouped by stable screen/state IDs and viewport. Raw manifests, fixtures and test diagnostics live under `../evidence/baseline/2026-10-09/<run-id>/`.

The separate readiness archive remains under `2026-10-08-readiness/`; [catalog.json](catalog.json) describes those earlier samples. Its 53 PNGs are not part of the Step 2 coverage count.

## New audit captures

Use `screens/<baseline-id>/<run-id>/<screen-state-id>/<viewport>.png`. A screen ID represents a view; route parameters and content records are captured as state metadata. Preserve originals. Put annotated copies in a separate path.

For every capture record:

- Stable capture ID and screen ID; route, role and state.
- Live or synthetic environment; fixture description and content volume.
- Viewport width/height, browser, input emulation and pixel ratio.
- Full-page or viewport capture; image dimensions and SHA-256.
- Capture timestamp and source/application commit.
- Font/image readiness and visual-inspection status.
- Linked journey, observed interactions, caveats and superseded capture if any.

Use `null` plus a reason for information that has not been verified. Never infer role from appearance, treat image dimensions as viewport dimensions or mistake test IDs for route metadata.

The route/state coverage inventory distinguishes normal, empty, dense, error and completion states, dialogs and navigation/tab states. Transient loading/motion and native browser/OS surfaces retain the [method's explicit limits](../evidence/baseline/README.md). Raw capture count includes retries and diagnostics; selected paired states are reported separately.

## Reproduction

Readiness used the pinned application source with the existing Playwright/Firebase emulator setup. Workflow revisions and the exact source commits are preserved in `../evidence/readiness/`. Ten existing role/journey checks passed. The final focused run verified a register with 90 synthetic source records per user, 30 rows initially and 60 after continuation on each viewport.

Public landing captures are live. Authenticated test captures use disposable local emulator accounts. Actual iOS/Android device behavior is not established by these files. Avoid credentials and real learner information in future shared captures; use controlled fixtures where needed.
