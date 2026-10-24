# Cycle 5 — frozen candidate and production access gate

Critic independently reviewed the running development application and separately served production build. Source/build/fixture binding and actual screenshot hashes are in `../candidate-manifest.json`. The builder declared source freeze before this review; any later material change requires affected-state verification.

## Followed

At `http://127.0.0.1:4318/?fixture=ready`, the production build shows the genuine unauthenticated sign-in gate, not synthetic signed-in content. Desktop 1440×1000 and phone 390×844 email form are readable, correctly labeled, and fit without horizontal overflow. No credentials were entered and no authentication claim is made. `production-signin-1440.png`, `production-email-390.png`.

At development `4317`, the frozen fixture UI retains a clear desktop conversation/paper split and a focused mobile conversation with separate document route. The latest revision remains dominant; prior revisions are disclosed below it. When viewing revision 1, the footer explicitly says **Revise latest paper**; clicking it returns to a composer prefilled for revision 2. Progress uses ordinary educational stages, and Cancelled now says unfinished results will not be delivered rather than implying verified process termination. `desktop-conversation-paper-1440.png`, `phone-ready-revision-390.png`, `phone-working-390.png`, `phone-cancelled-390.png`.

## Not followed / limits

There is no material visual blocker in the observed candidate. This is a review of M3-relevant principles, not a certification of complete Material component or accessibility conformance. Parent QA owns actual Firebase/worker execution, authorization, recovery semantics and production release checks. This critic has not inspected actual A4 pagination or a printer, physical devices, or a genuinely generated complete Chemistry paper; synthetic samples do not prove those domains. The email-form toggle could more literally say `Hide email sign-in` while the Google action remains visible; this is nonblocking.

## Most relevant M3 principles and scores

Typography roles, deliberate surface hierarchy and action emphasis are applied to the actual teacher workflow: readable body text, distinct paper typography, primary View paper, secondary Answers, tertiary revision. Mobile navigation changes composition while preserving the same job, rather than shrinking a desktop dashboard.

| Critical dimension | Score | Current visible reason |
|---|---:|---|
| Layout/current-task clarity | 8.5 | Conversation is the main working object; the desktop document is readable beside it and mobile results have an obvious return. The result blank-state defect was repaired and re-rendered. |
| Conversation/actual progress hierarchy | 8.5 | Status, ready-for-teacher-review result, queued/offline, failed and cancelled have distinct truthful copy and appropriate actions, with no fabricated ETA or progress percentage. |
| Responsive action usability | 8.5 | Phone controls are practical targets, drawer excludes background controls and restores focus, the 320px toolbar fits, and long multilingual content wraps without horizontal overflow. |
| Overall visual judgment | 8.5 | Faithful to the useful concept mechanisms and sufficiently polished for this private pilot. |

Generic risks: indiscriminate cards **resolved** through meaningful status/result surfaces; hero obscuring working product **resolved** because introductory content is limited to sign-in/empty states; complicated multi-pane mobile dashboard **resolved** through dedicated conversation/document views. Retain composition, type, color, spacing and navigation. No structural correction remains for the observed UI.

**Critic verdict: pass.** This is the independent visual-critic gate only. Parent round-5 personal checkpoint, separate QA, final candidate binding and owner acceptance remain separately recorded; this file does not manufacture them. Five meaningful reviewed cycles are retained: first candidate/blockers, artifact/control repair, long content/revision, recovery/history, and frozen candidate/access gate.
