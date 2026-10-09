# Screens and capture contract

The current collection is readiness evidence, not the complete Step 2 inventory. Original PNG files are preserved under `2026-10-08-readiness/`, grouped by originating run. [catalog.json](catalog.json) provides provenance and diagnostic exclusions.

## New audit captures

Use `screens/<baseline-id>/<screen-id>/<state>/<viewport>.png`, with stable IDs established during Step 2. A screen ID represents a view; route parameters and content records are captured as state metadata. Preserve originals. Put annotated copies in a separate path.

For every capture record:

- Stable capture ID and screen ID; route, role and state.
- Live or synthetic environment; fixture description and content volume.
- Viewport width/height, browser, input emulation and pixel ratio.
- Full-page or viewport capture; image dimensions and SHA-256.
- Capture timestamp and source/application commit.
- Font/image readiness and visual-inspection status.
- Linked journey, observed interactions, caveats and superseded capture if any.

Use `null` plus a reason for information that has not been verified. Never infer role from appearance, treat image dimensions as viewport dimensions or mistake test IDs for route metadata.

Step 2 must add the route/state coverage inventory. Required coverage includes normal, empty, loading, dense, error and completion states when applicable; dialogs and navigation/tab states are views too. Mark inapplicable states with reasons. The initial 53 readiness PNGs include duplicated end-state and failed-setup images; their count is not a measure of audit coverage.

## Reproduction

Readiness used the pinned application source with the existing Playwright/Firebase emulator setup. Workflow revisions and the exact source commits are preserved in `../evidence/readiness/`. Ten existing role/journey checks passed. The final focused run verified a register with 90 synthetic source records per user, 30 rows initially and 60 after continuation on each viewport.

Public landing captures are live. Authenticated test captures use disposable local emulator accounts. Actual iOS/Android device behavior is not established by these files. Avoid credentials and real learner information in future shared captures; use controlled fixtures where needed.
