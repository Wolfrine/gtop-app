# Decisions

## Summary

This page records product and business decisions that should guide future GTOP work. Technical implementation decisions belong in `docs/` or engineering plans unless they materially affect product direction.

## Current Strategic Bets

GTOP's current product bets build on each other. [[Question Bank Quality]] enables better metadata. Better metadata enables [[Learning Diagnosis]]. Repeated student usage gives diagnosis enough signal. AI-assisted feedback becomes valuable when it helps students understand weak areas, strong areas, and next practice.

Future agents should treat these as strategic anchors: question-bank quality, ongoing enrichment, student usage, learning diagnosis, AI-assisted feedback, and future-ready education direction.

## GTOP Is Independent

GTOP is owned as an independent production application. It should not be treated as a Hub submodule.

## Hub Integration Is Contract-Based

Hub integration should remain contract-based through URL parameters and return paths. GTOP should preserve integration values such as `hubSource`, `hubSessionId`, and `hubReturnPath` when work touches quiz launch or summary flows.

## Wiki And Technical Docs Are Separate

The project wiki captures product intent, user problems, product logic, decisions, open questions, and implementation-independent lessons. Existing `docs/` captures technical and functional documentation.

## Concept Pages Are Now Part Of The Wiki Model

Durable product concepts should have standalone pages when they recur across source notes, docs, and product reasoning. [[Product Direction]], [[Practice Loop]], [[Question Bank Quality]], [[Learning Diagnosis]], [[Student Pulse]], and [[Live Practice]] are durable enough to stand as concept pages so index pages do not have to carry every strategic detail.

Admin content quality is durable, but it is currently best understood inside [[Question Bank Quality]] instead of a separate page.

Concept pages should read as stable product reference pages: definition, why the concept matters, current GTOP evidence, boundaries, relationships, and decision guidance. They should not read like transcript summaries or delivery plans.

## Quiz Runs Reuse Live Quiz Concepts

Quiz Run is positioned as a lighter peer-to-peer practice mode within [[Live Practice]], reusing the live quiz concept while avoiding unnecessary admin-host assumptions in the user experience.

## Question Bank Quality Is Ongoing

Question-bank improvement should be treated as an ongoing product capability rather than a one-time cleanup. GTOP needs both addition of missing content and improvement of existing content over time. The decision is product-level because a large, trusted question bank is the base for student trust, reports, topic diagnosis, and any serious AI-assisted guidance.

## Question Metadata Should Support Diagnosis

GTOP should enrich MCQs beyond chapter alignment when it improves learning diagnosis. Question type, question pattern, topic-level tagging, and multiple tags are product-relevant because they can support stronger weak-area and strong-area feedback.

## Student Pulse Remains Exploratory

[[Student Pulse]] is a product exploration area, not yet a finalized feature contract. The durable direction is personalized learning feedback; the unresolved details are cadence, format, minimum data requirements, confidence rules, and whether visual cards are worth the cost.

## AI Must Serve Learning Diagnosis

AI should be used where it improves GTOP's learning product: classifying question types and patterns, enriching topic tags, explaining weak topics in multiple ways, supporting content review, and producing concise student-specific feedback. AI novelty by itself is not a decision anchor.

## Start Interactive Learning With A Complete Lesson

The founder chose an interactive Growth Tutorials lesson because it creates an implementable output that other people can use and give feedback on. The initial scope is Current Lab inside the existing GTOP experience, with Learning Lab as a side-menu home available to all signed-in users. Further subjects should follow evidence from actual use rather than an expanding catalog of untested demonstrations.

Account-linked feedback must be described honestly. Results should help learners revisit an idea and help admins improve teaching, without presenting a small set of answers as proven learning gains. See [[Features]] and [[Learning Diagnosis]].

## Improve The Working Experience Incrementally

Repeated redesign attempts have reduced the founder's confidence in large interface replacements. GTOP should improve its existing experience through small, observable changes that preserve the working [[Practice Loop]]. Success means clearer tasks, consistent names, readable information and dependable interactions across screen sizes.

The chosen direction keeps the blue identity and light surfaces, gives primary actions clear emphasis, and uses a shared visual vocabulary for navigation, controls, content and feedback. Lesson-specific diagrams retain their teaching purpose within that vocabulary. Product claims should match current capabilities, and visual work must preserve account access, results and saved progress.

## Set The Experience Quality Bar Before Delivery

A consistent interface can still feel plain and uninviting. GTOP's intended experience is visually distinctive, attractive and encouraging for learners, with clear next actions and meaningful presentation of progress. These are explicit product outcomes alongside reliability, rather than presumed benefits of standardisation.

Define the desired quality before work and assess the result against that same bar. Representative learner journeys should demonstrate the intended character with actual content across screen sizes. An agent's implementation checklist or retrospective score does not replace the founder's judgment or evidence from learner use. Preserve the working [[Practice Loop]] while improving how it feels.

## Make The Experience Intuitive And Visually Memorable

The founder found the revised experience effective and working, but rated its visual appeal only 5–6/10 against 2/10 for the previous version. GTOP still needs stronger imagery, more intuitive composition and memorable visual details. Release approval can recognize progress while the intended quality remains unmet.

Communicate through recognisable actions, layout, imagery and useful feedback. Supporting words should answer a real question; repeated motivational slogans and explanations made the experience feel artificially constructed. Preserve warmth without surrounding familiar actions with unnecessary narration. Visual character should support the [[Practice Loop]] while the question itself stays calm and legible.

## Give The Public Landing Page Its Own Visual Direction

The public landing page should invite curiosity and make GTOP's existing learning experience easy to grasp. It can use richer backgrounds, original imagery, larger compositions and memorable motion while the actual question-solving experience stays calm and dependable. A sequence of visually distinct sections should communicate through demonstration and recognisable actions, with concise supporting words.

Generated artwork is an explicit part of the chosen direction, judged in the context of the complete page and across screen sizes. One attractive image does not establish a successful landing page. Iterate the composition, artwork and interactions together, preserving the working [[Practice Loop]] and making only supportable product claims. The founder has authorised autonomous landing-page implementation and release; the eventual quality judgment still belongs to the founder and learners.

## Future-Ready Education Direction Is A Strategy Question

GTOP should study what students may expect from education products over the next decade and use that thinking to shape product bets. This is a strategic direction, not a wiki todo list or a commitment to any specific AI feature.

## Source Notes

- `raw/2026-06-02-gtop-existing-docs-baseline.md`
- `raw/2026-06-03-gtop-ai-meeting-notes-question-bank-pulse.md`
- `raw/2026-06-04-gtop-docs-code-education-direction-synthesis.md`
- `raw/2026-09-05-learning-lab-current-lab.md`

- `raw/2026-09-05-incremental-ui-standardisation.md`
- `raw/2026-09-05-experience-quality-target.md`
- `raw/2026-09-05-visual-review-release-approval.md`

- `raw/2026-09-06-landing-page-visual-direction.md`
