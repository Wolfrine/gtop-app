# Plan and stage boundaries

Recorded 8 October 2026. Scope: public, learner and admin GTOP experiences. Current behavior is evidence; previous visual directions are not constraints. Existing product intent remains available in [wiki/Intent.md](../wiki/Intent.md) and [wiki/Users.md](../wiki/Users.md).

| Step | Tools and activity | Deliverable and completion check | Limits and treatment | Status |
|---|---|---|---|---|
| 0. Resolve readiness | GitHub source access, browser controls, Playwright capture through an isolated Actions job, Firebase emulators | Demonstrate live desktop/mobile capture, learner/admin fixtures, representative and dense states, evidence persistence and a reference-access path | Distinguish synthetic/live data. Inspect captures for incomplete loading. Browser emulation and static images retain their stated limits | Technical paths verified |
| 1. Establish evaluation criteria | Written framework, current product purposes, explicit scoring anchors | Separate visual craft and journey quality; define evidence requirements, score bands, exceptions and stage gates | Final benchmark calibration follows reference inspection in Step 3; ratings follow reference calibration | Framework defined: [criteria v1.1](evaluations/criteria.md) |
| 2. Gather sitemap and baseline | Routes, components, role guards, live UI, Playwright and isolated fixtures | Inventory every screen and applicable state; desktop/mobile captures with role, route, data state, viewport, date and release; coverage matrix with explicit gaps | Public navigation alone is insufficient. Verify dialogs, tab states, errors, empty and busy states. Record inaccessible views without inventing evidence | Complete with [user-approved Action Plan exclusion](evidence/baseline/review.md) |
| 3. Inspect premium references | Web search, primary source links, live browser inspection, captures and interaction observations | Focused reference set spanning expressive public sites and relevant learning/product/admin interfaces; transferable qualities for GTOP | Award labels and gallery thumbnails do not establish suitability. Replace incomplete references. Inspect motion separately | Complete; user accepted as on track: [findings and evidence](references/report.md) |
| 4. Analyze each GTOP screen | Rubric, baseline evidence, live journeys and benchmark pairs | Desktop/mobile scorecards with visible reasons, comparison evidence, confidence, strengths and prioritized findings | Keep unknown dimensions unscored. Separate design judgments, functional defects and unverified hypotheses | Complete for review: [screen ratings and findings](evaluations/2026-10-09/README.md) |
| 5. Create mockups | Image generation/editing, exact copy, behavior notes, precise editable layout where needed | Begin with a learner screen and admin screen. Review direction, then extend shared visual rules across the inventory. Preserve revisions and user feedback | Inspect generated text and repeated controls. Images cannot establish interaction, responsiveness or accessibility. User acceptance required before development | Pending evaluation review; [brief prepared](evaluations/2026-10-09/step-5-brief.md) |
| 6. Develop accepted designs | Angular/Firebase source, GitHub, existing CI, browser and journey validation | Implement agreed screens; compare rendering with accepted mockups; verify repeated use, responsive layouts and relevant devices; release through the established workflow | Build success does not prove visual fidelity. Physical-device and interaction validation occur here. Production deployment requires authorization | Pending accepted designs |

## Completion rules

- A saved screenshot is evidence only after it has been inspected for loading artifacts, missing imagery, wrong roles and incorrect states.
- Step 2 is complete only when every inventory entry has the required captures or an explicit, accepted exclusion. Coverage percentage is withheld until the inventory exists.
- Step 3 calibrates the scoring anchors before Step 4. Changes to weights or anchors require a new rubric version; rescore affected screens consistently.
- Each Step 4 finding points to an exact capture or observed interaction and gives a practical consequence.
- Step 5 preserves exact content and behavior alongside the images. The user accepts the direction and required screen/state coverage.
- Step 6 checks visual fidelity, keyboard/focus behavior, contrast, motion preferences, error recovery and relevant browser/device behavior.

## Scope of the current delivery

Step 4 is complete for review: all 39 included route entries have separate desktop/mobile visual ratings, supported by 171 associated state pairs and named reference properties. Ten bounded journey assessments retain unknown dimensions and withhold overall totals. See [the evaluation](evaluations/2026-10-09/README.md) and [Step 5 brief](evaluations/2026-10-09/step-5-brief.md). No mockups or application changes have been made.

Step 2 records the sitemap, current desktop/mobile rendering, state coverage and unresolved gaps. Captures and documentation are published to `main` under the user's delivery authorization. Changes are confined to `design-upgrade/` and the dedicated capture workflow; application source is unchanged. The workflow is retained for manual reproduction. On 9 October 2026 the user excluded the unused Action Plan page. Its loading failure no longer blocks Step 2, which is complete for the agreed scope. Existing evidence is retained; no repair or redesign of that page is required.

## Intrinsic limits

Taste requires judgment and user acceptance. Image mockups can distort copy. Screenshots cannot demonstrate motion or behavior. Chromium mobile emulation cannot demonstrate physical iOS/Android behavior. Synthetic fixtures do not establish real-user outcomes. Each limitation has an evidence or validation check at the relevant stage rather than a claim that it has disappeared.
