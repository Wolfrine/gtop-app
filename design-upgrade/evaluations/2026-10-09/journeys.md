# Journey evidence and bounded ratings

Recorded Step 2 actions were reviewed against their resulting states and failure manifests. No new live interaction or real-user test was conducted in Step 4. **All overall journey totals are withheld:** every assessed flow has at least one unobserved rubric dimension. This does not mean the actions failed.

Dimension scores below describe observed portions only. They must not be averaged with missing values. Desktop/mobile differences are stated where material; these are flow-level assessments, not per-route visual ratings.

[Screen ratings](README.md) · [Raw run provenance](../../evidence/baseline/runs.json) · [Step 2 corrections and boundaries](../../evidence/baseline/review.md)

| Flow | Next action | Feedback | Information / navigation | Repeat / growth | Recovery | Total |
|---|---:|---:|---:|---:|---:|---|
| [J01 Ordinary practice → saved review → progress, including interrupted save](#j01) | 8 | 8 | 6 | Not observed | 8 | Withheld |
| [J02 Invitation and return cue / share fallback](#j02) | 8 | 8 | 6 | Not observed | 7 | Withheld |
| [J03 Paper retrieval and status inspection](#j03) | 7 | 7 | 6 | 6 | Not observed | Withheld |
| [J04 Manual generator to paper preview](#j04) | 7 | 7 | 6 | Not observed | Not observed | Withheld |
| [J05 Admin question/curriculum inspection and local editing](#j05) | 6 | 7 | 5 | 5 | Not observed | Withheld |
| [J06 Plant Lab guided practice](#j06) | 8 | 8 | 7 | Not observed | Not observed | Withheld |
| [J07 Current Lab guided practice](#j07) | 8 | 8 | 6 | Not observed | Not observed | Withheld |
| [J08 Profile curriculum save](#j08) | 7 | 7 | 5 | Not observed | Not observed | Withheld |
| [J09 Public entry demonstrations](#j09) | 8 | 8 | 7 | Not observed | Not observed | Withheld |
| [J10 Active run answer and live-state inspection](#j10) | 7 | 6 | 5 | Not observed | Not observed | Withheld |

## J01

**Ordinary practice → saved review → progress, including interrupted save**

Observed: Answer five questions → Submit → saved result. Separately, take a two-question quiz offline → failed-save state with answers retained → reconnect → Try saving again → saved confirmation. Open an answer explanation, filter a saved 3/5 result to two incorrect answers, and open an attempt from Reports.

Judgment: Next/submit actions and storage feedback are explicit. Recovery preserves the completed work and gives a specific retry. Mobile result/history composition delays the learning detail, reducing information-load score.

Not observed: Successful Retry Incorrect execution, retrieval as history grows, multi-visit continuity and real learner comprehension were not observed. Repeated-use/growth and total withheld.

| Resulting state | Captured evidence |
|---|---|
| `quiz-selected` | [desktop](../../screens/2026-10-09-baseline/37883706813/quiz-selected/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37883706813/quiz-selected/mobile.png) |
| `quiz-completed` | [desktop](../../screens/2026-10-09-baseline/37883706813/quiz-completed/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37883706813/quiz-completed/mobile.png) |
| `quiz-save-offline--failed-save-with-answers-retained` | [desktop](../../screens/2026-10-09-baseline/37885730251/quiz-save-offline--failed-save-with-answers-retained/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37885730251/quiz-save-offline--failed-save-with-answers-retained/mobile.png) |
| `quiz-offline-save-recovery` | [desktop](../../screens/2026-10-09-baseline/37885730251/quiz-offline-save-recovery/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37885730251/quiz-offline-save-recovery/mobile.png) |
| `quiz-summary-expanded` | [desktop](../../screens/2026-10-09-baseline/37883706813/quiz-summary-expanded/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37883706813/quiz-summary-expanded/mobile.png) |
| `quiz-summary-incorrect-only--review-filtered-to-the-two-incorrect-answers` | [desktop](../../screens/2026-10-09-baseline/37885730251/quiz-summary-incorrect-only--review-filtered-to-the-two-incorrect-answers/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37885730251/quiz-summary-incorrect-only--review-filtered-to-the-two-incorrect-answers/mobile.png) |
| `reports-expanded-attempt` | [desktop](../../screens/2026-10-09-baseline/37885730251/reports-expanded-attempt/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37885730251/reports-expanded-attempt/mobile.png) |


## J02

**Invitation and return cue / share fallback**

Observed: Admin-capable fixture starts invitation → answers five → saved result → voluntarily keeps practice on dashboard → return cue appears. Separately, custom-quiz invitation copy succeeds, then a deliberately denied clipboard exposes a manual link. A learner with mismatched curriculum is redirected to the explanatory preview.

Judgment: The scope and completion state are specific, with a meaningful voluntary return cue. Clipboard failure has an observed fallback. The long mobile quiz/summary sequence weakens proximity to the next action.

Not observed: Native Google sign-in, matched-curriculum learner handoff, actual sharing to another person, next-day return/expiry and reload continuity were not tested. Clipboard denial was synthetic.

| Resulting state | Captured evidence |
|---|---|
| `practice-preview` | [desktop](../../screens/2026-10-09-baseline/37883706813/practice-preview/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37883706813/practice-preview/mobile.png) |
| `practice-mismatch` | [desktop](../../screens/2026-10-09-baseline/37883706813/practice-mismatch/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37883706813/practice-mismatch/mobile.png) |
| `practice-invalid` | [desktop](../../screens/2026-10-09-baseline/37883706813/practice-invalid/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37883706813/practice-invalid/mobile.png) |
| `invited-quiz-in-progress--first-invitation-question-answered` | [desktop](../../screens/2026-10-09-baseline/37885730251/invited-quiz-in-progress--first-invitation-question-answered/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37885730251/invited-quiz-in-progress--first-invitation-question-answered/mobile.png) |
| `invited-quiz-saved-offer--saved-five-question-result-and-voluntary-return-offer` | [desktop](../../screens/2026-10-09-baseline/37885730251/invited-quiz-saved-offer--saved-five-question-result-and-voluntary-return-offer/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37885730251/invited-quiz-saved-offer--saved-five-question-result-and-voluntary-return-offer/mobile.png) |
| `invitation-dashboard-return-cue--dashboard-card-with-invitation-revisit-saved-for-tomorrow` | [desktop](../../screens/2026-10-09-baseline/37885730251/invitation-dashboard-return-cue--dashboard-card-with-invitation-revisit-saved-for-tomorrow/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37885730251/invitation-dashboard-return-cue--dashboard-card-with-invitation-revisit-saved-for-tomorrow/mobile.png) |
| `practice-link-copied--practice-invitation-link-copied-to-clipboard` | [desktop](../../screens/2026-10-09-baseline/37885730251/practice-link-copied--practice-invitation-link-copied-to-clipboard/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37885730251/practice-link-copied--practice-invitation-link-copied-to-clipboard/mobile.png) |
| `practice-link-manual-fallback--clipboard-denied-readonly-link-available-for-manual-copying` | [desktop](../../screens/2026-10-09-baseline/37885730251/practice-link-manual-fallback--clipboard-denied-readonly-link-available-for-manual-copying/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37885730251/practice-link-manual-fallback--clipboard-denied-readonly-link-available-for-manual-copying/mobile.png) |


## J03

**Paper retrieval and status inspection**

Observed: Activate three register status tabs; search a deliberately unmatched phrase; load older records and assert more than 30 rows; open Updates, saved record activity, revision editor and teacher answer-key view.

Judgment: The record/state vocabulary is specific and retrieval has observed filters plus older-record loading. The repeated mobile header and long appended rows slow comparison. These are bounded retrieval observations over 66 seeded conversations.

Not observed: Create/reply/retry/cancel submissions, actual asynchronous processing, clear-search action, persistence after interruption and native printing were not observed. Seeded error states establish appearance only.

| Resulting state | Captured evidence |
|---|---|
| `paper-register-needs-action` | [desktop](../../screens/2026-10-09-baseline/37883706813/paper-register-needs-action/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37883706813/paper-register-needs-action/mobile.png) |
| `paper-register-in-progress` | [desktop](../../screens/2026-10-09-baseline/37883706813/paper-register-in-progress/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37883706813/paper-register-in-progress/mobile.png) |
| `paper-register-ready` | [desktop](../../screens/2026-10-09-baseline/37883706813/paper-register-ready/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37883706813/paper-register-ready/mobile.png) |
| `paper-register-no-results` | [desktop](../../screens/2026-10-09-baseline/37883706813/paper-register-no-results/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37883706813/paper-register-no-results/mobile.png) |
| `paper-register-older` | [desktop](../../screens/2026-10-09-baseline/37883706813/paper-register-older/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37883706813/paper-register-older/mobile.png) |
| `paper-updates` | [desktop](../../screens/2026-10-09-baseline/37883706813/paper-updates/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37883706813/paper-updates/mobile.png) |
| `paper-chat-history` | [desktop](../../screens/2026-10-09-baseline/37883706813/paper-chat-history/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37883706813/paper-chat-history/mobile.png) |
| `paper-revision` | [desktop](../../screens/2026-10-09-baseline/37883706813/paper-revision/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37883706813/paper-revision/mobile.png) |
| `paper-answer-key` | [desktop](../../screens/2026-10-09-baseline/37883706813/paper-answer-key/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37883706813/paper-answer-key/mobile.png) |


## J04

**Manual generator to paper preview**

Observed: Select format → choose ICSE/class9/Biology/Cells and a one-question section → Check availability → Preview paper; separately open Saved papers and wait for the loaded draft list.

Judgment: Stages and coverage consequence are clear; repeated page navigation competes with current-step content on mobile.

Not observed: Save/open/resume draft, insufficient coverage, complex plans, print output and failed-save recovery were not exercised.

| Resulting state | Captured evidence |
|---|---|
| `paper-generator-stages--stage-1-format` | [desktop](../../screens/2026-10-09-baseline/37886910772/paper-generator-stages--stage-1-format/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37886910772/paper-generator-stages--stage-1-format/mobile.png) |
| `paper-generator-stages--stage-2-syllabus-and-sections` | [desktop](../../screens/2026-10-09-baseline/37886910772/paper-generator-stages--stage-2-syllabus-and-sections/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37886910772/paper-generator-stages--stage-2-syllabus-and-sections/mobile.png) |
| `paper-generator-stages--stage-3-coverage` | [desktop](../../screens/2026-10-09-baseline/37886910772/paper-generator-stages--stage-3-coverage/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37886910772/paper-generator-stages--stage-3-coverage/mobile.png) |
| `paper-generator-stages--generated-draft-preview` | [desktop](../../screens/2026-10-09-baseline/37886910772/paper-generator-stages--generated-draft-preview/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37886910772/paper-generator-stages--generated-draft-preview/mobile.png) |
| `paper-generator-saved-papers--saved-draft-list` | [desktop](../../screens/2026-10-09-baseline/37887727775/paper-generator-saved-papers--saved-drafts-empty/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37887727775/paper-generator-saved-papers--saved-draft-list/mobile.png) |


## J05

**Admin question/curriculum inspection and local editing**

Observed: Expand question → select loaded review rows → open rejection confirmation without applying; open/close individual editor. Open/cancel library editing and archive confirmation; filter to no matches. Parse valid and invalid MCQ input. Open a syllabus subject and type an unsaved verification note; open an inline syllabus row editor.

Judgment: Selection counts and flagged-approval restrictions are explicit. Navigation overhead, raw JSON editing, narrow confirmation controls and the large subject inventory weaken clarity and repeated inspection.

Not observed: No approval, rejection, archive, syllabus save or import save was executed. Query pagination beyond the first review batch, cross-session recovery and production volumes remain untested. The growth score reflects the observed 50-row review/273-subject fixture only.

| Resulting state | Captured evidence |
|---|---|
| `question-review-workbench-states--bulk-selection` | [desktop](../../screens/2026-10-09-baseline/37885730251/question-review-workbench-states--bulk-selection/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37885730251/question-review-workbench-states--bulk-selection/mobile.png) |
| `question-review-workbench-states--reject-confirmation` | [desktop](../../screens/2026-10-09-baseline/37885730251/question-review-workbench-states--reject-confirmation/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37885730251/question-review-workbench-states--reject-confirmation/mobile.png) |
| `review-individual-editor-open--individual-question-editor` | [desktop](../../screens/2026-10-09-baseline/37885730251/review-individual-editor-open--individual-question-editor/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37885730251/review-individual-editor-open--individual-question-editor/mobile.png) |
| `question-review-empty-queue--no-matching-questions` | [desktop](../../screens/2026-10-09-baseline/37887727775/question-review-empty-queue--no-matching-questions/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37887727775/question-review-empty-queue--no-matching-questions/mobile.png) |
| `question-library-existing-question-editor--existing-question-edit` | [desktop](../../screens/2026-10-09-baseline/37885730251/question-library-existing-question-editor--existing-question-edit/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37885730251/question-library-existing-question-editor--existing-question-edit/mobile.png) |
| `question-library-archive-confirmation-open--archive-confirmation` | [desktop](../../screens/2026-10-09-baseline/37885730251/question-library-archive-confirmation-open--archive-confirmation/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37885730251/question-library-archive-confirmation-open--archive-confirmation/mobile.png) |
| `question-library-empty-search--empty-search-results` | [desktop](../../screens/2026-10-09-baseline/37887727775/question-library-empty-search--empty-search-results/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37887727775/question-library-empty-search--empty-search-results/mobile.png) |
| `add-mcq-invalid-json-feedback--invalid-json-snackbar` | [desktop](../../screens/2026-10-09-baseline/37885730251/add-mcq-invalid-json-feedback--invalid-json-snackbar/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37885730251/add-mcq-invalid-json-feedback--invalid-json-snackbar/mobile.png) |
| `add-mcq-parsed-preview-visible--parsed-mcq-preview` | [desktop](../../screens/2026-10-09-baseline/37887727775/add-mcq-parsed-preview-visible--parsed-mcq-preview/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37887727775/add-mcq-parsed-preview-visible--parsed-mcq-preview/mobile.png) |
| `manage-syllabus-inline-edit--inline-row-edit` | [desktop](../../screens/2026-10-09-baseline/37883706813/manage-syllabus-inline-edit--inline-row-edit/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37883706813/manage-syllabus-inline-edit--inline-row-edit/mobile.png) |
| `syllabus-review-expanded-editor--inline-unsaved-edit` | [desktop](../../screens/2026-10-09-baseline/37883706813/syllabus-review-expanded-editor--inline-unsaved-edit/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37883706813/syllabus-review-expanded-editor--inline-unsaved-edit/mobile.png) |


## J06

**Plant Lab guided practice**

Observed: Use Explore without saving → inspect anther and ovary → choose compatible pollen → inspect map/notebook → follow fertilisation → fruit/dispersal trial → compare propagation → five-question check → grading → local practice feedback completion.

Judgment: Actions produce observations tied to the concept and a recorded discovery; the coherent stage supports guided attention. The mobile scene/controls need scroll-position validation and the summary could prioritize graded reasoning sooner.

Not observed: Saving attempts, saved-visit resume, failed-write recovery, normal-motion quality and long-term learning were not observed. Practice feedback stayed local.

| Resulting state | Captured evidence |
|---|---|
| `plant-mission-01-anatomy-complete--both-flower-parts-inspected-discovery-saved` | [desktop](../../screens/2026-10-09-baseline/37887727775/plant-mission-01-anatomy-complete--both-flower-parts-inspected-discovery-saved/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37887727775/plant-mission-01-anatomy-complete--both-flower-parts-inspected-discovery-saved/mobile.png) |
| `plant-discoveries-notebook--notebook-open-with-a-compatible-pollination-trial` | [desktop](../../screens/2026-10-09-baseline/37887727775/plant-discoveries-notebook--notebook-open-with-a-compatible-pollination-trial/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37887727775/plant-discoveries-notebook--notebook-open-with-a-compatible-pollination-trial/mobile.png) |
| `plant-mission-03-fertilisation--fertilisation-sequence-at-its-first-event` | [desktop](../../screens/2026-10-09-baseline/37887727775/plant-mission-03-fertilisation--fertilisation-sequence-at-its-first-event/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37887727775/plant-mission-03-fertilisation--fertilisation-sequence-at-its-first-event/mobile.png) |
| `plant-mission-04-fruit--fruit-development-before-wind-dispersal` | [desktop](../../screens/2026-10-09-baseline/37887727775/plant-mission-04-fruit--fruit-development-before-wind-dispersal/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37887727775/plant-mission-04-fruit--fruit-development-before-wind-dispersal/mobile.png) |
| `plant-mission-05-propagation--vegetative-propagation-controls` | [desktop](../../screens/2026-10-09-baseline/37887727775/plant-mission-05-propagation--vegetative-propagation-controls/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37887727775/plant-mission-05-propagation--vegetative-propagation-controls/mobile.png) |
| `plant-discovery-summary--five-discoveries-before-the-knowledge-check` | [desktop](../../screens/2026-10-09-baseline/37887727775/plant-discovery-summary--five-discoveries-before-the-knowledge-check/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37887727775/plant-discovery-summary--five-discoveries-before-the-knowledge-check/mobile.png) |
| `plant-graded-summary-feedback--graded-summary-with-explanations-and-feedback-form` | [desktop](../../screens/2026-10-09-baseline/37887727775/plant-graded-summary-feedback--graded-summary-with-explanations-and-feedback-form/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37887727775/plant-graded-summary-feedback--graded-summary-with-explanations-and-feedback-form/mobile.png) |
| `plant-feedback-sent--practice-feedback-completion-state` | [desktop](../../screens/2026-10-09-baseline/37887727775/plant-feedback-sent--practice-feedback-completion-state/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37887727775/plant-feedback-sent--practice-feedback-completion-state/mobile.png) |


## J07

**Current Lab guided practice**

Observed: Make predictions → Try without saving → keyboard-adjust voltage and resistance, observing values and enabled Record observation → change series to parallel → record → five-question check → grading → Finish practice.

Judgment: The manipulation, values and unlocked observation are causally linked. Mobile spatial separation and the long check/review form increase information load.

Not observed: Physical touch-drag, normal-motion timing, saved attempts/reload, recovery and retained learning were not observed.

| Resulting state | Captured evidence |
|---|---|
| `current-lab-single-circuit--single-resistor-circuit-controls` | [desktop](../../screens/2026-10-09-baseline/37887727775/current-lab-single-circuit--single-resistor-circuit-controls/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37887727775/current-lab-single-circuit--single-resistor-circuit-controls/mobile.png) |
| `current-lab-voltage-result--voltage-changed-with-live-current-reading` | [desktop](../../screens/2026-10-09-baseline/37887727775/current-lab-voltage-result--voltage-changed-with-live-current-reading/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37887727775/current-lab-voltage-result--voltage-changed-with-live-current-reading/mobile.png) |
| `current-lab-resistance-result--resistance-change-and-current-reading` | [desktop](../../screens/2026-10-09-baseline/37887727775/current-lab-resistance-result--resistance-change-and-current-reading/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37887727775/current-lab-resistance-result--resistance-change-and-current-reading/mobile.png) |
| `current-lab-parallel-circuit--parallel-circuit-with-branch-current-and-voltage-values` | [desktop](../../screens/2026-10-09-baseline/37887727775/current-lab-parallel-circuit--parallel-circuit-with-branch-current-and-voltage-values/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37887727775/current-lab-parallel-circuit--parallel-circuit-with-branch-current-and-voltage-values/mobile.png) |
| `current-lab-graded-reflection--checked-answers-and-usefulness-feedback-form` | [desktop](../../screens/2026-10-09-baseline/37887727775/current-lab-graded-reflection--checked-answers-and-usefulness-feedback-form/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37887727775/current-lab-graded-reflection--checked-answers-and-usefulness-feedback-form/mobile.png) |
| `current-lab-practice-complete--practice-completion-confirmation` | [desktop](../../screens/2026-10-09-baseline/37887727775/current-lab-practice-complete--practice-completion-confirmation/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37887727775/current-lab-practice-complete--practice-completion-confirmation/mobile.png) |


## J08

**Profile curriculum save**

Observed: Change Standard9 to10 → Save Changes → visible saved confirmation; restore Standard9 and save.

Judgment: Save feedback is local and explicit, but the mobile edit fields are below a long metadata stack.

Not observed: Initial profile setup completion, failed save, reload verification and effects on later practice scope were not tested.

| Resulting state | Captured evidence |
|---|---|
| `profile-save-feedback--changed-curriculum-saved` | [desktop](../../screens/2026-10-09-baseline/37885730251/profile-save-feedback--changed-curriculum-saved/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37885730251/profile-save-feedback--changed-curriculum-saved/mobile.png) |
| `profile-save-feedback` | [desktop](../../screens/2026-10-09-baseline/37885730251/profile-save-feedback/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37885730251/profile-save-feedback/mobile.png) |


## J09

**Public entry demonstrations**

Observed: Choose a sample answer → answered state appears. Toggle circuit → lamp-on state and explicit “Circuit closed. Lamp on.” text appear.

Judgment: The page demonstrates learning rather than only promising it. Local visual/text feedback is clear; full mobile section painting is bounded by screenshot behavior.

Not observed: Sign-in, normal-motion scroll/pause behavior, repeated use, recovery and actual conversion were not observed. The capture requests reduced motion and disables screenshot animations.

| Resulting state | Captured evidence |
|---|---|
| `landing-sample-answer` | [desktop](../../screens/2026-10-09-baseline/37885730251/landing-sample-answer/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37885730251/landing-sample-answer/mobile.png) |
| `landing-circuit-on` | [desktop](../../screens/2026-10-09-baseline/37885730251/landing-circuit-on/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37885730251/landing-circuit-on/mobile.png) |


## J10

**Active run answer and live-state inspection**

Observed: Open seeded active run → submit first available answer → observe selected/locked state; a later mobile visit may already be locked because the account/session is shared. Opening an active live-player route redirects to its actual quiz surface. Host, lobby, missing and summary variants are rendered from fixtures.

Judgment: Answer selection has visible feedback, but the seeded host question list fails mobile wrapping and the missing run resembles waiting. The scores cover this narrow observed interaction, not live orchestration.

Not observed: Create/join/start/end, synchronized multi-user transition, correct contest timing, reconnect, expiry and result calculation were not exercised. Long timer values are fixture choices.

| Resulting state | Captured evidence |
|---|---|
| `quiz-run-active-question--active-collaborative-run-question-with-timer` | [desktop](../../screens/2026-10-09-baseline/37886910772/quiz-run-active-question--active-collaborative-run-question-with-timer/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37885730251/quiz-run-active-question--active-collaborative-run-question-with-timer/mobile.png) |
| `quiz-run-answer-submitted--run-answer-submitted-and-option-locked` | [desktop](../../screens/2026-10-09-baseline/37886910772/quiz-run-answer-submitted--run-answer-submitted-and-option-locked/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37886910772/quiz-run-answer-submitted--run-answer-submitted-and-option-locked/mobile.png) |
| `live-player-active` | [desktop](../../screens/2026-10-09-baseline/37885730251/live-player-active/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37885730251/live-player-active/mobile.png) |
| `run-missing` | [desktop](../../screens/2026-10-09-baseline/37883706813/run-missing/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37883706813/run-missing/mobile.png) |
| `live-host-active` | [desktop](../../screens/2026-10-09-baseline/37885730251/live-host-active/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37885730251/live-host-active/mobile.png) |
| `live-host-lobby` | [desktop](../../screens/2026-10-09-baseline/37885730251/live-host-lobby/desktop.png) · [mobile](../../screens/2026-10-09-baseline/37885730251/live-host-lobby/mobile.png) |

## Execution provenance

The original scripts are versioned at the capture commits in the [run register](../../evidence/baseline/runs.json). Read each run’s failure list; a green wrapper alone is insufficient. Later successful captures supersede the earlier lab selector/wait failures without changing the application.

- [baseline.spec.ts at final capture-tool revision](https://github.com/Wolfrine/gtop-app/blob/614f833c5ae3b064afd4c4249b49f3d31afb215d/design-upgrade/capture-tools/baseline.spec.ts)
- [admin-captures.ts at final capture-tool revision](https://github.com/Wolfrine/gtop-app/blob/614f833c5ae3b064afd4c4249b49f3d31afb215d/design-upgrade/capture-tools/admin-captures.ts)
- [admin-extra-captures.ts at final capture-tool revision](https://github.com/Wolfrine/gtop-app/blob/614f833c5ae3b064afd4c4249b49f3d31afb215d/design-upgrade/capture-tools/admin-extra-captures.ts)
- [final-admin-captures.ts at final capture-tool revision](https://github.com/Wolfrine/gtop-app/blob/614f833c5ae3b064afd4c4249b49f3d31afb215d/design-upgrade/capture-tools/final-admin-captures.ts)
- [learner-extra-captures.ts at final capture-tool revision](https://github.com/Wolfrine/gtop-app/blob/614f833c5ae3b064afd4c4249b49f3d31afb215d/design-upgrade/capture-tools/learner-extra-captures.ts)
- [lab-captures.ts at final capture-tool revision](https://github.com/Wolfrine/gtop-app/blob/614f833c5ae3b064afd4c4249b49f3d31afb215d/design-upgrade/capture-tools/lab-captures.ts)

Lab walkthroughs used explicit practice mode. Admin decision/save actions were deliberately not submitted. Timer values, account totals and answer locks reflect sequential shared synthetic fixtures. GTOP captures requested reduced motion and used animation-disabled screenshots; they do not establish normal-motion quality. The external Google sign-in resources were blocked in the emulator.
