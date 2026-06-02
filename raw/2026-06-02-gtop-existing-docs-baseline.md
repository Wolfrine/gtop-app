# Raw Note - 2026-06-02 - GTOP Existing Docs Baseline

## Source

Initial wiki setup pass over the GTOP repository.

Primary source documents:

- `README.md`
- `AGENTS.md`
- `docs/01_System_Overview.md`
- `docs/02_Functional_Spec.md`
- `docs/09_User_Manual_Students.md`
- `docs/10_User_Manual_Teachers_Admins.md`
- `docs/11_Glossary_and_Domain_Concepts.md`
- `agent_live_quiz_plan.md`
- `agent_uiux_plan.md`

## Context

GTOP needed a project-local LLM wiki aligned with the PTI wiki protocol and Karpathy-style LLM wiki pattern. The repo already had technical and functional docs, but no business/product wiki, no raw source-material folder, and no local wiki-curator skill.

## Key Points

- GTOP stands for Growth Tutorials Objective Practice.
- The product is an Angular/Firebase quiz application for MCQ practice, reports, live quiz sessions, quiz runs, and admin content management.
- Students sign in with Google, choose board and standard, take quick or custom quizzes, view summaries and reports, retry questions, flag question issues, and join live quiz or quiz run experiences.
- Admins manage MCQs, syllabus combinations, users, logs, live quiz hosting, and related operational views.
- Institute Admin is mentioned as planned, but no dedicated route or product workflow currently exists.
- GTOP should remain an independent production application, not a Hub submodule.
- Hub integration should stay contract-based through URL parameters and return paths.
- The existing `docs/` folder contains technical, functional, user-manual, deployment, and glossary documentation.
- Live Quiz is a hosted real-time quiz event.
- Quiz Run is a lighter competitive practice mode that reuses live quiz concepts but should avoid unnecessary admin-host assumptions.
- The UI/UX roadmap highlights learner journey improvements, admin tooling, feedback loops, and launch readiness.

## Decisions

- Create a minimum viable GTOP wiki rather than a large folder taxonomy.
- Keep product/business knowledge in `wiki/`.
- Keep implementation and architecture details in `docs/` and engineering plans.
- Use `raw/` for source material before curating durable wiki updates.
- Add local wiki rules and a curator skill so future agents can maintain the wiki consistently.

## Open Questions

- What is the exact product definition for Institute Admin?
- How should GTOP model student mastery and recommended next practice beyond summaries, reports, and retries?
- How should Live Quiz and Quiz Run be positioned in student/admin-facing language?
- What should the full admin workflow be for resolving flagged questions?
- How much Growth Tutorials ecosystem navigation should GTOP expose while remaining standalone?

## Suggested Wiki Integration

- Update `wiki/Home.md` as the main product map.
- Seed `wiki/Intent.md`, `wiki/Users.md`, `wiki/Problems.md`, `wiki/Features.md`, `wiki/Decisions.md`, and `wiki/OpenQuestions.md`.
- Avoid creating separate pages for every route, service, or implementation detail.
