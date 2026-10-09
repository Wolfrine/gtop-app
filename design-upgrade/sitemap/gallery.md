# Baseline screenshot gallery

Desktop/mobile pairs from the existing application. [Method and limits](../evidence/baseline/README.md) · [Inspection record](../evidence/baseline/inspection.json) · [Coverage](coverage.json). Synthetic emulator captures and live-public screenshots are shown separately.

Emulator capture records: 483; eligible for selection: 425; excluded after capture/review: 58 across 4 runs. Live-public records are additional.

## R01 · `/practice`

Variant: default · Coverage: `screens_reviewed_with_notes`

| State | Desktop | Mobile | Review status |
|---|---|---|---|
| `practice-invalid` | [open screenshot](../screens/2026-10-09-baseline/37883706813/practice-invalid/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/practice-invalid/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `practice-mismatch` | [open screenshot](../screens/2026-10-09-baseline/37883706813/practice-mismatch/desktop.png) · pathname changed (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/practice-mismatch/mobile.png) · pathname changed (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `practice-preview` | [open screenshot](../screens/2026-10-09-baseline/37883706813/practice-preview/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/practice-preview/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |

Entry-point mismatches (listed for review; not counted as route evidence):

- `invited-quiz-completion-and-return` (desktop): requested `/practice?board=CBSE&chapters=Solutions&count=5&standard=12&subjects=Chemistry`, landed at `/dashboard`; [open screenshot](../screens/2026-10-09-baseline/37885730251/invited-quiz-completion-and-return/desktop.png)
- `invited-quiz-completion-and-return` (mobile): requested `/practice?board=CBSE&chapters=Solutions&count=5&standard=12&subjects=Chemistry`, landed at `/dashboard`; [open screenshot](../screens/2026-10-09-baseline/37885730251/invited-quiz-completion-and-return/mobile.png)

## R02 · `/quiz?practice=invite`

Variant: invited practice selected by query parameter practice=invite · Coverage: `screens_reviewed_with_notes`

> Route selection: Ordered /quiz route with canMatch=invitedQuizMatch; query parameter practice=invite selects InvitedQuizComponent.

| State | Desktop | Mobile | Review status |
|---|---|---|---|
| `invited-quiz` | [open screenshot](../screens/2026-10-09-baseline/37883706813/invited-quiz/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/invited-quiz/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `invited-quiz-in-progress--first-invitation-question-answered` | [open screenshot](../screens/2026-10-09-baseline/37885730251/invited-quiz-in-progress--first-invitation-question-answered/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/invited-quiz-in-progress--first-invitation-question-answered/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |

Entry-point mismatches (listed for review; not counted as route evidence):

- `practice-mismatch` (desktop): requested `/quiz?board=CBSE&chapters=Solutions&count=5&practice=invite&standard=12&subjects=Chemistry`, landed at `/practice?board=CBSE&chapters=Solutions&count=5&standard=12&subjects=Chemistry`; [open screenshot](../screens/2026-10-09-baseline/37883706813/practice-mismatch/desktop.png)
- `practice-mismatch` (mobile): requested `/quiz?board=CBSE&chapters=Solutions&count=5&practice=invite&standard=12&subjects=Chemistry`, landed at `/practice?board=CBSE&chapters=Solutions&count=5&standard=12&subjects=Chemistry`; [open screenshot](../screens/2026-10-09-baseline/37883706813/practice-mismatch/mobile.png)

## R03 · `/admin/question-papers/legacy`

Variant: default · Coverage: `screens_reviewed_with_notes`

| State | Desktop | Mobile | Review status |
|---|---|---|---|
| `paper-legacy` | [open screenshot](../screens/2026-10-09-baseline/37883706813/paper-legacy/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/paper-legacy/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |

## R04 · `/admin/question-papers/view/:paperId`

Variant: default · Coverage: `screens_reviewed_with_notes`

| State | Desktop | Mobile | Review status |
|---|---|---|---|
| `paper-answer-key` | [open screenshot](../screens/2026-10-09-baseline/37883706813/paper-answer-key/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/paper-answer-key/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `paper-view` | [open screenshot](../screens/2026-10-09-baseline/37883706813/paper-view/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/paper-view/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `paper-view-missing` | [open screenshot](../screens/2026-10-09-baseline/37883706813/paper-view-missing/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/paper-view-missing/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |

## R05 · `/admin/question-papers/all`

Variant: default · Coverage: `screens_reviewed_with_notes`

| State | Desktop | Mobile | Review status |
|---|---|---|---|
| `paper-register-all-alias` | [open screenshot](../screens/2026-10-09-baseline/37885730251/paper-register-all-alias/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/paper-register-all-alias/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |

## R06 · `/admin/question-papers/new`

Variant: default · Coverage: `screens_reviewed_with_notes`

| State | Desktop | Mobile | Review status |
|---|---|---|---|
| `paper-new` | [open screenshot](../screens/2026-10-09-baseline/37885730251/paper-new/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/paper-new/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |

## R07 · `/admin/question-papers`

Variant: default · Coverage: `screens_reviewed_with_notes`

| State | Desktop | Mobile | Review status |
|---|---|---|---|
| `paper-register` | [open screenshot](../screens/2026-10-09-baseline/37885730251/paper-register/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/paper-register/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `paper-register-in-progress` | [open screenshot](../screens/2026-10-09-baseline/37883706813/paper-register-in-progress/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/paper-register-in-progress/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `paper-register-needs-action` | [open screenshot](../screens/2026-10-09-baseline/37883706813/paper-register-needs-action/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/paper-register-needs-action/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `paper-register-no-results` | [open screenshot](../screens/2026-10-09-baseline/37883706813/paper-register-no-results/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/paper-register-no-results/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `paper-register-older` | [open screenshot](../screens/2026-10-09-baseline/37883706813/paper-register-older/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/paper-register-older/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `paper-register-ready` | [open screenshot](../screens/2026-10-09-baseline/37883706813/paper-register-ready/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/paper-register-ready/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `paper-updates` | [open screenshot](../screens/2026-10-09-baseline/37883706813/paper-updates/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/paper-updates/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |

## R08 · `/admin/question-papers/chat/:conversationId`

Variant: default · Coverage: `screens_reviewed_with_notes`

| State | Desktop | Mobile | Review status |
|---|---|---|---|
| `paper-chat-cancelled` | [open screenshot](../screens/2026-10-09-baseline/37885730251/paper-chat-cancelled/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/paper-chat-cancelled/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `paper-chat-error` | [open screenshot](../screens/2026-10-09-baseline/37885730251/paper-chat-error/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/paper-chat-error/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `paper-chat-history` | [open screenshot](../screens/2026-10-09-baseline/37883706813/paper-chat-history/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/paper-chat-history/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `paper-chat-needs-info` | [open screenshot](../screens/2026-10-09-baseline/37885730251/paper-chat-needs-info/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/paper-chat-needs-info/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `paper-chat-processing` | [open screenshot](../screens/2026-10-09-baseline/37885730251/paper-chat-processing/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/paper-chat-processing/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `paper-chat-queued` | [open screenshot](../screens/2026-10-09-baseline/37885730251/paper-chat-queued/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/paper-chat-queued/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `paper-chat-ready` | [open screenshot](../screens/2026-10-09-baseline/37885730251/paper-chat-ready/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/paper-chat-ready/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `paper-revision` | [open screenshot](../screens/2026-10-09-baseline/37883706813/paper-revision/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/paper-revision/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |

## R09 · `/admin/question-library`

Variant: default · Coverage: `screens_reviewed_with_notes`

| State | Desktop | Mobile | Review status |
|---|---|---|---|
| `question-library` | [open screenshot](../screens/2026-10-09-baseline/37883706813/question-library/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/question-library/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `question-library-add-written` | [open screenshot](../screens/2026-10-09-baseline/37883706813/question-library-add-written/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/question-library-add-written/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `question-library-archive-confirmation` | [open screenshot](../screens/2026-10-09-baseline/37885730251/question-library-archive-confirmation/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/question-library-archive-confirmation/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `question-library-archive-confirmation-open--archive-confirmation` | [open screenshot](../screens/2026-10-09-baseline/37885730251/question-library-archive-confirmation-open--archive-confirmation/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/question-library-archive-confirmation-open--archive-confirmation/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `question-library-edit-existing` | [open screenshot](../screens/2026-10-09-baseline/37885730251/question-library-edit-existing/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/question-library-edit-existing/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `question-library-empty-search` | [open screenshot](../screens/2026-10-09-baseline/37887727775/question-library-empty-search/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37887727775/question-library-empty-search/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `question-library-empty-search--empty-search-results` | [open screenshot](../screens/2026-10-09-baseline/37887727775/question-library-empty-search--empty-search-results/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37887727775/question-library-empty-search--empty-search-results/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `question-library-existing-question-editor--existing-question-edit` | [open screenshot](../screens/2026-10-09-baseline/37885730251/question-library-existing-question-editor--existing-question-edit/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/question-library-existing-question-editor--existing-question-edit/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `question-library-populated` | [open screenshot](../screens/2026-10-09-baseline/37883706813/question-library-populated/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/question-library-populated/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |

## R10 · `/admin/question-bank`

Variant: default · Coverage: `screens_reviewed_with_notes`

| State | Desktop | Mobile | Review status |
|---|---|---|---|
| `question-bank-priority-detail` | [open screenshot](../screens/2026-10-09-baseline/37885730251/question-bank-priority-detail/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/question-bank-priority-detail/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `question-bank-priority-filter-empty--no-matching-priorities` | [open screenshot](../screens/2026-10-09-baseline/37885730251/question-bank-priority-filter-empty--no-matching-priorities/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/question-bank-priority-filter-empty--no-matching-priorities/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `question-bank-priority-no-results` | [open screenshot](../screens/2026-10-09-baseline/37885730251/question-bank-priority-no-results/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/question-bank-priority-no-results/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `question-bank-selected-priority-detail--selected-priority-detail` | [open screenshot](../screens/2026-10-09-baseline/37885730251/question-bank-selected-priority-detail--selected-priority-detail/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/question-bank-selected-priority-detail--selected-priority-detail/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `question-requests` | [open screenshot](../screens/2026-10-09-baseline/37883706813/question-requests/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/question-requests/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |

## R11 · `/admin/question-paper-generator`

Variant: default · Coverage: `screens_reviewed_with_notes`

| State | Desktop | Mobile | Review status |
|---|---|---|---|
| `paper-generator` | [open screenshot](../screens/2026-10-09-baseline/37883706813/paper-generator/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/paper-generator/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `paper-generator-saved-papers` | [open screenshot](../screens/2026-10-09-baseline/37887727775/paper-generator-saved-papers/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37887727775/paper-generator-saved-papers/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `paper-generator-saved-papers--saved-draft-list` | [open screenshot](../screens/2026-10-09-baseline/37887727775/paper-generator-saved-papers--saved-drafts-empty/desktop.png) (`reviewed_full`) | [open screenshot](../screens/2026-10-09-baseline/37887727775/paper-generator-saved-papers--saved-draft-list/mobile.png) (`reviewed_overview`) | desktop: reviewed_full; mobile: reviewed_overview |
| `paper-generator-stages` | [open screenshot](../screens/2026-10-09-baseline/37886910772/paper-generator-stages/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37886910772/paper-generator-stages/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `paper-generator-stages--generated-draft-preview` | [open screenshot](../screens/2026-10-09-baseline/37886910772/paper-generator-stages--generated-draft-preview/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37886910772/paper-generator-stages--generated-draft-preview/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `paper-generator-stages--stage-1-format` | [open screenshot](../screens/2026-10-09-baseline/37886910772/paper-generator-stages--stage-1-format/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37886910772/paper-generator-stages--stage-1-format/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `paper-generator-stages--stage-2-syllabus-and-sections` | [open screenshot](../screens/2026-10-09-baseline/37886910772/paper-generator-stages--stage-2-syllabus-and-sections/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37886910772/paper-generator-stages--stage-2-syllabus-and-sections/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `paper-generator-stages--stage-3-coverage` | [open screenshot](../screens/2026-10-09-baseline/37886910772/paper-generator-stages--stage-3-coverage/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37886910772/paper-generator-stages--stage-3-coverage/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `paper-generator-stages--stage-4-draft-preview` | [open screenshot](../screens/2026-10-09-baseline/37886910772/paper-generator-stages--stage-4-draft-preview/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37886910772/paper-generator-stages--stage-4-draft-preview/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |

## R12 · `/admin/question-review`

Variant: default · Coverage: `screens_reviewed_with_notes`

| State | Desktop | Mobile | Review status |
|---|---|---|---|
| `question-review` | [open screenshot](../screens/2026-10-09-baseline/37883706813/question-review/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/question-review/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `question-review-empty-queue` | [open screenshot](../screens/2026-10-09-baseline/37887727775/question-review-empty-queue/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37887727775/question-review-empty-queue/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `question-review-empty-queue--no-matching-questions` | [open screenshot](../screens/2026-10-09-baseline/37887727775/question-review-empty-queue--no-matching-questions/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37887727775/question-review-empty-queue--no-matching-questions/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `question-review-workbench-states` | [open screenshot](../screens/2026-10-09-baseline/37885730251/question-review-workbench-states/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/question-review-workbench-states/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `question-review-workbench-states--bulk-selection` | [open screenshot](../screens/2026-10-09-baseline/37885730251/question-review-workbench-states--bulk-selection/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/question-review-workbench-states--bulk-selection/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `question-review-workbench-states--expanded-question-details` | [open screenshot](../screens/2026-10-09-baseline/37885730251/question-review-workbench-states--expanded-question-details/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/question-review-workbench-states--expanded-question-details/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `question-review-workbench-states--populated-queue` | [open screenshot](../screens/2026-10-09-baseline/37885730251/question-review-workbench-states--populated-queue/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/question-review-workbench-states--populated-queue/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `question-review-workbench-states--reject-confirmation` | [open screenshot](../screens/2026-10-09-baseline/37885730251/question-review-workbench-states--reject-confirmation/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/question-review-workbench-states--reject-confirmation/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `review-individual-editor` | [open screenshot](../screens/2026-10-09-baseline/37885730251/review-individual-editor/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/review-individual-editor/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `review-individual-editor-open--individual-question-editor` | [open screenshot](../screens/2026-10-09-baseline/37885730251/review-individual-editor-open--individual-question-editor/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/review-individual-editor-open--individual-question-editor/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |

Entry-point mismatches (listed for review; not counted as route evidence):

- `access-denied-admin` (desktop): requested `/admin/question-review`, landed at `/dashboard`; [open screenshot](../screens/2026-10-09-baseline/37883706813/access-denied-admin/desktop.png)
- `access-denied-admin` (mobile): requested `/admin/question-review`, landed at `/dashboard`; [open screenshot](../screens/2026-10-09-baseline/37883706813/access-denied-admin/mobile.png)

## R13 · `/learning-lab`

Variant: default · Coverage: `screens_reviewed_with_notes`

| State | Desktop | Mobile | Review status |
|---|---|---|---|
| `learning-lab` | [open screenshot](../screens/2026-10-09-baseline/37883706813/learning-lab/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/learning-lab/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |

## R14 · `/learning-lab/plants`

Variant: default · Coverage: `screens_reviewed_with_notes`

| State | Desktop | Mobile | Review status |
|---|---|---|---|
| `plant-assessment--five-question-plant-reproduction-assessment` | [open screenshot](../screens/2026-10-09-baseline/37887727775/plant-assessment--five-question-plant-reproduction-assessment/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37887727775/plant-assessment--five-question-plant-reproduction-assessment/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `plant-discoveries-notebook--notebook-open-with-a-compatible-pollination-trial` | [open screenshot](../screens/2026-10-09-baseline/37887727775/plant-discoveries-notebook--notebook-open-with-a-compatible-pollination-trial/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37887727775/plant-discoveries-notebook--notebook-open-with-a-compatible-pollination-trial/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `plant-discovery-summary--five-discoveries-before-the-knowledge-check` | [open screenshot](../screens/2026-10-09-baseline/37887727775/plant-discovery-summary--five-discoveries-before-the-knowledge-check/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37887727775/plant-discovery-summary--five-discoveries-before-the-knowledge-check/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `plant-feedback-sent--practice-feedback-completion-state` | [open screenshot](../screens/2026-10-09-baseline/37887727775/plant-feedback-sent--practice-feedback-completion-state/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37887727775/plant-feedback-sent--practice-feedback-completion-state/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `plant-graded-summary-feedback--graded-summary-with-explanations-and-feedback-form` | [open screenshot](../screens/2026-10-09-baseline/37887727775/plant-graded-summary-feedback--graded-summary-with-explanations-and-feedback-form/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37887727775/plant-graded-summary-feedback--graded-summary-with-explanations-and-feedback-form/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `plant-journey-map--five-stop-journey-map-open` | [open screenshot](../screens/2026-10-09-baseline/37887727775/plant-journey-map--five-stop-journey-map-open/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37887727775/plant-journey-map--five-stop-journey-map-open/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `plant-lab` | [open screenshot](../screens/2026-10-09-baseline/37883706813/plant-lab/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/plant-lab/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `plant-lab-journey` | [open screenshot](../screens/2026-10-09-baseline/37887727775/plant-lab-journey/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37887727775/plant-lab-journey/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `plant-mission-01-anatomy--flower-anatomy-exploration` | [open screenshot](../screens/2026-10-09-baseline/37887727775/plant-mission-01-anatomy--flower-anatomy-exploration/desktop.png) (`reviewed_full`) | [open screenshot](../screens/2026-10-09-baseline/37887727775/plant-mission-01-anatomy--flower-anatomy-exploration/mobile.png) (`reviewed_overview`) | desktop: reviewed_full; mobile: reviewed_overview |
| `plant-mission-01-anatomy-complete--both-flower-parts-inspected-discovery-saved` | [open screenshot](../screens/2026-10-09-baseline/37887727775/plant-mission-01-anatomy-complete--both-flower-parts-inspected-discovery-saved/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37887727775/plant-mission-01-anatomy-complete--both-flower-parts-inspected-discovery-saved/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `plant-mission-02-pollination--pollination-controls-before-a-trial` | [open screenshot](../screens/2026-10-09-baseline/37887727775/plant-mission-02-pollination--pollination-controls-before-a-trial/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37887727775/plant-mission-02-pollination--pollination-controls-before-a-trial/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `plant-mission-03-fertilisation--fertilisation-sequence-at-its-first-event` | [open screenshot](../screens/2026-10-09-baseline/37887727775/plant-mission-03-fertilisation--fertilisation-sequence-at-its-first-event/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37887727775/plant-mission-03-fertilisation--fertilisation-sequence-at-its-first-event/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `plant-mission-04-fruit--fruit-development-before-wind-dispersal` | [open screenshot](../screens/2026-10-09-baseline/37887727775/plant-mission-04-fruit--fruit-development-before-wind-dispersal/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37887727775/plant-mission-04-fruit--fruit-development-before-wind-dispersal/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `plant-mission-05-propagation--vegetative-propagation-controls` | [open screenshot](../screens/2026-10-09-baseline/37887727775/plant-mission-05-propagation--vegetative-propagation-controls/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37887727775/plant-mission-05-propagation--vegetative-propagation-controls/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |

## R15 · `/learning-lab/plants/results`

Variant: default · Coverage: `screens_reviewed_with_notes`

| State | Desktop | Mobile | Review status |
|---|---|---|---|
| `plant-lab-results-empty` | [open screenshot](../screens/2026-10-09-baseline/37883706813/plant-lab-results-empty/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/plant-lab-results-empty/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `plant-results` | [open screenshot](../screens/2026-10-09-baseline/37883706813/plant-results/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/plant-results/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `plant-results-populated` | [open screenshot](../screens/2026-10-09-baseline/37885730251/plant-results-populated/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/plant-results-populated/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |

## R16 · `/learning-lab/current`

Variant: default · Coverage: `screens_reviewed_with_notes`

| State | Desktop | Mobile | Review status |
|---|---|---|---|
| `current-lab` | [open screenshot](../screens/2026-10-09-baseline/37883706813/current-lab/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/current-lab/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `current-lab-check--five-question-understanding-check-and-reflection` | [open screenshot](../screens/2026-10-09-baseline/37887727775/current-lab-check--five-question-understanding-check-and-reflection/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37887727775/current-lab-check--five-question-understanding-check-and-reflection/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `current-lab-graded-reflection--checked-answers-and-usefulness-feedback-form` | [open screenshot](../screens/2026-10-09-baseline/37887727775/current-lab-graded-reflection--checked-answers-and-usefulness-feedback-form/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37887727775/current-lab-graded-reflection--checked-answers-and-usefulness-feedback-form/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `current-lab-journey` | [open screenshot](../screens/2026-10-09-baseline/37887727775/current-lab-journey/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37887727775/current-lab-journey/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `current-lab-parallel-circuit--parallel-circuit-with-branch-current-and-voltage-values` | [open screenshot](../screens/2026-10-09-baseline/37887727775/current-lab-parallel-circuit--parallel-circuit-with-branch-current-and-voltage-values/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37887727775/current-lab-parallel-circuit--parallel-circuit-with-branch-current-and-voltage-values/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `current-lab-practice-complete--practice-completion-confirmation` | [open screenshot](../screens/2026-10-09-baseline/37887727775/current-lab-practice-complete--practice-completion-confirmation/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37887727775/current-lab-practice-complete--practice-completion-confirmation/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `current-lab-predict--fresh-baseline-predictions-and-lesson-steps` | [open screenshot](../screens/2026-10-09-baseline/37887727775/current-lab-predict--fresh-baseline-predictions-and-lesson-steps/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37887727775/current-lab-predict--fresh-baseline-predictions-and-lesson-steps/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `current-lab-resistance-result--resistance-change-and-current-reading` | [open screenshot](../screens/2026-10-09-baseline/37887727775/current-lab-resistance-result--resistance-change-and-current-reading/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37887727775/current-lab-resistance-result--resistance-change-and-current-reading/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `current-lab-series-circuit--two-resistor-series-circuit-before-changing-arrangement` | [open screenshot](../screens/2026-10-09-baseline/37887727775/current-lab-series-circuit--two-resistor-series-circuit-before-changing-arrangement/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37887727775/current-lab-series-circuit--two-resistor-series-circuit-before-changing-arrangement/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `current-lab-single-circuit--single-resistor-circuit-controls` | [open screenshot](../screens/2026-10-09-baseline/37887727775/current-lab-single-circuit--single-resistor-circuit-controls/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37887727775/current-lab-single-circuit--single-resistor-circuit-controls/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `current-lab-voltage-result--voltage-changed-with-live-current-reading` | [open screenshot](../screens/2026-10-09-baseline/37887727775/current-lab-voltage-result--voltage-changed-with-live-current-reading/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37887727775/current-lab-voltage-result--voltage-changed-with-live-current-reading/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |

## R17 · `/learning-lab/results`

Variant: default · Coverage: `screens_reviewed_with_notes`

| State | Desktop | Mobile | Review status |
|---|---|---|---|
| `current-lab-results-empty` | [open screenshot](../screens/2026-10-09-baseline/37883706813/current-lab-results-empty/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/current-lab-results-empty/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `lab-results` | [open screenshot](../screens/2026-10-09-baseline/37883706813/lab-results/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/lab-results/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `lab-results-populated` | [open screenshot](../screens/2026-10-09-baseline/37885730251/lab-results-populated/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/lab-results-populated/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |

## R18 · `/`

Variant: default · Coverage: `screens_reviewed_with_notes`

| State | Desktop | Mobile | Review status |
|---|---|---|---|
| `landing` | [open screenshot](../screens/2026-10-09-baseline/37883706813/landing/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/landing/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `landing-circuit-on` | [open screenshot](../screens/2026-10-09-baseline/37885730251/landing-circuit-on/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/landing-circuit-on/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `landing-sample-answer` | [open screenshot](../screens/2026-10-09-baseline/37885730251/landing-sample-answer/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/landing-sample-answer/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `not-found-redirect` | [open screenshot](../screens/2026-10-09-baseline/37883706813/not-found-redirect/desktop.png) · pathname changed (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/not-found-redirect/mobile.png) · pathname changed (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |

## R19 · `/profile-setup`

Variant: default · Coverage: `screens_reviewed_with_notes`

| State | Desktop | Mobile | Review status |
|---|---|---|---|
| `profile-setup` | [open screenshot](../screens/2026-10-09-baseline/37883706813/profile-setup/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/profile-setup/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |

## R20 · `/profile`

Variant: default · Coverage: `screens_reviewed_with_notes`

| State | Desktop | Mobile | Review status |
|---|---|---|---|
| `profile` | [open screenshot](../screens/2026-10-09-baseline/37883706813/profile/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/profile/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `profile-admin-controls` | [open screenshot](../screens/2026-10-09-baseline/37885730251/profile-admin-controls/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/profile-admin-controls/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `profile-save-feedback` | [open screenshot](../screens/2026-10-09-baseline/37885730251/profile-save-feedback/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/profile-save-feedback/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `profile-save-feedback--changed-curriculum-saved` | [open screenshot](../screens/2026-10-09-baseline/37885730251/profile-save-feedback--changed-curriculum-saved/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/profile-save-feedback--changed-curriculum-saved/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |

## R21 · `/dashboard`

Variant: default · Coverage: `screens_reviewed_with_notes`

| State | Desktop | Mobile | Review status |
|---|---|---|---|
| `access-denied-admin` | [open screenshot](../screens/2026-10-09-baseline/37883706813/access-denied-admin/desktop.png) · pathname changed (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/access-denied-admin/mobile.png) · pathname changed (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `custom-quiz-admin` | [open screenshot](../screens/2026-10-09-baseline/37885730251/custom-quiz-admin/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/custom-quiz-admin/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `custom-quiz-learner` | [open screenshot](../screens/2026-10-09-baseline/37885730251/custom-quiz-learner/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/custom-quiz-learner/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `dashboard` | [open screenshot](../screens/2026-10-09-baseline/37883706813/dashboard/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/dashboard/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `dashboard-empty` | [open screenshot](../screens/2026-10-09-baseline/37883706813/dashboard-empty/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/dashboard-empty/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `invitation-dashboard-return-cue--dashboard-card-with-invitation-revisit-saved-for-tomorrow` | [open screenshot](../screens/2026-10-09-baseline/37885730251/invitation-dashboard-return-cue--dashboard-card-with-invitation-revisit-saved-for-tomorrow/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/invitation-dashboard-return-cue--dashboard-card-with-invitation-revisit-saved-for-tomorrow/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `invited-quiz-completion-and-return` | [open screenshot](../screens/2026-10-09-baseline/37885730251/invited-quiz-completion-and-return/desktop.png) · pathname changed (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/invited-quiz-completion-and-return/mobile.png) · pathname changed (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `navigation-learner` | [open screenshot](../screens/2026-10-09-baseline/37885730251/navigation-learner/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/navigation-learner/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `practice-link-copied--practice-invitation-link-copied-to-clipboard` | [open screenshot](../screens/2026-10-09-baseline/37885730251/practice-link-copied--practice-invitation-link-copied-to-clipboard/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/practice-link-copied--practice-invitation-link-copied-to-clipboard/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `practice-link-manual-fallback--clipboard-denied-readonly-link-available-for-manual-copying` | [open screenshot](../screens/2026-10-09-baseline/37885730251/practice-link-manual-fallback--clipboard-denied-readonly-link-available-for-manual-copying/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/practice-link-manual-fallback--clipboard-denied-readonly-link-available-for-manual-copying/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `practice-link-share-outcomes` | [open screenshot](../screens/2026-10-09-baseline/37885730251/practice-link-share-outcomes/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/practice-link-share-outcomes/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `profile-menu` | [open screenshot](../screens/2026-10-09-baseline/37883706813/profile-menu/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/profile-menu/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |

## R22 · `/admin`

Variant: default · Coverage: `screens_reviewed_with_notes`

| State | Desktop | Mobile | Review status |
|---|---|---|---|
| `admin-console` | [open screenshot](../screens/2026-10-09-baseline/37883706813/admin-console/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/admin-console/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `navigation-admin` | [open screenshot](../screens/2026-10-09-baseline/37885730251/navigation-admin/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/navigation-admin/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |

## R23 · `/admin/action-plan`

Variant: default · Coverage: `screens_reviewed_with_notes`

| State | Desktop | Mobile | Review status |
|---|---|---|---|
| `action-plan` | [open screenshot](../screens/2026-10-09-baseline/37886910772/action-plan/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37886910772/action-plan/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `action-plan-editor` | [open screenshot](../screens/2026-10-09-baseline/37885730251/action-plan-editor/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/action-plan-editor/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |

## R24 · `/admin/mcq-management`

Variant: default · Coverage: `screens_reviewed_with_notes`

| State | Desktop | Mobile | Review status |
|---|---|---|---|
| `mcq-management` | [open screenshot](../screens/2026-10-09-baseline/37883706813/mcq-management/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/mcq-management/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `mcq-management-edit-state` | [open screenshot](../screens/2026-10-09-baseline/37885730251/mcq-management-edit-state/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/mcq-management-edit-state/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `mcq-management-edit-state--expanded-question` | [open screenshot](../screens/2026-10-09-baseline/37885730251/mcq-management-edit-state--expanded-question/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/mcq-management-edit-state--expanded-question/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `mcq-management-edit-state--populated-filtered-bank` | [open screenshot](../screens/2026-10-09-baseline/37885730251/mcq-management-edit-state--populated-filtered-bank/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/mcq-management-edit-state--populated-filtered-bank/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `mcq-management-edit-state--question-json-edit` | [open screenshot](../screens/2026-10-09-baseline/37885730251/mcq-management-edit-state--question-json-edit/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/mcq-management-edit-state--question-json-edit/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `mcq-management-filtered-empty` | [open screenshot](../screens/2026-10-09-baseline/37887727775/mcq-management-filtered-empty/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37887727775/mcq-management-filtered-empty/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `mcq-management-filtered-empty--empty-filtered-bank` | [open screenshot](../screens/2026-10-09-baseline/37887727775/mcq-management-filtered-empty--empty-filtered-bank/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37887727775/mcq-management-filtered-empty--empty-filtered-bank/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |

## R25 · `/admin/add-mcq`

Variant: default · Coverage: `screens_reviewed_with_notes`

| State | Desktop | Mobile | Review status |
|---|---|---|---|
| `add-mcq` | [open screenshot](../screens/2026-10-09-baseline/37883706813/add-mcq/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/add-mcq/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `add-mcq-invalid-json` | [open screenshot](../screens/2026-10-09-baseline/37885730251/add-mcq-invalid-json/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/add-mcq-invalid-json/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `add-mcq-invalid-json-feedback--invalid-json-snackbar` | [open screenshot](../screens/2026-10-09-baseline/37885730251/add-mcq-invalid-json-feedback--invalid-json-snackbar/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/add-mcq-invalid-json-feedback--invalid-json-snackbar/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `add-mcq-parsed-preview` | [open screenshot](../screens/2026-10-09-baseline/37887727775/add-mcq-parsed-preview/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37887727775/add-mcq-parsed-preview/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `add-mcq-parsed-preview-visible--parsed-mcq-preview` | [open screenshot](../screens/2026-10-09-baseline/37887727775/add-mcq-parsed-preview-visible--parsed-mcq-preview/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37887727775/add-mcq-parsed-preview-visible--parsed-mcq-preview/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |

## R26 · `/admin/manage-syllabus`

Variant: default · Coverage: `screens_reviewed_with_notes`

| State | Desktop | Mobile | Review status |
|---|---|---|---|
| `manage-syllabus` | [open screenshot](../screens/2026-10-09-baseline/37883706813/manage-syllabus/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/manage-syllabus/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `syllabus-expanded` | [open screenshot](../screens/2026-10-09-baseline/37883706813/syllabus-expanded/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/syllabus-expanded/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |

## R27 · `/syllabus-preview`

Variant: default · Coverage: `screens_reviewed_with_notes`

| State | Desktop | Mobile | Review status |
|---|---|---|---|
| `syllabus-review` | [open screenshot](../screens/2026-10-09-baseline/37883706813/syllabus-review/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/syllabus-review/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `syllabus-review-expanded-editor` | [open screenshot](../screens/2026-10-09-baseline/37883706813/syllabus-review-expanded-editor/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/syllabus-review-expanded-editor/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `syllabus-review-expanded-editor--inline-unsaved-edit` | [open screenshot](../screens/2026-10-09-baseline/37883706813/syllabus-review-expanded-editor--inline-unsaved-edit/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/syllabus-review-expanded-editor--inline-unsaved-edit/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `syllabus-review-expanded-editor--subject-inventory` | [open screenshot](../screens/2026-10-09-baseline/37883706813/syllabus-review-expanded-editor--subject-inventory/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/syllabus-review-expanded-editor--subject-inventory/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `syllabus-review-expanded-editor--subject-preview-open` | [open screenshot](../screens/2026-10-09-baseline/37883706813/syllabus-review-expanded-editor--subject-preview-open/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/syllabus-review-expanded-editor--subject-preview-open/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |

## R28 · `/logs`

Variant: default · Coverage: `screens_reviewed_with_notes`

| State | Desktop | Mobile | Review status |
|---|---|---|---|
| `logs` | [open screenshot](../screens/2026-10-09-baseline/37883706813/logs/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/logs/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |

## R29 · `/quiz`

Variant: ordinary practice · Coverage: `screens_reviewed_with_notes`

| State | Desktop | Mobile | Review status |
|---|---|---|---|
| `live-player-active` | [open screenshot](../screens/2026-10-09-baseline/37885730251/live-player-active/desktop.png) · pathname changed (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/live-player-active/mobile.png) · pathname changed (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `quiz` | [open screenshot](../screens/2026-10-09-baseline/37883706813/quiz/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/quiz/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `quiz-empty` | [open screenshot](../screens/2026-10-09-baseline/37883706813/quiz-empty/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/quiz-empty/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `quiz-run-active-question` | [open screenshot](../screens/2026-10-09-baseline/37886910772/quiz-run-active-question/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37886910772/quiz-run-active-question/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `quiz-run-active-question--active-collaborative-run-question-with-timer` | [open screenshot](../screens/2026-10-09-baseline/37886910772/quiz-run-active-question--active-collaborative-run-question-with-timer/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/quiz-run-active-question--active-collaborative-run-question-with-timer/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `quiz-run-answer-submitted--run-answer-submitted-and-option-locked` | [open screenshot](../screens/2026-10-09-baseline/37886910772/quiz-run-answer-submitted--run-answer-submitted-and-option-locked/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37886910772/quiz-run-answer-submitted--run-answer-submitted-and-option-locked/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `quiz-selected` | [open screenshot](../screens/2026-10-09-baseline/37883706813/quiz-selected/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/quiz-selected/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |

Entry-point mismatches (listed for review; not counted as route evidence):

- `quiz-completed` (desktop): requested `/quiz?chapters=Cells&count=5&subjects=Biology`, landed at `/quiz-summary`; [open screenshot](../screens/2026-10-09-baseline/37883706813/quiz-completed/desktop.png)
- `quiz-completed` (mobile): requested `/quiz?chapters=Cells&count=5&subjects=Biology`, landed at `/quiz-summary`; [open screenshot](../screens/2026-10-09-baseline/37883706813/quiz-completed/mobile.png)
- `quiz-offline-save-recovery` (desktop): requested `/quiz?chapters=Cells&count=2&subjects=Biology`, landed at `/quiz-summary`; [open screenshot](../screens/2026-10-09-baseline/37885730251/quiz-offline-save-recovery/desktop.png)
- `quiz-offline-save-recovery` (mobile): requested `/quiz?chapters=Cells&count=2&subjects=Biology`, landed at `/quiz-summary`; [open screenshot](../screens/2026-10-09-baseline/37885730251/quiz-offline-save-recovery/mobile.png)

## R30 · `/quiz-summary`

Variant: default · Coverage: `screens_reviewed_with_notes`

| State | Desktop | Mobile | Review status |
|---|---|---|---|
| `invited-quiz-saved-offer--saved-five-question-result-and-voluntary-return-offer` | [open screenshot](../screens/2026-10-09-baseline/37885730251/invited-quiz-saved-offer--saved-five-question-result-and-voluntary-return-offer/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/invited-quiz-saved-offer--saved-five-question-result-and-voluntary-return-offer/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `quiz-completed` | [open screenshot](../screens/2026-10-09-baseline/37883706813/quiz-completed/desktop.png) · pathname changed (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/quiz-completed/mobile.png) · pathname changed (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `quiz-offline-save-recovery` | [open screenshot](../screens/2026-10-09-baseline/37885730251/quiz-offline-save-recovery/desktop.png) · pathname changed (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/quiz-offline-save-recovery/mobile.png) · pathname changed (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `quiz-save-offline--failed-save-with-answers-retained` | [open screenshot](../screens/2026-10-09-baseline/37885730251/quiz-save-offline--failed-save-with-answers-retained/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/quiz-save-offline--failed-save-with-answers-retained/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `quiz-summary-all-answers--saved-result-with-all-five-questions-before-filtering` | [open screenshot](../screens/2026-10-09-baseline/37885730251/quiz-summary-all-answers--saved-result-with-all-five-questions-before-filtering/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/quiz-summary-all-answers--saved-result-with-all-five-questions-before-filtering/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `quiz-summary-empty` | [open screenshot](../screens/2026-10-09-baseline/37885730251/quiz-summary-empty/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/quiz-summary-empty/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `quiz-summary-expanded` | [open screenshot](../screens/2026-10-09-baseline/37883706813/quiz-summary-expanded/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/quiz-summary-expanded/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `quiz-summary-incorrect-filter` | [open screenshot](../screens/2026-10-09-baseline/37885730251/quiz-summary-incorrect-filter/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/quiz-summary-incorrect-filter/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `quiz-summary-incorrect-only--review-filtered-to-the-two-incorrect-answers` | [open screenshot](../screens/2026-10-09-baseline/37885730251/quiz-summary-incorrect-only--review-filtered-to-the-two-incorrect-answers/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/quiz-summary-incorrect-only--review-filtered-to-the-two-incorrect-answers/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `quiz-summary-saved` | [open screenshot](../screens/2026-10-09-baseline/37883706813/quiz-summary-saved/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/quiz-summary-saved/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `reports-expanded-attempt` | [open screenshot](../screens/2026-10-09-baseline/37885730251/reports-expanded-attempt/desktop.png) · pathname changed (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/reports-expanded-attempt/mobile.png) · pathname changed (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |

## R31 · `/quiz-run`

Variant: default · Coverage: `screens_reviewed_with_notes`

| State | Desktop | Mobile | Review status |
|---|---|---|---|
| `quiz-run` | [open screenshot](../screens/2026-10-09-baseline/37883706813/quiz-run/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/quiz-run/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |

## R32 · `/quiz-run/lobby/:sessionId`

Variant: default · Coverage: `screens_reviewed_with_notes`

| State | Desktop | Mobile | Review status |
|---|---|---|---|
| `run-lobby-guest` | [open screenshot](../screens/2026-10-09-baseline/37883706813/run-lobby-guest/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/run-lobby-guest/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `run-lobby-host` | [open screenshot](../screens/2026-10-09-baseline/37883706813/run-lobby-host/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/run-lobby-host/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `run-missing` | [open screenshot](../screens/2026-10-09-baseline/37883706813/run-missing/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/run-missing/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |

## R33 · `/live`

Variant: default · Coverage: `screens_reviewed_with_notes`

| State | Desktop | Mobile | Review status |
|---|---|---|---|
| `live-admin` | [open screenshot](../screens/2026-10-09-baseline/37883706813/live-admin/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/live-admin/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `live-hub` | [open screenshot](../screens/2026-10-09-baseline/37883706813/live-hub/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/live-hub/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |

## R34 · `/live/host/:sessionId`

Variant: default · Coverage: `screens_reviewed_with_notes`

| State | Desktop | Mobile | Review status |
|---|---|---|---|
| `live-host-active` | [open screenshot](../screens/2026-10-09-baseline/37885730251/live-host-active/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/live-host-active/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `live-host-lobby` | [open screenshot](../screens/2026-10-09-baseline/37885730251/live-host-lobby/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/live-host-lobby/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |

## R35 · `/live/play/:sessionId`

Variant: default · Coverage: `screens_reviewed_with_notes`

| State | Desktop | Mobile | Review status |
|---|---|---|---|
| `live-player-lobby` | [open screenshot](../screens/2026-10-09-baseline/37885730251/live-player-lobby/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/live-player-lobby/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |

Entry-point mismatches (listed for review; not counted as route evidence):

- `live-player-active` (desktop): requested `/live/play/baseline-20261009-live-active`, landed at `/quiz?live=1&sessionId=baseline-20261009-live-active`; [open screenshot](../screens/2026-10-09-baseline/37885730251/live-player-active/desktop.png)
- `live-player-active` (mobile): requested `/live/play/baseline-20261009-live-active`, landed at `/quiz?live=1&sessionId=baseline-20261009-live-active`; [open screenshot](../screens/2026-10-09-baseline/37885730251/live-player-active/mobile.png)

## R36 · `/live/summary/:sessionId`

Variant: default · Coverage: `screens_reviewed_with_notes`

| State | Desktop | Mobile | Review status |
|---|---|---|---|
| `live-summary` | [open screenshot](../screens/2026-10-09-baseline/37883706813/live-summary/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/live-summary/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |

## R37 · `/reports`

Variant: default · Coverage: `screens_reviewed_with_notes`

| State | Desktop | Mobile | Review status |
|---|---|---|---|
| `reports` | [open screenshot](../screens/2026-10-09-baseline/37883706813/reports/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/reports/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `reports-empty` | [open screenshot](../screens/2026-10-09-baseline/37883706813/reports-empty/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/reports-empty/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |

Entry-point mismatches (listed for review; not counted as route evidence):

- `reports-expanded-attempt` (desktop): requested `/reports`, landed at `/quiz-summary?sessionId=baseline-20261009-result-0&userId=C8Vf7qtQXzGl5oOxsCeHPnspJxCO`; [open screenshot](../screens/2026-10-09-baseline/37885730251/reports-expanded-attempt/desktop.png)
- `reports-expanded-attempt` (mobile): requested `/reports`, landed at `/quiz-summary?sessionId=attempt-C8Vf7qtQXzGl5oOxsCeHPnspJxCO:681d5a60-c066-48e5-8dd6-79caa660810c&userId=C8Vf7qtQXzGl5oOxsCeHPnspJxCO`; [open screenshot](../screens/2026-10-09-baseline/37885730251/reports-expanded-attempt/mobile.png)

## R38 · `/admin/manage-syllabus/edit`

Variant: default · Coverage: `screens_reviewed_with_notes`

| State | Desktop | Mobile | Review status |
|---|---|---|---|
| `edit-syllabus` | [open screenshot](../screens/2026-10-09-baseline/37885730251/edit-syllabus/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37885730251/edit-syllabus/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `manage-syllabus-inline-edit` | [open screenshot](../screens/2026-10-09-baseline/37883706813/manage-syllabus-inline-edit/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/manage-syllabus-inline-edit/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `manage-syllabus-inline-edit--inline-row-edit` | [open screenshot](../screens/2026-10-09-baseline/37883706813/manage-syllabus-inline-edit--inline-row-edit/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/manage-syllabus-inline-edit--inline-row-edit/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `manage-syllabus-inline-edit--syllabus-rows` | [open screenshot](../screens/2026-10-09-baseline/37883706813/manage-syllabus-inline-edit--syllabus-rows/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/manage-syllabus-inline-edit--syllabus-rows/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |

## R39 · `/admin/user-list`

Variant: default · Coverage: `screens_reviewed_with_notes`

| State | Desktop | Mobile | Review status |
|---|---|---|---|
| `user-expanded` | [open screenshot](../screens/2026-10-09-baseline/37883706813/user-expanded/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/user-expanded/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |
| `user-list` | [open screenshot](../screens/2026-10-09-baseline/37883706813/user-list/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/user-list/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |

## R40 · `/dev/ui`

Variant: default · Coverage: `screens_reviewed_with_notes`

| State | Desktop | Mobile | Review status |
|---|---|---|---|
| `ui-preview` | [open screenshot](../screens/2026-10-09-baseline/37883706813/ui-preview/desktop.png) (`reviewed_overview`) | [open screenshot](../screens/2026-10-09-baseline/37883706813/ui-preview/mobile.png) (`reviewed_overview`) | desktop: reviewed_overview; mobile: reviewed_overview |

## Live public evidence

Live-public pages are kept separate from synthetic emulator captures.

| ID | Viewport | Screenshot | Captured |
|---|---|---|---|
| `live-landing-1440` | desktop | [open screenshot](../screens/2026-10-09-baseline/37883706813/live-landing/desktop.png) | 2026-10-09T04:26:03.156Z |
| `live-landing-390` | mobile | [open screenshot](../screens/2026-10-09-baseline/37883706813/live-landing/mobile.png) | 2026-10-09T04:26:05.284Z |
| `live-landing-1440` | desktop | [open screenshot](../screens/2026-10-09-baseline/37885730251/live-landing/desktop.png) | 2026-10-09T04:52:48.515Z |
| `live-landing-390` | mobile | [open screenshot](../screens/2026-10-09-baseline/37885730251/live-landing/mobile.png) | 2026-10-09T04:52:50.792Z |
| `live-landing-1440` | desktop | [open screenshot](../screens/2026-10-09-baseline/37886910772/live-landing/desktop.png) | 2026-10-09T05:08:00.217Z |
| `live-landing-390` | mobile | [open screenshot](../screens/2026-10-09-baseline/37886910772/live-landing/mobile.png) | 2026-10-09T05:08:02.553Z |
| `live-landing-1440` | desktop | [open screenshot](../screens/2026-10-09-baseline/37887727775/live-landing/desktop.png) | 2026-10-09T05:18:13.490Z |
| `live-landing-390` | mobile | [open screenshot](../screens/2026-10-09-baseline/37887727775/live-landing/mobile.png) | 2026-10-09T05:18:15.861Z |

Visual-review status comes only from the optional inspection metadata; no automatic review declaration is made.
