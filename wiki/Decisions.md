# Decisions

## Summary

This page records product and business decisions that should guide future GTOP work. Technical implementation decisions belong in `docs/` or engineering plans unless they materially affect product direction.

## Current Strategic Bets

GTOP's current product bets build on each other. [[Question Bank Quality]] enables better metadata. Better metadata enables [[Learning Diagnosis]]. Repeated student usage gives diagnosis enough signal. AI-assisted feedback becomes valuable when it helps students understand weak areas, strong areas, and next practice.

Future agents should treat these as strategic anchors: question-bank quality, ongoing enrichment, student usage, learning diagnosis, AI-assisted feedback, and future-ready education direction.

The latest admin-assessment direction is Aparna's private conversational pilot. It supersedes the earlier scheduled-creator rhythm for the new journey; historical decisions remain context, not instructions to restart that service.

## Begin Conversational Paper Assistance With Aparna

Question Paper Creation becomes an independent sub-app while GTOP core retains objective practice. The first usable journey is a natural request, clarification, actual progress, printable questions, separate worked answers and a revision preserving the prior paper. Start with full-syllabus CBSE Class12 Chemistry as a custom80-mark Growth Tutorials practice paper, distinct from official70-mark theory.

The local model supplies continuous English/Hindi/Hinglish conversation and lightweight help; its harness supplies relevant context, verified tools and execution feedback; Codex supplies substantial generation and review. Original requests, corrections and verified requirements survive delegation. Model-written interpretations and approval claims cannot replace intent or authority. Routine permitted paper tasks proceed directly; development, deployment and destructive changes require Sachit's explicit approval.

Keep the earlier scheduled creator stopped and preserve data/access while replacing the experience gradually. The initial pilot uses original questions and teacher review, with bank integration and broader capabilities reserved for later decisions. Judge improvement through actual use and feedback rather than delaying the app for more pre-app model qualification. A demonstration remains distinct from academic approval or reduced workload. See [[Question Bank Quality]] and [[Intent]].

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

## Full-Syllabus Coverage Needs Independent Verification

The founder authorized a current-year curriculum catalogue spanning boards, standards, subjects and chapters, with source previews and administrator approval. The intended scope must be independent of the questions already available. Full-syllabus requests use the applicable reviewed curriculum; missing or unverified coverage remains visible rather than being silently omitted.

Human syllabus approval and question quality are separate trust decisions. The later chat-paper decision removes manual question approval from paper delivery, while preserving checked content and independent curriculum trust. Importing official material or requesting a paper is not approval of its accuracy. Preserve earlier approved scope when corrections are made, and retain direct access to established content-creation tasks as admin workflows evolve. See [[Question Bank Quality]].

## Paper Requests Become Conversations

The founder chose chat-based requirements because navigating priorities, completion and paper assembly imposed too much admin effort. A scheduled agent should reuse suitable bank questions, generate gaps and return a printable paper plus a separate answer key under the same stable paper record, retaining the requirement conversation as context, with notification and a complete saved-paper view. Runs occur every two hours from 8 AM to 8 PM India time.

Chat papers have no manual question-approval gate. Future flagging may support corrections, but it is not a condition for initial delivery. This decision changes the paper workflow without treating unchecked learner-bank publication or an incomplete syllabus as acceptable. Two or more urgent papers provide the immediate real-use context; a feature release alone does not prove paper quality or reduced admin workload. See [[Question Bank Quality]].

## Judge Paper Simplicity Across The Returning Admin Journey

The founder's correction makes the complete mobile admin lifecycle the quality bar, including a return after years and thousands of papers. Requirement discovery, discoverable submission status, scheduled-generation clarity, retrieval and revision belong to one experience. A stable paper identity connects the request and its outputs; pending changes must not remove access to the last completed paper and answer key. See [[Question Bank Quality]] and [[Problems]].

Assess that whole journey with realistic history volume. A promising design comparison, a first-request demonstration or an implementation checklist cannot establish final design acceptance or reduced admin effort. Labels for access, creator attribution, notifications and printable output must follow the service's actual capabilities.

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

Generated artwork is an explicit part of the chosen direction, judged in the context of the complete page and across screen sizes. One attractive image does not establish a successful landing page. Iterate the composition, artwork and interactions together, preserving the working [[Practice Loop]] and making only supportable product claims. The founder has authorised autonomous landing-page implementation and release; the eventual quality judgment still belongs to the founder and learners. The completed landing-page review was rated almost 8/10 by the founder, who called it substantially better and accepted the version for release. This validates the chosen visual direction for the public page; it does not establish learner outcomes or complete every future design improvement.

## Make Independent Exploration Visible And Safe To Repeat

The founder authorized a substantial Plant Reproduction improvement after finding unclear next actions and limited discoverability. The lesson should invite an immediate action, reveal its consequence and give a clear route onward while keeping alternatives available. Revisiting an experiment or closing a view should preserve the learner's discoveries.

Rendered desktop and phone inspection is an explicit quality requirement. Build success and scripted completion cannot substitute for seeing what the learner sees, and a blocked final visual check must remain an open validation item. This continues the experience-quality direction in [[Features]] without claiming measured child engagement or learning gains.

## Future-Ready Education Direction Is A Strategy Question

GTOP should study what students may expect from education products over the next decade and use that thinking to shape product bets. This is a strategic direction, not a wiki todo list or a commitment to any specific AI feature.

## Source Notes

- `raw/2026-10-24-conversational-paper-pilot-approval.md`

- `raw/2026-06-02-gtop-existing-docs-baseline.md`
- `raw/2026-06-03-gtop-ai-meeting-notes-question-bank-pulse.md`
- `raw/2026-06-04-gtop-docs-code-education-direction-synthesis.md`
- `raw/2026-09-05-learning-lab-current-lab.md`

- `raw/2026-09-05-incremental-ui-standardisation.md`
- `raw/2026-09-05-experience-quality-target.md`
- `raw/2026-09-05-visual-review-release-approval.md`

- `raw/2026-09-06-landing-page-visual-direction.md`

- `raw/2026-09-06-landing-page-release-acceptance.md`

- `raw/2026-09-06-plant-lab-guided-redesign.md`

- `raw/2026-09-28-current-syllabus-and-paper-coverage.md`

- `raw/2026-10-04-paper-chat-bank-first.md`
- `raw/2026-10-04-returning-admin-paper-journey.md`
