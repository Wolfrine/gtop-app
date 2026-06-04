# GTOP Wiki Home

GTOP, Growth Tutorials Objective Practice, is a practice and assessment product for students preparing through MCQ-based learning. It is not only a quiz app or a question store. The product bet is that a trusted MCQ bank, consistent student usage, and AI-assisted diagnosis can turn Growth Tutorials practice into a repeatable learning loop that helps students know what to do next.

This wiki is not the technical documentation. Technical details remain in `docs/`, app code, configuration, and implementation plans. The wiki should help future human and LLM agents understand the GTOP product before proposing or building changes.

## Product Map

GTOP's [[Intent]] is to turn Growth Tutorials practice into a structured, trackable, quiz-first learning experience. It supports [[Users]] such as students, admins, teachers, and future institute administrators, with major unresolved product choices tracked in [[OpenQuestions]].

The current product centers on these [[Features]]:

- Authenticated student onboarding by board and standard.
- Quick and custom MCQ practice.
- Quiz summaries, reports, retries, and question flagging.
- Admin question-bank and syllabus management.
- Question-bank enrichment for coverage, metadata, and learning diagnosis.
- Live Quiz and Quiz Run experiences for synchronous or competitive practice.
- Emerging AI-assisted student feedback concepts such as Student Pulse.
- Growth Tutorials brand positioning and learner-facing landing flows.

The main [[Problems]] are about helping students practice consistently, helping admins maintain trustworthy question content, turning quiz data into useful learning guidance, and giving Growth Tutorials a product surface that is independent from Hub while still able to return users through a contract-based integration.

## Current Product Direction

The founder urgency in the latest source material is clear: GTOP cannot stop at "we built MCQ features, now market them." The product has to reason from what students already get, what AI now makes possible, and how education may change over the next decade.

The near-term strategic anchors are:

- Question-bank quality: the existing large question bank needs verification, coverage awareness, and continuous improvement.
- Ongoing enrichment: GTOP should add missing content and improve existing content as a recurring operating habit, not a one-time cleanup.
- Student usage: advanced analytics and personalized feedback only matter if students practice consistently enough to create signal.
- Learning diagnosis: reports should move from score display toward strong-area, weak-area, topic, and next-practice guidance.
- AI-assisted feedback: AI belongs where it improves question classification, topic tagging, weak-topic explanation, and personalized student guidance.
- Future-ready education: GTOP should prepare for AI-native learning expectations while preserving the discipline and trust of structured MCQ practice.

## Current Decision Anchors

The strongest current [[Decisions]] are:

- GTOP is an independent production application, not a Hub submodule.
- Hub integration stays contract-based through URL parameters and return paths.
- The project wiki captures business and product logic only.
- Existing `docs/` remains the technical and functional documentation base.
- Quiz Runs reuse live quiz infrastructure but represent a lighter peer-to-peer practice mode.
- Question-bank quality is an ongoing product capability, not a one-time cleanup.
- Student Pulse is an exploratory bet around personalized feedback, not a committed visual-report format.

## Source Notes

This map is seeded from:

- `raw/2026-06-02-gtop-existing-docs-baseline.md`
- `raw/2026-06-03-gtop-ai-meeting-notes-question-bank-pulse.md`
