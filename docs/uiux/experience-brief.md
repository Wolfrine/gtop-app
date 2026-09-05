# GTOP experience brief — Curiosity and momentum

Status: founder approved this version for production on 2026-09-05; visual appeal remains 5–6/10. See [review evidence](experience-preview-review.md) and [proposed next steps](visual-next-steps.md).

## Objective

Make GTOP a visually distinctive, inviting learning product for classes 5–12, where starting practice feels appealing, progress feels meaningful, and existing functionality remains dependable.

The quality ambition is near-excellent (9/10) for every experience dimension. Scores are subjective review aids, not measured learner outcomes. A 10/10 claim requires exceptional execution and corroborating learner response; do not award it from a successful build. Do not average away a weak dimension.

## Scope and delivery

Impact: learner dashboard → quiz question → results on the existing V1, with supporting shared header/navigation and Custom Quiz dialog styling.
Discovery: the owning repo, actual authenticated app, existing question/result content, and public primary design references. Existing services, authentication, account roles, scoring, validation, timers and saved-data operations remain exact.
Deliverable: working development preview, desktop/mobile evidence, fixed-criteria review and a source-backed design rationale. Present the concrete direction for founder review before promoting these visual changes to production. Keep code in small, reviewable commits.

## Acceptance criteria fixed before work

| Dimension | Target evidence |
| --- | --- |
| Visual appeal | A clear compositional focal point, deliberate colour and typography, original learning artwork, differentiated section treatments. The improvement should be apparent beside the current screen without an explanatory sales pitch. |
| Identity | A coherent blue/ink, warm-paper and sunlight palette, recurring orbital/geometric motifs and consistent control treatments on all three screens. |
| Learning appeal | Inviting entry, a calm and legible question state, constructive results language and visible retry/review actions. No invented rewards, streaks, recommendations, mastery or progress. |
| Clarity | Quick Quiz and Custom Quiz remain easy to distinguish; all existing task destinations remain available. Metadata is supporting information, not the title. Results distinguish score, answer review and retry. |
| Usability | 360/390/768/1024 px layouts fit; desktop reviewed at the available full viewport; no unintended document overflow; readable long questions; keyboard answer selection and next action; 44px touch targets. |
| Reliability | Existing route targets, handlers, conditions, input bindings, calculations and data operations survive source comparison. Verify normal navigation, custom selection, question choice/progression and an existing saved result. No saved test data needed. |

## Design direction

Curiosity and momentum: deep ink-blue navigation, bright cobalt practice area, warm paper canvas, sunlight accents, quiet mint for learning feedback. Manrope headings and controls introduce a confident rounded character. Original book/orbit/idea artwork belongs at the entry; the quiz stays focused on the question. Results use supportive language and colour with explicit correctness symbols. Avoid an identical bordered card around every fragment.

Use the real profile and existing metrics. The current Last Score calculation discrepancy remains outside this visual scope and must not be presented as fixed. Do not imply that a styled result proves learning gains.

## Reference benchmarks

- [Duolingo: Elevating craft](https://blog.duolingo.com/core-tabs-redesign/) — study purposeful visual character, differentiated headers, and balancing simplicity with clarity. GTOP will not copy its mascots, reward economy or interface.
- [Brilliant: About](https://brilliant.org/about/) — study visual explanation and focused concepts as learning design principles; use GTOP's own content and capabilities.

These sources inform design decisions. They do not establish that GTOP will achieve the same learner response.

## Review and release gate

Capture current and proposed screens. Review every criterion before requesting founder approval; state any remaining weakness plainly. The preview is ready only when the production build and relevant functional contracts pass and the actual rendered mobile/desktop journey has been checked. The founder approved release of this exact version on 2026-09-05 while rating visual appeal 5–6/10 versus 2/10 before. That approval does not complete the visual objective. Further visual work follows the proposed next-step plan and the same review criteria.

## Coordination

Action Plan remains unavailable under deployed actionPlans permissions. This document and the companion review record are the execution checkpoint. The reviewed application candidate is `f9fae1a32e6040244f0f7d726f86854703f40f83`; the release promotes its exact 13 UI files. The pre-promotion main checkpoint is `6eaed7285003a3ee59fffa6359370e953f3a0a87`. Confirm the production workflow and served bundle before reporting deployment complete.

