# GTOP Wiki Home

GTOP, Growth Tutorials Objective Practice, is a practice and assessment product for students preparing through MCQ-based learning. The wiki captures the product thinking behind GTOP: why it exists, which users it serves, which problems matter, which features carry the experience, and which decisions or open questions should guide future work.

This wiki is not the technical documentation. Technical details remain in `docs/`, app code, configuration, and implementation plans. The wiki should help future human and LLM agents understand the GTOP product before proposing or building changes.

## Product Map

GTOP's [[Intent]] is to turn Growth Tutorials practice into a structured, trackable, quiz-first learning experience. It supports [[Users]] such as students, admins, teachers, and future institute administrators, with major unresolved product choices tracked in [[OpenQuestions]].

The current product centers on these [[Features]]:

- Authenticated student onboarding by board and standard.
- Quick and custom MCQ practice.
- Quiz summaries, reports, retries, and question flagging.
- Admin question-bank and syllabus management.
- Live Quiz and Quiz Run experiences for synchronous or competitive practice.
- Growth Tutorials brand positioning and learner-facing landing flows.

The main [[Problems]] are about helping students practice consistently, helping admins maintain trustworthy question content, and giving Growth Tutorials a product surface that is independent from Hub while still able to return users through a contract-based integration.

## Current Decision Anchors

The strongest current [[Decisions]] are:

- GTOP is an independent production application, not a Hub submodule.
- Hub integration stays contract-based through URL parameters and return paths.
- The project wiki captures business and product logic only.
- Existing `docs/` remains the technical and functional documentation base.
- Quiz Runs reuse live quiz infrastructure but represent a lighter peer-to-peer practice mode.

## Source Notes

This initial map is seeded from `raw/2026-06-02-gtop-existing-docs-baseline.md`.
