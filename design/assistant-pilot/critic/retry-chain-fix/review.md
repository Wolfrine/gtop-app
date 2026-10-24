# Focused retry-chain repair review

Parent's actual emulator QA identified multiple obsolete failure cards with active retry controls. Builder repaired the UI to show paper job actions only for `conversation.activePaperJobId` and provided an explicit localhost synthetic `retry-chain` state.

Critic independently opened that actual state at 1440×1000 and 390×844. Three historical failed attempts result in **exactly one** visible Try again button for the current task. Clicking it in the synthetic fixture transport changes to Waiting to begin, with **zero** Try again buttons and **one** Cancel request button. No obsolete failure surface competes with the current task. Screenshots are retained beside this note.

The focused visual repair passes. Layout, current-status hierarchy and responsive action usability remain **8.5** each; no new aesthetic uplift is claimed. This is targeted QA after the five-cycle review, not a fabricated extra design cycle. This state uses synthetic fixture data and does not establish live API retry semantics; parent owns that separate QA.

The source changed after the first final-candidate review. Rebind the final deployable build/source and this evidence before formal acceptance; do not reuse the old fingerprint unchanged.
