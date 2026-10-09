# Step 2 review and accepted scope

Reviewed 9 October 2026. This records evidence quality and coverage, not premium-design ratings. The [paired gallery](../../sitemap/gallery.md) is the screen-by-screen entry point; [coverage.json](../../sitemap/coverage.json) and [baseline-catalog.json](../../screens/baseline-catalog.json) provide the machine-readable index.

## What the coverage establishes

Every one of the **40 concrete route entries / 39 distinct URL patterns** has an inspected desktop and mobile capture of an actual rendered screen. This includes the public entry, practice and live quiz journeys, learner profile/dashboard/reports, both learning labs and their results, and the full admin route set. Shared components and route aliases remain individually listed. Dialogs, editors, responsive navigation, populated/empty results, paper statuses and completion states are additional evidence states.

**Step 2 is complete for the agreed scope.** On 9 October 2026 the user confirmed that the Action Plan page is not in use and may be ignored. Excluding R23 leaves 39 route entries / 38 distinct URL patterns in the design-upgrade scope. The full historical route inventory and original evidence remain intact. This exclusion closes the only recorded state blocker; it does not claim that the loader was repaired.

## Collection totals

| Measure | Verified result |
|---|---:|
| Concrete route entries with desktop and mobile evidence | 40 / 40 |
| Distinct URL patterns | 39 |
| Original PNGs across four runs | 491 |
| Isolated application originals | 483 |
| Live-public landing originals | 8 |
| Selected state/viewport records | 346 |
| Paired capture state IDs | 173 |
| Originals excluded from audit selection | 58 |

State IDs include intermediate and scenario-end captures; they are not 173 different product screens. Original counts include retries and diagnostics. The 58 exclusions comprise 48 scenario diagnostics and 10 images rejected after visual/state review. All original PNG checksums and dimensions, selected evidence references and local gallery links were verified. [Run provenance and archive checksums](runs.json) preserve the exact capture-tool revisions.

| Run | Isolated PNGs | Live PNGs | Failed scenario/viewports | Result |
|---|---:|---:|---:|---|
| [37883706813](https://github.com/Wolfrine/gtop-app/actions/runs/37883706813) | 211 | 2 | 32 | Broad inventory capture; originals and diagnostics retained |
| [37885730251](https://github.com/Wolfrine/gtop-app/actions/runs/37885730251) | 158 | 2 | 10 | Route coverage completed; supplemental controls/states captured |
| [37886910772](https://github.com/Wolfrine/gtop-app/actions/runs/37886910772) | 48 | 2 | 6 | Paper preview completed; Action Plan failure isolated |
| [37887727775](https://github.com/Wolfrine/gtop-app/actions/runs/37887727775) | 66 | 2 | 0 | Remaining selected lab and admin journeys completed |

The last run selected only seven outstanding capture scenarios. Its zero failures do not erase the Action Plan diagnostic history; the user's later exclusion resolves the stage boundary.

## Accepted exclusion: unused Action Plan

User decision, 9 October 2026: “Action plan page is not in use so can ignore it.” The evidence below is retained as history. No repair, additional capture, evaluation or mockup is required for this page in the current scope.

Both viewports show **Action plan unavailable**. The create-activity form is captured, but existing activity cards, expanded acceptance criteria, edit-existing and filtered-empty state cannot be reached through the unchanged application in this environment.

In run [37886910772](https://github.com/Wolfrine/gtop-app/actions/runs/37886910772), an authenticated admin read against the emulator's normal Firestore rules returned all four seeded plans. See [action-plan-direct-read.json](2026-10-09/37886910772/action-plan-direct-read.json). The browser console reports:

```text
Unable to load GTOP action plans FirebaseError: Expected type '_Query', but it was: a custom _CollectionReference object
```

The [raw manifest](2026-10-09/37886910772/manifest.json) preserves the console error and failure at the edit-existing control. Re-authentication and reloading did not resolve it. The UI's generic permission text does not establish a rules denial: the direct rules read succeeded. The observed query-object compatibility error remains uninvestigated beyond these checks because the page is now excluded. Its cause and production impact are not yet established.

If the user later restores this page to scope, investigate its loader and capture the populated cards, expanded criteria, edit-existing and no-matching-activities states on both widths. Preserve these originals and identify any changed source revision. This follow-up is not required for the current initiative.

## Capture corrections and review notes

| Area | Finding and treatment |
|---|---|
| Fixture login and headings | Corrected capture base URL and selectors for visible headings; route redirects are retained but do not prove the requested route rendered. |
| Live lobby/active states | Gave future lobbies a stable start window and active sessions a past start. Earlier mislabeled lobby/player captures are excluded. |
| Mobile navigation | Full-page resizing closed the drawer. Recaptured the actual open drawer as a viewport image. |
| Dialogs | Use viewport capture for visible overlays; a full-page stitched backdrop could misrepresent a modal. Dialog content with its own scroll position is labeled. |
| MCQ import | Corrected the synthetic JSON to the real curriculum schema. A success snackbar caused a clipped viewport capture; those earlier images are excluded. Run 4 provides the unobscured preview on both widths. |
| Paper generator | Desktop container layout exposed the compact action bar. Capture follows the visible control; both widths reached the real generated draft preview. |
| Electricity lab | Native keyboard input changes the slider value and visible simulation. Waits now follow rendered state rather than the native radio's transformed value. The complete journey, grading and practice completion are captured at both widths. |
| Plant lab | Corrected transient completion-text waits, duplicate button labels and responsive action substitutions. All five missions, notebook, assessment and practice completion were captured at both widths. |
| Saved papers | A desktop capture was labeled empty before its query finished. The original image already shows a draft; inspection corrects its catalog label, preserves the raw record and pairs it with the populated mobile capture. The final helper now waits for loading to finish. |
| Repeated sessions | Desktop/mobile share a controlled account and run sequentially. A submitted quiz answer can already be locked in the mobile journey. State notes retain this difference. |
| Very long pages | Full-page originals are retained, including the dense syllabus review. Review includes overviews plus selected full-size top/middle/bottom sections; it is not a line-by-line content audit. |
| Runtime console | External Google One Tap resources are deliberately blocked in emulator journeys. Associated console errors do not establish a GTOP production login fault. The Action Plan query error is recorded separately. |

All original capture failures remain in the manifests. A green workflow run only means the capture wrapper finished; it deliberately continues after individual scenario failures. Selection follows inspection metadata, not the workflow badge. No app source, theme or behavior was modified to make a screenshot pass.

## Review depth and remaining validation

The root reviewer inspected the contact-sheet overview of each image, inspected flagged diagnostics and overlays at full size, and sampled sections of long pages. The [inspection record](inspection.json) identifies usability exclusions and notes per capture. Static-image review checks intended rendering, assets, role context and layout state. It is not the screen evaluation promised in Step 4.

No captured image reported a broken image or horizontal document overflow in its metadata, and no uncaught page error was recorded. These checks are limited to the captured moments. Console errors, independent scroll containers, full-page stitching and unreachable states have the qualifications above.

The two viewports are Chromium at 1440 × 1000 and 390 × 844. Physical devices, other browsers, external Google/native print/install surfaces, exhaustive transient loading frames and every data permutation are outside this capture contract; see the [method](README.md). Authenticated data is synthetic. The live public landing was also captured independently, with the deployment's version record.

Step 3 is now ready to gather the premium reference set. Screen ratings, mockup direction and design acceptance remain pending.
