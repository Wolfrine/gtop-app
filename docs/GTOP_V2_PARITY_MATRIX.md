# GTOP v2 Functional Parity Matrix

Generated from `gtop-v2/parity-ledger.json`. `verified` requires runnable evidence; `implemented` is not a release sign-off.

| Area | Role | v1 capability | v2 route | Status | Evidence | Action Plan |
|---|---|---|---|---|---|---|
| auth-session | all | Google sign-in, One Tap, restored session and role | / | implemented | e2e/public.spec.ts<br>e2e/authenticated.spec.ts | authentication-seo |
| admin-shell-quiz | admin | Take learner quiz without losing admin navigation | /admin/learning/quiz | verified | src/app/core/quiz-session.store.test.ts<br>e2e/authenticated.spec.ts | admin-shell-continuity |
| dashboard-metrics | admin | Question, user, attempt, live, work and online counts | /admin | implemented | — | dashboard-presence |
| action-plan | admin | Read and update execution work | /admin/action-plan | verified | src/app/core/firestore.rules.test.ts<br>e2e/authenticated.spec.ts | action-plan-access |
| pwa-install | all | Install GTOP and update app shell | / | implemented | — | pwa-offline |
| offline-firestore | all | Persistent Firestore cache | all authenticated | implemented | — | pwa-offline |
| presence | all | Online, disconnect, visibility and sign-out state | authenticated shell | implemented | — | dashboard-presence |
| quick-custom-quiz | learner,admin | Quick and custom practice | /practice and /admin/learning/practice | implemented | src/app/core/quiz-utils.test.ts<br>e2e/authenticated.spec.ts | content-parity |
| historical-links | learner,admin | Open historical reports and review links | /reports and /quiz-summary | implemented | — | legacy-links |
| question-bank | admin | Filter, page, inspect, edit, copy and retire questions | /admin/questions | implemented | — | content-parity |
| question-import | admin | Validate and bulk import questions | /admin/questions | implemented | — | content-parity |
| syllabus-preview | admin | Preview syllabus changes | /admin/syllabus | implemented | — | content-parity |
| user-activity | admin | Presence, reports, recent activity and performance | /admin/users and /admin/users/:uid | implemented | — | dashboard-presence |
| live-quiz | learner,admin | Create, schedule, join, host, play and summarize | /live and /admin/learning/live | implemented | src/app/core/quiz-utils.test.ts | live-correctness |
| quiz-run | learner,admin | Create or join synchronized quiz run | /quiz-run and /admin/learning/quiz-run | implemented | — | live-correctness |
| themes | admin | UI preview | /admin/theme-lab | implemented | src/app/core/theme.service.test.ts | theme-lab |
| public-seo | public | Canonical, social, structured and analytics metadata | / | implemented | e2e/public.spec.ts | authentication-seo |
| authenticated-e2e | learner,admin | Authenticated shell and Action Plan regression evidence | admin learning and Action Plan | verified | e2e/authenticated.spec.ts | release-evidence |
