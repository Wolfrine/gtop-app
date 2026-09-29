# Question module operations

## Admin journey
- `/admin/question-papers`: active paper requests, next actions, cancellation, saved snapshots and older-page loading.
- `/admin/question-paper-generator`: format → syllabus/sections → exact approved coverage → preview, answer key and print/PDF. `requestId` resumes pinned curriculum/rules; `draftId` opens the original snapshot. A complete saved request becomes completed.
- `/admin/question-library`: independent board/class/subject/chapter navigation, objective and written/paper banks, manual written creation, edits, archive and pagination. Search explicitly applies to loaded questions. Admin-authored written answers stay outside the learner MCQ collection.
- `/admin/question-review`: pending review, corrections, bounded bulk approval/rejection and request-scoped return links.
- `/admin/question-bank`: chapter growth targets and paper child requests. A paper's setup owns its linked priorities; cancel it from Papers.

Written questions must match section marks. Objective paper formats retain their scoring rules. Reviewed syllabus versions and exact stored snapshots remain the trust boundaries; catalogue completeness is not implied by this release.

## Scheduled creator
The existing daily 08:00 Asia/Kolkata creator reads `questionBankAgentInstructions/creator-workflow-v3` first, retaining subject quality/reference contracts. It replaces conflicting legacy cooldown and force-run policies.

Only explicit admin requests are eligible. Reconcile approved and pending counts; generate max(target − approved − pending, 0). Pending-only coverage is review work, never completion. Parent paper requests retain their exact type, section, marks, year and curriculum constraints; allocate with the shared `createPaperPlan` behavior. Completed/cancelled parents remain terminal.

At most three chapter scopes and 50 total drafts per run; global pending cap 500 and scope cap 200. Claim a 20-minute lease with the observed update token, recheck parent state before each bounded write batch, deduplicate against both banks, and use deterministic draft IDs. Stage for admin review only. Continue unfinished work on the next run without the former seven-day cooldown. Report genuine blockers and actual counts in agent run records.

`curriculum-review-v1.paperRequestEnabled` is the release gate for parent-paper processing. Enable only after the current browser code and shared backend rules have both been verified live. No fictitious request should be inserted into production merely to demonstrate generation.

## Internal activity evidence
`adminUsageSessions/{India-day}_{random-session}` stores actor UID, device category, coarse area/event counters and approximate active milliseconds. It excludes typed text, question content, complete URLs, query strings and click labels. Time counts only while visible, focused and recently active; each interval is capped at 15 seconds. Failed writes retain a bounded in-memory buffer; leaving a tab can lose the last interval, so time is approximate.

Admins can write only their own session; learners and anonymous clients cannot read or write these records. `adminUsageReports` is admin-readable and server-write-only. No stats dashboard is added. The creator's monthly routine reads the previous completed calendar month once, writes one bounded evidence-based report, identifies actors only as needed internally, and acknowledges missing/sampled data. Print counters mean the browser print dialog was invoked, not that physical printing completed. No productivity rankings or fabricated usage conclusions.

## Release
A main push calls the existing protected backend workflow for Firestore rules, then runs module/rules/browser gates before hosting. Rehearsal or unconfirmed manual dispatch must not deploy live rules. The protected environment and post-deploy active-rule verification remain in place. Local portable Chromium override is scoped to Chromium projects; CI still covers Chromium and WebKit devices.
