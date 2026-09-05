# V1 UI standard

Approved by the founder on 5 September 2026. Improve the existing application through small commits directly to main. Preserve routes, role visibility, calculations, validation, bindings, and saved-data operations. Work in the existing Angular 17 app.

## Visual direction

- Keep GTOP blue, white surfaces and a light neutral page background. Use green, amber and red for meaningful states. Keep lesson diagrams useful and legible.
- Use the existing font stack with a clear page-title, section-title, body and supporting-text hierarchy. Body text should normally be at least 14px; controls should use readable labels rather than widely spaced capitals.
- Use 4, 8, 12, 16, 24 and 32px spacing. Standard page padding is 24px on desktop and 16px on phones, with 12px reserved for very narrow layouts.
- Give the primary task the strongest visual emphasis. Keep supporting guidance and promotions subordinate to actions and progress.
- Prefer quiet borders and restrained shadows. Use a 12px standard card radius, 8px control radius, and pill shapes only for compact status/category labels.
- Use predictable primary, secondary and destructive buttons. Preserve disabled/selected states. Target at least 44px touch height for ordinary interactive controls.
- Allow names and text to wrap. Use min-width: 0 for flexible columns. Scroll data tables within their own labelled region, not the whole document.
- Existing navigation switches mode at 768px; preserve this behaviour. The responsive preview must check both sides of this boundary.

## Vocabulary

Use **Dashboard**, **Quick Quiz**, **Custom Quiz**, **Live Quizzes**, **Quiz Runs**, **Progress**, **Learning Lab**, and **UI Preview** consistently for the same destinations/tasks. Keep distinct existing quiz modes and their underlying identifiers. Use sentence case for supporting copy and explicit verbs for actions.

## Content

Describe actual actions and capabilities. Remove expired promotions and unsupported guarantees. Keep educational questions, answers and scoring intact. Clarify number formats and units without changing their calculations. Loading, empty, failure and zero-result states must remain distinguishable.

## Approved improvement inventory

Theme; palette; typography; placement/hierarchy; layout/density; spacing/alignment; navigation; naming; content/tone; content accuracy; buttons/links; forms/dialogs; cards/lists/tables; charts/metrics; icons/illustrations/badges; feedback/notifications; mobile/accessibility.

## Delivery and checks

1. Capture the current screen and relevant interactions. Name the exact visual problem and affected surfaces.
2. Make a scoped presentation change. Review event bindings, route targets, conditions, input values and service code for unintended changes.
3. Run the production build and relevant existing checks. Review the actual app at 360, 390, 768 and 1024px using the admin UI Preview.
4. Commit directly to main and wait for its deployment. Verify the served build and changed UI before the next visual change.
5. Revert the individual commit if a regression is introduced. Do not stack speculative fixes on a broken release.

The responsive preview is a same-origin frame of the real app, using normal account access. It has no auth bypass, mock data or backend adapter. Interactions inside it can save real data. Only one frame is opened on request, and closing it releases the embedded page. It checks real CSS breakpoints and browser interaction, not physical-device performance or virtual keyboards.

## Known baseline limitations

- The authenticated Action Plan cannot read actionPlans under the deployed rules. Delivery notes are kept in this repository until that permission issue is resolved.
- The existing version prompt advertises v2.0.2 while V1 is live. Its triggering/update logic is outside this visual scope.
- Existing starter-template tests are not sufficient functional evidence. Use targeted journey checks and compare actual bindings.
- Existing browser tabs may retain an old service-worker bundle after deployment. Verify a fresh tab as well as the currently open one.
