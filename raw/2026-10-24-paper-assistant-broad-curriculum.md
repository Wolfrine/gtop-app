# Raw Note - 2026-10-24 - Paper assistant capability and curriculum expansion

## Source

Sachit's direct instructions in the GTOP local bot conversation on 24 October 2026.

## Context

The local assistant incorrectly said it could only explain an existing Class 12 Chemistry paper. That subject and class were a test case, not the product boundary.

## Key Points

- The assistant must describe the capabilities of the complete service, including work delegated to Codex.
- User: "using gtop mcp, all the necessary curriculum is already present, additionally set up a process to look at latest one online on request."
- User: "it should contain all the boards and standards from 5th to 12th."
- GTOP's saved curricula should be reused. An online check is an explicit user-requested operation, not a claim that all saved material is already current or complete.
- Review identified that programme, level and examination cohort can change the applicable curriculum. Missing details must be clarified rather than guessed.

## Decisions

Question Paper Creation serves the configured GTOP boards and Classes 5–12, with the appropriate programme. Class 12 Chemistry is no longer the assistant's stated scope. Conversation remains natural in English, Hindi and Hinglish, while substantial creation and source review are delegated and actual progress is tracked.

## Open Questions

Real classroom suitability, completeness for every board/subject/edition, and Aparna's acceptance require actual use and teacher review. This expansion is not evidence of universal official curriculum coverage.
