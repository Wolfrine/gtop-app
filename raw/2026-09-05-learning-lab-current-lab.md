# Raw Note - 2026-09-05 - Learning Lab And Current Lab

## Source

Founder discussion in ChatGPT about producing a useful model-assisted output for Growth Tutorials, followed by approval of the Current Lab lesson prototype and a request to add it inside GTOP.

## Context

The founder wants meaningful work that people can use and respond to. Earlier open-ended research attempts produced vague, insufficiently grounded outputs. A small, complete interactive lesson gives real learners something concrete to try and gives Growth Tutorials feedback it can act on.

## Key Points

- The founder selected an interactive learning experience because other people can use it and their feedback can be observed.
- Current Lab teaches electricity through two initial predictions, three guided circuit experiments, five transfer questions, explanations, and learner feedback.
- The founder requested a new side-menu module accessible to all GTOP users, with a menu name and plan shared before implementation. Learning Lab was proposed as a reusable home for interactive lessons.
- The founder clarified that V2 is not live and everything had been reverted to V1. The existing V1 app is the implementation target; release mechanics belong in technical documentation.
- The proposed module uses GTOP sign-in and account-linked progress. Learners see their own attempts; GTOP admins see results and feedback. Feedback must not be described as anonymous when linked to an account.
- Initial scope is one complete lesson with an extensible catalog. There is no evidence of real student outcomes yet.

## Decisions

- Add interactive lessons inside the existing GTOP experience, in a side-menu module available to every signed-in role, regardless of selected grade.
- Begin with the accepted Current Lab electricity lesson and an explicit feedback loop.
- Keep learner results understandable and admin conclusions proportional to the observed evidence.

## Open Questions

- Does this lesson help actual learners explain the relationships, and which controls or explanations create friction?
- Which subject should follow once real usage and feedback are available?
- The latest-five-attempt retention limit is an initial implementation choice, not a long-term analytics policy.

## Suggested Wiki Integration

- Features: interactive lessons as an addition to the practice loop.
- Learning Diagnosis: predictions, experiments, answers and learner comments as bounded learning signals.
- Decisions and Home: complete, usable lessons with observable feedback as the first scope; avoid claiming learning gains without evidence.
