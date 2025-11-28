# Functional Spec
_File: 02_Functional_Spec.md_

## Authentication & Profile Setup
**Purpose:** Allow users to sign in with Google and capture minimal profile info (board, standard, role).

**Flows:**
1. User lands on `/` and chooses Google sign-in (popup or One Tap).【F:src/app/services/auth.service.ts†L60-L150】
2. On first sign-in, user doc is created in Firestore with default `role: 'user'` if missing; profile setup collects board/standard and then redirects to dashboard.【F:src/app/services/auth.service.ts†L102-L134】【F:src/app/services/auth.service.ts†L217-L236】
3. Session persistence via `onAuthStateChanged`; user presence seeded into Realtime DB; sign out clears presence and routes to landing.【F:src/app/services/auth.service.ts†L136-L207】

**Business Rules:**
- Only authenticated users access protected routes via `AuthGuard`; role checks enforced by `RoleGuard` per route data roles.【F:src/app/app.routes.ts†L55-L320】
- Role defaults to existing Firestore value; if missing, set to `user` and never overwritten later automatically.【F:src/app/services/auth.service.ts†L93-L117】
- Redirect targets: admin → `/admin`; user → `/dashboard`; institute-admin placeholder to `/institute-admin` (no route).【F:src/app/services/auth.service.ts†L217-L236】

## Dashboard & Profile
**Purpose:** Provide personalized entry and profile viewing.

**Flows:**
- `/dashboard` shows student/admin dashboard components (implementation in pages folder).【F:src/app/app.routes.ts†L68-L110】
- `/profile` allows viewing/updating saved board and standard via service method `updateUserBoardStandard` (merge to Firestore).【F:src/app/services/auth.service.ts†L207-L214】

## Question Bank Management (Admin)
**Purpose:** Admins curate MCQs aligned to syllabus and track counts.

**Flows:**
1. Admin opens `/admin/mcq-management` to list and filter MCQs; fetches Firestore `questions` with optional board/standard/subject/chapter filters and pagination when chapter omitted.【F:src/app/services/mcq.service.ts†L57-L138】
2. Adding MCQs via `/admin/add-mcq` batches new docs, recording creator and timestamps, and updates/creates syllabus combos plus MCQ counts.【F:src/app/services/mcq.service.ts†L23-L77】【F:src/app/services/syllabus.service.ts†L87-L118】
3. Deleted questions go to `deletedQuestions` collection (logic implied by service reference).【F:src/app/services/mcq.service.ts†L19-L23】

**Business Rules:**
- Correct index validated to be within options; defaults to `-1` if invalid.【F:src/app/services/mcq.service.ts†L34-L55】
- MCQ add requires authenticated user; missing user throws error.【F:src/app/services/mcq.service.ts†L25-L32】
- MCQ fetch without filters returns empty result to avoid unbounded reads.【F:src/app/services/mcq.service.ts†L59-L66】

## Syllabus Management
**Purpose:** Maintain syllabus combinations with MCQ counts.

**Flows:**
- `/admin/manage-syllabus` and edit route allow viewing/editing combos stored in Firestore `syllabus` collection; updates propagate to questions when subject/chapter changes and log admin activity in `activity` collection.【F:src/app/services/syllabus.service.ts†L48-L109】
- Static syllabus JSONs indexed at build time via `scripts/gen-syllabus-index.js` feed previews and selection lists.【F:scripts/gen-syllabus-index.js†L1-L18】

**Business Rules:**
- Syllabus items auto-loaded via snapshot listener into shared BehaviorSubject for reuse.【F:src/app/services/syllabus.service.ts†L16-L47】
- MCQ counts refreshed through `updateMcqCountForCombo` and `updateSyllabusCountsFromIndexedDB`, using Firestore count queries.【F:src/app/services/syllabus.service.ts†L63-L86】【F:src/app/services/syllabus.service.ts†L118-L143】
- Edits update questions in batches of 500 to handle large datasets.【F:src/app/services/syllabus.service.ts†L68-L104】

## Quiz Play & Results
**Purpose:** Deliver quizzes and store results.

**Flows:**
1. Quick quiz selects random chapter with available MCQs via syllabus filter and pulls 10 shuffled questions.【F:src/app/services/quiz.service.ts†L49-L104】
2. Custom quiz fetches by board/standard with optional subject/chapter filters and limits to requested count.【F:src/app/services/quiz.service.ts†L106-L157】
3. After answering, results can be saved to `QuizResults` with per-question correctness and percentages; future fetch supports user history and retry preparations.【F:src/app/services/quiz.service.ts†L159-L333】
4. Retry logic stores pending question sets (all or incorrect only) for summary/reports reattempts.【F:src/app/services/quiz.service.ts†L334-L395】
5. Question flagging records `questionFlags` and increments question `flagCount`/`lastFlaggedAt`.【F:src/app/services/quiz.service.ts†L396-L455】

**Business Rules:**
- Quick/custom fetch unsubscribes snapshot immediately to avoid live listeners during quiz.【F:src/app/services/quiz.service.ts†L64-L87】【F:src/app/services/quiz.service.ts†L139-L152】
- Result saving computes totals, correctness, percentage; sessionId attached when provided.【F:src/app/services/quiz.service.ts†L173-L219】
- Retry preparation filters incorrect questions when requested; pending retry cleared when empty.【F:src/app/services/quiz.service.ts†L334-L368】
- Question flagging prevents duplicate flags per user/question combo; throws `already-flagged`.【F:src/app/services/quiz.service.ts†L408-L428】

## Reports & History
**Purpose:** Provide past quiz performance and allow review/retry.

**Flows:**
- Reports page (`/reports`) fetches quiz results via `fetchUserQuizResults`, maps timestamps, and can expand summaries back to full question docs for review.【F:src/app/services/quiz.service.ts†L220-L333】【F:src/app/services/quiz.service.ts†L456-L485】
- Retry from reports uses stored summaries to rebuild questions and set pending retry context.【F:src/app/services/quiz.service.ts†L356-L395】【F:src/app/services/quiz.service.ts†L471-L485】

## Live Quiz / Quiz Runs
**Purpose:** Real-time hosted quizzes with lobby, host control, player participation, and summaries.

**Flows:**
1. Host creates session (live or run mode) providing scope, question IDs, scheduling, and pacing; join code generated and saved in `LiveSessions` with scheduling metadata.【F:src/app/services/live-quiz.service.ts†L21-L64】【F:src/app/shared/models/live-quiz.models.ts†L12-L73】
2. Participants join via join code (live only) or direct session ID; participant record stored/updated under `participants` subcollection.【F:src/app/services/live-quiz.service.ts†L65-L116】
3. Clients observe session, participants, and per-question answers via snapshot listeners; answers stored under `answers/{index}/items` with selection and response time.【F:src/app/services/live-quiz.service.ts†L117-L200】【F:src/app/shared/models/live-quiz.models.ts†L75-L95】
4. Leaderboard/summary derived from aggregated answers and question keys; `fetchLiveResultsForSession` computes correctness, percentage, and time penalties, sorting ties by time then name.【F:src/app/services/quiz.service.ts†L240-L332】

**Business Rules:**
- Upcoming sessions query filters to lobby status and scheduled start >= now; run-mode sessions excluded from join-by-code.【F:src/app/services/live-quiz.service.ts†L67-L104】
- Host can override question index (fields `overrideIndex`/`overrideAt`) and auto-advance computed from anchor timestamps per models.【F:src/app/shared/models/live-quiz.models.ts†L33-L71】
- Question response penalties use per-question seconds when unanswered; negative/NaN response times clamped to default.【F:src/app/services/quiz.service.ts†L293-L330】

## Presence & User List
**Purpose:** Track active users for admin monitoring and own session management.

**Flows:**
- On auth state change, presence is written to Realtime DB `activeUsers/{uid}` with `isOnline` and `lastActive`; onDisconnect marks offline.【F:src/app/services/active-users.service.ts†L15-L80】
- Admin user list listens to `activeUsers` to compute online/offline counts and aggregates users collection for role management.【F:src/app/services/active-users.service.ts†L81-L144】【F:src/app/services/active-users.service.ts†L147-L171】
- Role updates write to `users` Firestore doc field `role`.【F:src/app/services/active-users.service.ts†L194-L212】

**Business Rules:**
- Presence reinitialized on tab visibility regain and if entry is manually removed from DB; offline update attempts fallback to creating record when needed.【F:src/app/services/active-users.service.ts†L28-L76】【F:src/app/services/active-users.service.ts†L172-L211】
