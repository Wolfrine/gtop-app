# GTOP Wiki Home

GTOP, Growth Tutorials Objective Practice, is a practice and assessment product for students preparing through MCQ-based learning. Its current [[Product Direction]] is to become a practice-intelligence product: trusted questions, repeated student usage, learning diagnosis, and AI-assisted feedback working together so students know what to practice next.

This wiki is not the technical documentation. Technical details remain in `docs/`, app code, configuration, and implementation plans. The wiki should help future human and LLM agents understand the product before proposing or building changes.

## Product Map

GTOP's [[Intent]] is to make Growth Tutorials practice easier to start, repeat, and understand. It serves [[Users]] such as students, admins, teachers, and future institute administrators, with unresolved product choices tracked in [[OpenQuestions]].

The core student model is the [[Practice Loop]]: choose relevant practice, answer MCQs, review the result, inspect reports, retry weak areas, and get clearer next-practice guidance. [[Live Practice]] adds social and competitive energy through Live Quiz and Quiz Run, but it should support the same loop instead of fragmenting it.

The strategic base is [[Question Bank Quality]]. The founder has also chosen comprehensive current-year curriculum coverage with source-backed admin preview and approval, so paper scope does not shrink to the questions already stored. A large MCQ bank only matters if it is correct, covered, tagged, and continuously improved. [[Learning Diagnosis]] depends on that base and on enough repeated usage to turn attempts into strong-area, weak-area, topic, and next-action signals.

For admin assessment work, the chosen [[Decisions]] now connect conversational paper requirements to bank reuse, automatic gap generation, notification and saved printable results. Manual question approval is removed from this chat-paper workflow; independent syllabus and learner-bank trust remain part of [[Question Bank Quality]].

[[Student Pulse]] is the clearest exploratory expression of AI-assisted feedback. It should remain grounded in diagnosis and should not overclaim certainty when student activity or question metadata is thin.

Learning Lab, described in [[Features]], adds a complete interactive electricity lesson to the product's teaching scope. Its first purpose is to give real learners something useful to try and to make their feedback observable; evidence of learning benefit is still to be established.

The high-level feature inventory lives in [[Features]], and the product tensions that should shape future work live in [[Problems]].

## Current Decision Anchors

The strongest current [[Decisions]] are:

- GTOP is an independent production application, not a Hub submodule.
- Hub integration stays contract-based through URL parameters and return paths.
- The project wiki captures business and product logic only.
- Existing `docs/` remains the technical and functional documentation base.
- Question-bank quality is an ongoing product capability, not a one-time cleanup.
- AI should serve diagnosis, content quality, and student feedback rather than novelty.
- Student Pulse remains exploratory until cadence, format, data requirements, and confidence rules are decided.

## Source Notes

- `raw/2026-06-02-gtop-existing-docs-baseline.md`
- `raw/2026-06-03-gtop-ai-meeting-notes-question-bank-pulse.md`
- `raw/2026-06-04-gtop-docs-code-education-direction-synthesis.md`
- `raw/2026-09-05-learning-lab-current-lab.md`

- `raw/2026-09-28-current-syllabus-and-paper-coverage.md`

- `raw/2026-10-04-paper-chat-bank-first.md`
