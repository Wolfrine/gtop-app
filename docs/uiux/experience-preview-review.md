# GTOP experience preview — review record

Status: founder approved this exact version for production on 2026-09-05; the visual-quality objective remains unfinished.

## Working preview

- URL: https://dev-gtop-app.web.app/dashboard (normal GTOP sign-in).
- Review branch: `codex/v1-ui-review`.
- Candidate: `f9fae1a32e6040244f0f7d726f86854703f40f83`.
- Small commits: `17a59c7` shared identity, `7bdaa5d` learner journey, `f9fae1a` rendered-layout refinements.
- Successful deployment: GitHub Actions run `33979367215`.
- Verified served assets: `main-S457YGHC.js`, `styles-ZXQSLVT7.css`.

## What changed

The V1 dashboard now has a cobalt practice focal point, original book/orbit artwork, a warm paper canvas, an ink-blue navigation rail, sunlight actions, and a mint progress destination. Manrope typography and a simple book-spine brand mark connect the shared shell to the learner pages. Recent attempts and group practice have distinct treatments.

The quiz uses a focused paper surface, readable question hierarchy, horizontal answer rows with letter markers, explicit selection feedback, and a clear next action. Results separate the score overview, retry actions and detailed answer review. Correctness remains expressed with icons and text as well as colour.

Custom Quiz retains its existing controls and layout with the shared font. The optional practice-together guide is a native disclosure. All existing destinations remain available.

## Fixed-criteria assessment

| Dimension | Observed evidence | Limit |
| --- | --- | --- |
| Visual appeal | Stronger focal point, deliberate colour contrast, original artwork and varied section treatments are visible beside the baseline. | Founder rates this version 5–6/10, up from 2/10; visual quality remains below target. |
| Identity | The same paper, ink, cobalt, sunlight and typography direction spans dashboard, quiz and results. | Broader page-specific rollout is pending. |
| Learning appeal | Inviting entry, focused question state, constructive results language and visible retry actions. | No learner feedback or learning-outcome claim yet. |
| Clarity | Quick/Custom Quiz, progress and group-practice destinations remain explicit; score and answer review have separate hierarchy. | Existing question text sometimes includes raw Markdown markers and embedded question numbers. |
| Usability | Dashboard, quiz and summary fit 360/390/768/1024 px widths; desktop inspected at the available viewport. Native keyboard choice and progression work; answer rows measure 62 px on desktop and 68 px in the checked 360 px layout. | Width simulation does not establish physical-device, keyboard or touch-performance behaviour. |
| Reliability | Production build, source contracts, normal/custom navigation, answer progression, saved summary, filtering and retries pass the relevant checks. No application TypeScript changed in this phase. | Existing service/data issues and live multi-user operation were not changed or certified. |

The 9/10 ambition in the experience brief remains the quality target. The founder considers the version effective and working, but points to excess forced wording, insufficient imagery and a lack of intuitive design and memorable effects. A passing build does not resolve that gap.

## Validation evidence

- Production build passed without relaxing budgets; initial bundle approximately 2.32 MB. Existing 2 MB advisory and component advisory warnings remain. Error thresholds pass.
- `GTOP_UI_BASE_REF=c02c29e node gtop-app/scripts/ui-contracts.test.cjs` passed. Against the last standardisation checkpoint, this phase changes no TypeScript.
- ICSE Standard 10 Science custom quiz loaded three actual questions. Next was disabled before choice, enabled after choice, and reset at question two.
- Existing five-question saved Geography result displayed 3/5 and 60%; the incorrect-only filter reduced five panels to two. Existing explanations and answer values remained visible.
- Retry Incorrect opened two questions; Retry Entire Quiz opened five. Space selected a native answer button and progressed with Next. No test attempt was submitted or saved.
- At 360/390/768/1024 px, checked child-document widths were 345/375/753/1009 px respectively, with the remaining 15 px used by the browser scrollbar; no unintended horizontal document overflow.
- Render review caught and corrected dark sidebar icons, excessive illustration cropping, inherited column layout on answer buttons, and answer-panel spacing/font inheritance.

## Remaining limits and handoff

- Founder explicitly approved promotion of the reviewed candidate to production. The merge must retain the exact reviewed application bytes and the existing small-commit history. Production completion requires the main workflow and served-bundle check.
- The dashboard's existing Last Score selection discrepancy remains. The hint says 'Recorded session score'; the calculation was not changed.
- The existing question screen briefly shows 'Question 1 of 0' while remote questions load. This is an existing loading-state limitation, outside the presentation-only scope.
- Stored question content can contain Markdown markers and duplicate question-number prefixes. Improving rendering/content quality requires a separate scoped change.
- Action Plan still reports 'Action plan unavailable' and asks a Firebase administrator to allow admin access to the actionPlans collection. No coordination update was claimed. This record is the execution checkpoint until access is restored.
- Review screenshots were supplied for desktop dashboard, quiz, results and phone dashboard. The phone screenshot uses the app's existing responsive review frame; data is the authenticated user's actual existing data.

Further changes are proposed in `docs/uiux/visual-next-steps.md`; they are not included in this promotion. The current release accepts progress while retaining the 9/10 ambition.

