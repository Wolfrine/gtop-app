# Independent UI prereview — 24 October 2026

Reviewer: `/root/ui_critic`. Candidate implementation not yet available at this review point. Owner acceptance remains unrecorded.

Guidance loaded: GT M3 reviewer; UI visual verifier; Central visual-design-director/critic, installed release **0.1.0**, Central base `ba1235fe7b220842778414f3f70fca38e7df4c53`. Source identifiers are from installed `release.json`; no newer guidance mixed into this review.

## Followed

The actual committed `docs/ai-assistant/prototypes/gtop-question-papers-multidevice.webp` was opened and inspected. Its useful reference mechanisms are a narrow recent-conversation rail, a dominant human conversation, an optional desktop paper preview, an inline real execution state, and distinct ready-paper actions. The tablet makes the printable document the main object. The phone keeps conversation and composer usable. This is a generated visual concept, not working application or genuine paper content.

## Not followed / implementation risks

No implementation has been rendered yet, so there is no implementation acceptance. Do not carry illustrative exam assertions, timestamps, completed checks, or unsupported attachments over from the concept. The 80-mark Chemistry output must say Growth Tutorials practice paper rather than imply the official board format. Do not expose model names, token or harness jargon to Aparna as routine product instructions.

## Most relevant M3 principles

- [Typography roles](https://material-web.dev/theming/typography/): distinguish title, body and label typography; prioritize readable working text.
- [Theming](https://material-web.dev/theming/material-theming/): use semantic color/surface roles, not decorative equal-weight cards.
- [Buttons](https://material-web.dev/components/button/): filled actions have greatest prominence; outlined/text afford secondary actions. Labels must name the resulting action.
- [Elevation](https://material-web.dev/components/elevation/): a small, deliberate surface hierarchy is sufficient. Avoid shadow creep.
- [Navigation drawer](https://m3.material.io/components/navigation-drawer/overview): relevant official navigation reference; the text extraction requires JavaScript, so no unsupported detailed specification is inferred from it.

## Required structural guidance supplied to builder

Retain desktop conversation rail + primary conversation + optional paper preview; collapse rail to an accessible phone drawer. The current decision should have one prominent action: send clarification/request, then View paper. Answers/Print remain secondary. Show only controller-recorded stage/availability facts with no invented percentage/ETA. Put mobile results in a readable dedicated document surface with an obvious return to conversation. Avoid attachment controls until attachments exist.

Critical dimensions declared before scoring:

1. **Layout/current-task clarity:** conversation or paper is the unmistakable main working object; no competing dashboard grid.
2. **Conversation/actual progress hierarchy:** latest real state is distinguishable from history and result; offline/queued/running/completed/error do not visually mislead.
3. **Responsive action usability:** desktop, tablet and phone preserve readable text, reachable actions, usable navigation/composer and no horizontal page overflow.

Each dimension must reach 8/10 with current rendered evidence and no material blocker. Agent review and owner approval remain separate. Required state coverage is empty, loading/working, offline, error, completed result and long conversation/document. Builder will supply local fixtures; all fixture data is synthetic and cannot establish live Firebase/Codex operation.
