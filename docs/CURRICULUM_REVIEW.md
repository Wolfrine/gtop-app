# Year-specific syllabus review

The canonical app is `gtop-app/`. Add MCQs is directly accessible from the dashboard, sidebar and bank header. The existing syllabus-preview route now supports yearly review; legacy bank maintenance remains at `/admin/manage-syllabus`.

## Drafts, versions and approval

`curriculumSubjects/{scopeId}` holds a mutable draft. Its ID joins academicYear, board, standard and subject with `~`, after encoding each component with encodeURIComponent. Sources carry their URL, applicable year, section/page and discovery/retrieval dates. Chapters carry topics, optional formative-only topics, assessment scope, reviewed bank aliases and optional published weightage. Programme/textbook and examination cohort must be explicit when needed.

`curriculumVersions/{versionId}` is an immutable admin-approved snapshot. `curriculumReleases/{scopeId}` points at the active version. Approval re-reads draft revision and baseVersionId in a transaction. Editing a published subject creates a new draft while the previous release stays active. Bulk approval operates per subject and reports conflicts individually. Firestore rules keep drafts private and reject version updates/deletes.

The admin previews each subject, checks sources and changes, saves corrections, confirms completeness and selects it. Approve selected publishes all selected subjects; chapter-by-chapter approval is not required. Absent bank chapters and their questions are preserved.

## Creator contract

`curriculumImports` records explicit admin source-import requests (`source=admin-syllabus-review`). Empty board/standard means the targetBoards list defines the requested scope. Only reviewable draft writes are authorised. Discover the entire subject inventory for each requested board/class independently of existing questions. Record inaccessible sources, medium/edition/cohort ambiguity and incomplete coverage.

`paperRequests` preserves the original admin intent: year, board, class, subjects, scopeMode (selected/full/custom), assessmentPurpose, chapterScopes, version IDs, section rules, notes and progress. Missing full/custom scopes are saved as awaiting-syllabus. Research them into drafts, then wait in awaiting-approval for admin approval. Do not substitute the legacy bank for a complete syllabus.

After approval, resolve every requested subject and applicable chapter, pin the approved versions, and use the allocation in `question-paper.domain.ts` to calculate shortages. Only positive derived gaps may become questionBankPriorityItems under that original parent. Set source=admin-question-paper-generator, parentRequestId, exact syllabus ID, year/version/purpose, section/template, required/available/gap counts, marks, type mix and difficulty. Child IDs are paper-{requestId}-{gapIndex}. The parent's prioritiesCreated flag prevents retries from reopening completed children. Manual/fallback/unrelated priorities remain forbidden.

Exact duplicate legacy rows are one text scope: select the lexicographically first ID, retain all matching IDs in sourceSyllabusIds, and do not delete questions. An approved missing chapter can create a deterministic curriculum-{scopeId}-{encodedChapter} bank row. Manual import creates scope-{encodedBoard}~{encodedStandard}~{encodedSubject}~{encodedChapter}. Never infer aliases from fuzzy spelling.

Full-syllabus papers require questions tagged with the pinned curriculumVersionId and compatible assessmentPurpose. Older bank questions remain available in selected-chapter mode; they are not evidence of verified current-year coverage. Additional formative topics cannot enter summative questions. The paper section plan spreads coverage; it does not automatically claim official unit weightage. Review the source's assessmentNotes and adjust the selected template.

Questions continue to be staged only in devQuestions, pending admin review. Include parentRequestId, sourcePriorityId, sourceSyllabusId, academicYear, curriculumVersionId, assessmentPurpose, page/reference and content-level justification. Preserve level, duplicate, type-mix and backlog gates. Question approval rechecks version/scope before publication. Update parent progress from actual child/question counts, and keep later chapter batches under that parent. Awaiting review is not complete.

## Release and current coverage

Deploy reviewed rules through the existing protected firebase-v2-backend workflow before production promotion. Do not remove or bypass its environment gate. The active-backend verification now checks curriculum permissions too. Run build, module/rules tests and the existing cross-device CI browser suite; inspect actual screenshots before declaring visual verification complete.

The bundled data is unapproved: CBSE's official 2026-27 subject-link inventory, initial class 11/12 chapter drafts, and unverified legacy bank scopes. Missing chapter/topic imports stay visibly incomplete. Other boards/classes still need official sources and programme/medium/edition checks. ICSE is distinct from ISC; IGCSE is distinct from Cambridge Lower Secondary; IB programme/level and authorised guide access must be explicit. Imported inventory alone never establishes all-board completeness.
