# User Manual (Teachers/Admins)
_File: 10_User_Manual_Teachers_Admins.md_

## Accessing Admin Features
- Sign in via Google as usual. If your Firestore user record has `role: 'admin'`, `RoleGuard` grants access to admin routes; default redirect after login is `/admin`.【F:src/app/services/auth.service.ts†L93-L236】【F:src/app/app.routes.ts†L80-L118】

## Admin Dashboard
- Route `/admin` displays admin dashboard with shortcuts (component implementation in pages folder).【F:src/app/app.routes.ts†L80-L92】

## Managing MCQs
1. Navigate to `/admin/mcq-management` to browse questions with filters for board/standard/subject/chapter; pagination applies when chapter not selected.【F:src/app/services/mcq.service.ts†L57-L138】【F:src/app/app.routes.ts†L93-L105】
2. Use `/admin/add-mcq` to batch-create questions. Each MCQ captures subject metadata, options, correct index, solutions; creator UID and timestamp recorded automatically.【F:src/app/services/mcq.service.ts†L23-L77】【F:src/app/app.routes.ts†L106-L118】
3. Adding MCQs automatically inserts missing syllabus combos and updates MCQ counts per combo.【F:src/app/services/syllabus.service.ts†L87-L118】
4. Deleted questions may be archived to `deletedQuestions` (per service structure).【F:src/app/services/mcq.service.ts†L19-L23】

## Syllabus Management
- `/admin/manage-syllabus` lists syllabus combos with counts; `/admin/manage-syllabus/edit` edits a selected combo. Changes propagate to matching questions and log an activity record describing before/after values and affected question IDs.【F:src/app/services/syllabus.service.ts†L48-L109】【F:src/app/app.routes.ts†L119-L146】【F:src/app/app.routes.ts†L276-L289】
- `/syllabus-preview` shows learner-facing syllabus view for verification.【F:src/app/app.routes.ts†L132-L144】

## User List and Roles
- `/admin/user-list` shows online/offline status from Realtime DB `activeUsers` plus Firestore users data. Roles can be updated via `ActiveUsersService.updateUserRole` (e.g., promote/demote admin).【F:src/app/app.routes.ts†L290-L302】【F:src/app/services/active-users.service.ts†L147-L212】

## Logs
- `/logs` displays captured client logs aggregated by `LoggingService` (console overrides). Useful for debugging deployments.【F:src/app/app.routes.ts†L145-L157】【F:src/app/services/logging.service.ts†L1-L35】

## Live Quiz Hosting
1. Start at `/live` (or `/quiz-run` for run mode) and create a session using `LiveQuizService.createSession`, specifying scope, questions, schedule, and pacing. A join code is generated for live sessions.【F:src/app/services/live-quiz.service.ts†L21-L64】【F:src/app/app.routes.ts†L184-L223】
2. Host view `/live/host/:sessionId` lets you monitor participants (from `participants` subcollection) and drive the session; overrides can adjust active question index.【F:src/app/services/live-quiz.service.ts†L117-L167】【F:src/app/shared/models/live-quiz.models.ts†L33-L71】
3. Participants join via `/live/play/:sessionId` or lobby; answers flow into `answers/{index}/items` with response times for leaderboard calculation.【F:src/app/services/live-quiz.service.ts†L117-L200】【F:src/app/services/quiz.service.ts†L240-L332】
4. After session, `/live/summary/:sessionId` can surface final standings computed from stored answers and question keys.【F:src/app/app.routes.ts†L250-L262】【F:src/app/services/quiz.service.ts†L240-L332】

## Reports
- Admins can also access `/reports` to review quiz outcomes similar to students, filtered by their own user context.【F:src/app/app.routes.ts†L263-L275】

## TODO/Assumptions
- **Institute Admin** role redirect exists but no UI routes; treat as future enhancement.【F:src/app/services/auth.service.ts†L217-L236】
- Bulk import/export of questions/users not implemented in current codebase (no scripts observed).
