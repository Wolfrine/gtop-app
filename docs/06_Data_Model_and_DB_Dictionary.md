# Data Model and DB Dictionary
_File: 06_Data_Model_and_DB_Dictionary.md_

## Firestore Collections

### users
- **Purpose:** Store authenticated user profiles and roles.
- **Fields:**
  - `uid` (string, PK) – Firebase UID.【F:src/app/services/auth.service.ts†L93-L130】
  - `displayName` (string)
  - `email` (string)
  - `photoURL` (string|null)
  - `createdOn` (timestamp, default now if missing)
  - `board` (string|null)
  - `standard` (string|null)
  - `role` (string, default `user` when missing)【F:src/app/services/auth.service.ts†L93-L117】
- **Relationships:** Referenced by presence tracking and role guard.

### questions
- **Purpose:** MCQ bank for quizzes.
- **Fields:** `board`, `standard`, `subject`, `chapter`, `title`, `question`, `options[]`, `correctIndex` (number), `solutions[]`, `createdAt` (serverTimestamp), `createdBy` (uid), optional `flagCount` (number), `lastFlaggedAt` (timestamp).【F:src/app/services/mcq.service.ts†L23-L77】【F:src/app/services/quiz.service.ts†L396-L455】
- **Constraints/Rules:** Correct index validated; missing/invalid set to `-1` to indicate incomplete question.【F:src/app/services/mcq.service.ts†L34-L55】
- **Relationships:** Linked to syllabus combos; counts computed per combo; flags increment `flagCount`.

### deletedQuestions
- **Purpose:** Archive for removed MCQs (implied by service collection reference).【F:src/app/services/mcq.service.ts†L19-L23】

### syllabus
- **Purpose:** Track board/standard/subject/chapter combinations and MCQ counts.
- **Fields:** `board`, `standard`, `subject`, `chapter`, `mcqCount` (number, default 0), `createdAt` (timestamp).【F:src/app/services/syllabus.service.ts†L16-L47】【F:src/app/services/syllabus.service.ts†L87-L118】
- **Relationships:** Used to filter questions; counts updated when MCQs change; edits update related questions and log activity.

### activity
- **Purpose:** Admin change log (e.g., syllabus edits).
- **Fields:** `type`, `editedBy`, `timestamp`, `syllabusId`, `originalValue`, `newValue`, `affectedDocuments` (array of question IDs).【F:src/app/services/syllabus.service.ts†L68-L109】

### QuizResults
- **Purpose:** Persist quiz attempts.
- **Fields:** `userId`, `userName`, `standard`, `subject`, `chapter`, `quizType`, optional `sessionId`, `totalQuestions`, `correctAnswers`, `wrongAnswers`, `percentage`, `timestamp`, `questions[]` ({ `questionId`, `selectedIndex`, `correctIndex`, `isCorrect` }).【F:src/app/services/quiz.service.ts†L173-L219】
- **Relationships:** Session linkage for live quiz via `sessionId`; used by reports and retry.

### questionFlags
- **Purpose:** Capture flagged questions per user.
- **Fields:** `questionId`, `userId`, `flaggedAt`, question metadata, `correctIndex`, `selectedIndex`.【F:src/app/services/quiz.service.ts†L396-L455】
- **Constraints:** Unique doc per question-user pair (ID composition enforces uniqueness). Duplicate flag throws `already-flagged`.【F:src/app/services/quiz.service.ts†L408-L428】

### LiveSessions
- **Purpose:** Represent live/quiz-run sessions.
- **Fields:** per `LiveSession` model (join code, host, mode, scope, questionIds, scheduling, pacing, status, override, timestamps, resultLinked).【F:src/app/shared/models/live-quiz.models.ts†L12-L71】【F:src/app/services/live-quiz.service.ts†L21-L64】
- **Subcollections:**
  - `participants` – participant records with readiness, timestamps, optional aggregates.【F:src/app/shared/models/live-quiz.models.ts†L73-L95】【F:src/app/services/live-quiz.service.ts†L65-L116】
  - `answers/{index}/items` – responses with `selectedIndex` and `responseMs`.【F:src/app/shared/models/live-quiz.models.ts†L83-L95】【F:src/app/services/live-quiz.service.ts†L117-L200】

## Realtime Database

### activeUsers/{uid}
- **Purpose:** Track presence and last active time.
- **Fields:** `userId`, `displayName`, `email`, `lastActive` (ms), `isOnline` (bool).【F:src/app/services/active-users.service.ts†L35-L70】
- **Behavior:** `onDisconnect` marks `isOnline:false`; visibility changes reassert presence; admin list aggregates online/offline counts.【F:src/app/services/active-users.service.ts†L28-L120】

## Static Assets
- **Syllabus JSON** (`src/assets/syllabus/*.json`): structured subject/chapter data per board/standard; `index.json` generated with board/standard references for UI selectors.【F:scripts/gen-syllabus-index.js†L1-L18】
