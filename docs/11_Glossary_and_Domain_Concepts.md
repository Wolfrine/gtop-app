# Glossary and Domain Concepts
_File: 11_Glossary_and_Domain_Concepts.md_

- **GTOP (Growth Tutorials Objective Practice)**: Platform for MCQ practice, analytics, and live quizzes.【F:src/app/app.routes.ts†L30-L320】
- **Board/Standard**: Academic curriculum identifiers stored in user profiles and used to filter syllabus and questions.【F:src/app/services/auth.service.ts†L93-L130】【F:src/app/services/mcq.service.ts†L23-L77】
- **Subject/Chapter**: Syllabus breakdown used to categorize MCQs and drive quiz selection and counts.【F:src/app/services/syllabus.service.ts†L16-L47】【F:src/app/services/mcq.service.ts†L23-L77】
- **MCQ (Multiple Choice Question)**: Core question type with options and correct index in `questions` collection.【F:src/app/services/mcq.service.ts†L23-L77】
- **Syllabus Combo**: Unique combination of board, standard, subject, chapter stored in `syllabus` with `mcqCount`.【F:src/app/services/syllabus.service.ts†L16-L47】
- **QuizResult**: Firestore document summarizing a completed quiz attempt with per-question correctness and scores.【F:src/app/services/quiz.service.ts†L173-L219】
- **Quick Quiz**: Auto-generated quiz pulling 10 random questions from a random chapter that has MCQs.【F:src/app/services/quiz.service.ts†L49-L104】
- **Custom Quiz**: User-configured quiz filtered by board/standard with optional subject/chapter and question count.【F:src/app/services/quiz.service.ts†L106-L157】
- **Retry Context**: Metadata describing source of a retry (summary or reports) and whether incorrect-only or all questions should be retried; stored client-side by `QuizService`.【F:src/app/services/quiz.service.ts†L334-L395】
- **Question Flag**: User-reported issue stored in `questionFlags`; increments `flagCount` on question for admin review.【F:src/app/services/quiz.service.ts†L396-L455】
- **Live Session**: Real-time quiz event with lobby, host, player, and summary states stored in `LiveSessions` and subcollections.【F:src/app/shared/models/live-quiz.models.ts†L12-L95】【F:src/app/app.routes.ts†L210-L262】
- **Join Code**: Random code generated when creating live sessions allowing players to join lobby.【F:src/app/services/live-quiz.service.ts†L21-L64】
- **Anchor Index/Time**: Pair of fields (`anchorIndex`, `anchorAt`) used to compute current question based on schedule and optional overrides in live sessions.【F:src/app/shared/models/live-quiz.models.ts†L33-L71】
- **Quiz Run**: Scheduled competitive quiz mode using live session infrastructure in `run` mode; lobby under `/quiz-run/lobby/:sessionId`.【F:src/app/app.routes.ts†L184-L209】【F:src/app/shared/models/live-quiz.models.ts†L12-L30】
- **Active Users**: Presence records in Realtime DB capturing online/offline status and last activity; surfaced in admin user list.【F:src/app/services/active-users.service.ts†L15-L144】
- **UI Kitchen**: Admin-only preview route for experimental UI components (`/dev/ui`).【F:src/app/app.routes.ts†L304-L320】
