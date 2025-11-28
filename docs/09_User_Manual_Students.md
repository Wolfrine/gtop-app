# User Manual (Students)
_File: 09_User_Manual_Students.md_

## Sign Up / Log In
1. Visit `/` (landing page).
2. Click Google sign-in (popup). One Tap may prompt automatically on non-localhost browsers.【F:src/app/app.routes.ts†L30-L44】【F:src/app/services/auth.service.ts†L60-L94】
3. On first login, complete `/profile-setup` by selecting board and standard; this data is saved to your profile.【F:src/app/app.routes.ts†L43-L55】【F:src/app/services/auth.service.ts†L93-L130】

## Dashboard
- After profile completion, you are redirected to `/dashboard`, showing recent activity and quick actions (see dashboard component).【F:src/app/services/auth.service.ts†L217-L236】【F:src/app/app.routes.ts†L68-L79】

## Selecting and Taking a Quiz
- Navigate to `/quiz`.
- Choose **Quick Quiz** to auto-select a random chapter with available MCQs (10 questions).【F:src/app/services/quiz.service.ts†L49-L104】
- Choose **Custom Quiz** to filter by board/standard and optional subjects/chapters, specifying number of questions.【F:src/app/services/quiz.service.ts†L106-L157】
- Answer multiple-choice questions; per-question timing may be enforced in live/quiz-run modes (see live section below).

## Live Quiz / Quiz Runs
- Visit `/live` to see available live sessions; join via code or list of upcoming sessions (lobby status).【F:src/app/app.routes.ts†L210-L223】【F:src/app/services/live-quiz.service.ts†L67-L104】
- Join a session as player at `/live/play/:sessionId`; respond to questions in sync with host pacing; leaderboard considers correct answers and response time with penalties for unanswered questions.【F:src/app/app.routes.ts†L237-L249】【F:src/app/services/quiz.service.ts†L240-L332】
- Quiz runs (scheduled competitive sets) start from `/quiz-run` and lobby `/quiz-run/lobby/:sessionId` for run-mode participation.【F:src/app/app.routes.ts†L184-L209】

## Quiz Summary
- After quiz completion, view `/quiz-summary` for correctness and explanations (component-specific). Route requires authentication.【F:src/app/app.routes.ts†L171-L183】

## Reports and History
- Access `/reports` to see past quiz attempts sourced from `QuizResults`. Review per-question outcomes and trigger retries (all or incorrect-only).【F:src/app/services/quiz.service.ts†L220-L333】【F:src/app/services/quiz.service.ts†L334-L395】

## Retrying Questions
- From summary or reports, choose retry options; the app stores a pending retry set to be consumed on next quiz session (context tracked as summary/reports and incorrect/all).【F:src/app/services/quiz.service.ts†L334-L395】

## Flagging Issues
- While reviewing, flag problematic questions; each user can flag a question once, incrementing flag count for admin review.【F:src/app/services/quiz.service.ts†L396-L455】

## Presence and Status
- Your online status is tracked automatically; closing the tab or signing out marks you offline (admin-visible only).【F:src/app/services/active-users.service.ts†L15-L80】

## Troubleshooting
- If login fails, ensure Google popup/One Tap is allowed; errors are logged to console and admin logs. Retry sign-in or use popup on localhost (One Tap disabled locally).【F:src/app/services/auth.service.ts†L35-L94】
