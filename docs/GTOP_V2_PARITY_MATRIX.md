# GTOP v2 Functional Parity Matrix

This matrix is the release contract for replacing v1. “Parity” covers functioning v1 workflows; dormant roles and controls that never performed an operation are intentionally excluded.

| Area                 | v1 capability                                                     | v2 route / implementation                              | Acceptance evidence                                      |
| -------------------- | ----------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------- |
| Authentication       | Google sign-in, restored session, role loading, profile setup     | `/`, `/profile-setup`, readiness-based `AuthStore`     | Guard/unit tests and authenticated deep-link journey     |
| Hub contract         | Preserve `returnTo` and `hubReturnPath`                           | `/practice`, `/quiz`, `/quiz-summary`                  | `QuizSessionStore` contract test and E2E journey         |
| Presence             | Online/offline, disconnect, visibility restore, last seen         | `PresenceService`, `/admin/users`, `/admin/users/:uid` | Realtime Database manual UAT and user drill-down journey |
| Admin learning       | Admin can use dashboard, practice, reports, live and quiz run     | Admin **Learning** navigation to learner routes        | Admin role E2E journey; results retain admin UID         |
| Quick quiz           | Random syllabus-backed set                                        | `/practice` quick mode                                 | Practice journey                                         |
| Custom quiz          | Board, standard, multiple subjects/chapters and count             | `/practice` custom mode                                | Selection unit/integration coverage and E2E journey      |
| Timed quiz           | Per-question timer and auto-advance                               | `/quiz`                                                | Timer/advance journey, reduced-motion check              |
| Quiz safety          | Back/forward navigation, persisted answers, completion protection | `QuizSessionStore`, `/quiz`                            | Store unit tests and refresh journey                     |
| Review               | All/incorrect filters, explanations, retry all/incorrect          | `/quiz-summary`                                        | Retry contract tests and E2E journey                     |
| Flags                | One open record per question/user, content count metadata         | `/quiz-summary`, `questionFlags/{questionId}_{uid}`    | Firestore emulator test and admin flag review            |
| Reports              | Weighted metrics, trends, type mix, duration, delta, history      | `/reports`                                             | Calculation unit tests and report journey                |
| Historical attempts  | Reopen review; create practice set from attempt                   | `/reports`, `/admin/users/:uid`                        | Learner/admin E2E journeys                               |
| User administration  | Search/filter users, role, presence, profile                      | `/admin/users`                                         | Admin user-list journey                                  |
| User activity        | Attempts, trends, quiz mix, live participation, reset controls    | `/admin/users/:uid`                                    | Selected-user E2E journey                                |
| Question bank        | Cascading filters, inspect, edit, copy JSON, retire               | `/admin/questions`                                     | Admin content journey                                    |
| Question import      | Parse/validate/duplicate preview and bounded bulk write           | `/admin/questions` import panel                        | Import unit/integration tests and manual UAT             |
| Flag review          | List open question flags                                          | `/admin/questions`                                     | Admin content journey                                    |
| Syllabus             | Group/table view, add/edit, counts and MCQ drill-down             | `/admin/syllabus`                                      | Syllabus journey                                         |
| Syllabus propagation | Update matching question hierarchy in bounded batches with audit  | `AdminRepository.updateSyllabusAndQuestions`           | Emulator integration test and manual UAT                 |
| Live creation        | Scope, generated preview, scheduling, buffer, timing              | `/live`                                                | Host E2E journey                                         |
| Live lobby           | Code, participants, scheduled countdown, start now                | `/live/host/:sessionId`, `/live/play/:sessionId`       | Host/player multi-context journey                        |
| Live player          | Shared index/timer, reconnect answer restoration, result link     | `/live/play/:sessionId`                                | Concurrency journey and result verification              |
| Host control         | Start, previous/next override, responses, controlled end          | `/live/host/:sessionId`                                | Host journey                                             |
| Leaderboard          | Correctness/time scoring and deterministic ties                   | `/live/summary/:sessionId`                             | Ranking unit test and live summary journey               |
| Quiz run             | Configurable scope/count/pacing, join and shared lobby            | `/quiz-run`, `/quiz-run/lobby/:sessionId`              | Quiz-run host/player journey                             |
| Diagnostics          | Durable audit plus browser errors/warnings, copy and clear        | `/admin/logs`                                          | Admin diagnostics journey                                |
| Action Plan          | Board/table, detail, timeline and agent evidence                  | `/admin/action-plan`, `tools/gtop-mcp`                 | MCP contract tests and seeded workstreams                |
| Themes               | Five complete semantic themes and responsive preview              | `/admin/theme-lab`                                     | Five-theme visual regression matrix                      |
| Theme publishing     | Private preview and explicit shared UAT publish                   | `Meta/appearance`                                      | Firestore rules test and admin publish journey           |
| Motion/accessibility | Entrances, loading, charts, quiz/live feedback, reduced motion    | Global tokens and page components                      | Axe, keyboard and reduced-motion runs                    |
| Legacy URLs          | Existing bookmarks and admin aliases remain usable                | `app.routes.ts` redirects                              | Legacy-link E2E table                                    |

Production promotion requires every row above to have passing automated evidence or an explicit signed manual-UAT record, with no unresolved critical or high defects.
