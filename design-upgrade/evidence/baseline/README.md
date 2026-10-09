# Baseline method and evidence boundary

This collection records the existing GTOP interface for the fresh design review. It does not rate the screens or approve a redesign. Read the [sitemap](../../sitemap/README.md), [paired screenshot gallery](../../sitemap/gallery.md), [coverage data](../../sitemap/coverage.json) and [capture catalog](../../screens/baseline-catalog.json) together.

## Release and environments

- Live entry: `https://gtop-app.web.app/`. The captured `version.json` identifies application commit `00116b57042df34a49b99031dbea3c1bebe897a4`, built on 5 October 2026.
- Capture checkout: `058729a6fc62d285d5f7abc6d603952466df54d9`. This later repository checkpoint contains the same application source. Each workflow asserts no diff in the application source, dependencies, Firebase configuration/rules or Functions against it before capture.
- Public landing: both the live deployment and isolated local application are captured. These provenance classes remain separate.
- Signed-in states: the unchanged Angular application runs with Firebase Auth, Firestore, Realtime Database and Functions emulators. Real GTOP components render controlled accounts and records. Production learner accounts/data were not modified by the capture journeys.
- Coordination: the work itself is tracked separately in the real GTOP Action Plan item `Dcyop0vBU0K9nAiFc3wh`.

## Screen and state inventory

`app.routes.ts` has 40 concrete route entries covering 39 distinct URL patterns, plus a wildcard redirect to `/`. The two `/quiz` entries have different components; `invitedQuizMatch` selects the invitation flow before the ordinary quiz route. Inventory sources also include navigation, role guards, component templates and the actual captured UI.

A state is a materially different layout or decision surface: a populated or empty page, editor, confirmation, expanded review, selected answer, result, paper status, responsive drawer, or lab step. Every option value, question permutation and record is not a separate screen. Dynamic routes use representative existing and missing fixture IDs.

## Capture contract

| Property | Baseline setting |
|---|---|
| Desktop | Chromium, 1440 × 1000 viewport, DPR 1 |
| Mobile | Chromium touch/mobile emulation, 390 × 844 viewport, DPR 1 |
| Motion | Reduced motion; screenshot animations disabled |
| Assets | Wait for fonts; record image loading, runtime errors and scroll dimensions |
| Ordinary pages | Full-page PNG, retaining original width and height |
| Overlays | Viewport PNG when an open dialog/drawer is detected; this avoids full-page stitching beyond its backdrop |
| Provenance | Run ID, state, role, requested/actual URL, timestamp, source commit, environment, viewport, original dimensions, bytes and SHA-256 |
| Storage | Append-only run folders in this repository, with previous captures retained |

Modal content can scroll independently. The screenshot shows its visible scroll position; the manifest records detected inner scrolling. A static image does not establish that every part of an independently scrolling dialog is visible at once. The `role` field names the seeded/requested fixture account; it is corroborated by the application's role-specific navigation and guarded behavior, not a separately recorded live identity assertion.

## Controlled data

Fixtures provide complete learner/admin accounts, a profile needing curriculum setup, an empty curriculum, six syllabus rows, 30 synthetic approved questions, five pinned reviewed invitation questions, 54 review drafts, 12 quiz history records, 66 paper conversations, templates, question priorities and action-plan records. Additional valid lesson attempts populate the lab result screens. Real emulator Functions derive the paper register from the fixture conversations; screenshots are not HTML replacements or painted mock data.

The copy, people, scores and volumes are capture fixtures. Some questions intentionally repeat to exercise review warnings; those warnings do not describe the production bank. Desktop and mobile are sequential journeys, so counts/timestamps/random answer order can differ after an isolated attempt is completed. Compare layout and state, not those incidental values. The fixtures are not evidence of production engagement, content quality or service reliability.

## Review and integrity

The raw manifest keeps the capture-time `inspection: pending` field. The separate inspection record records subsequent visual review without changing capture originals. Review uses contact sheets across every captured image plus full-size views and selected segments of very long pages. It checks that the intended interface rendered, distinguishes diagnostic failures from usable evidence, and records superseded or unverified states. Detailed visual scoring belongs to Step 4.

A passed Playwright wrapper is not proof of complete state coverage: it deliberately continues after a scenario failure to preserve diagnostic images. Failures are enumerated in each manifest. Diagnostic captures remain in the archive and are excluded from selected audit evidence. The coverage file and review notes determine what is usable.

Run from a repository checkout:

```bash
python design-upgrade/verify_baseline.py
```

This verifies PNG signatures, original dimensions, file size, SHA-256, unique capture IDs, expected viewports and evidence links. The capture scripts and workflow history preserve the method; GitHub Actions artifacts are transfer copies with an expiry, not the permanent record.

The workflow `.github/workflows/design-baseline-capture.yml` is retained with a manual trigger. `capture-tools/selection.json` selects the most recent focused scenarios; an empty array selects the full suite. Before a future run, verify the release/source pin and update the scope intentionally. The source-diff assertion deliberately stops a run when application source has changed, preventing a new release from silently entering this baseline. Regenerate the catalog only after adding the inspection records:

```bash
python design-upgrade/generate_catalog.py --inspection-file design-upgrade/evidence/baseline/inspection.json
```

## Scope limits

- These are two responsive Chromium viewports, not physical iOS/Android or cross-browser tests.
- External Google account choosers, native print/save dialogs, OS permissions and installation prompts are outside the GTOP-rendered interface. The application screens around those actions are the design scope.
- Transient loading indicators, hover frames and every motion sequence are not an exhaustive state machine. Interaction/motion evaluation requires a running application in the relevant later stage.
- Live authenticated production data is not represented by the synthetic fixtures. Integration behavior must be validated when implementing accepted changes.
- No existing screen has a premium-quality score yet. Step 3 establishes the reference set; Step 4 applies the calibrated criteria to this baseline.
