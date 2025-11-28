# API Reference
_File: 05_API_Reference.md_

GTOP uses Firebase client SDKs rather than custom HTTP APIs. The following logical operations map to Firestore and Realtime Database access patterns.

## Authentication
- **Google Sign-In (Popup)**: `AuthService.signInWithGoogle()` → Firebase Auth Google provider popup; on success, writes/merges user doc in `users/{uid}` and redirects to dashboard.【F:src/app/services/auth.service.ts†L60-L117】
- **Google One Tap**: `AuthService.initGoogleOneTap()` loads Google script (non-localhost) and handles credential to sign in with Firebase, then stores user and subscribes to updates.【F:src/app/services/auth.service.ts†L35-L94】
- **Sign Out**: `AuthService.signOut()` marks user offline in Realtime DB and calls Firebase `signOut`, then routes to landing.【F:src/app/services/auth.service.ts†L186-L207】

## User Presence (Realtime Database)
- Path: `activeUsers/{uid}`
- Fields: `userId`, `displayName`, `email`, `lastActive` (timestamp ms), `isOnline` (bool).【F:src/app/services/active-users.service.ts†L35-L70】
- Operations: set/update on auth state; `onDisconnect` sets offline; admin views subscribe to `activeUsers` root to list users.【F:src/app/services/active-users.service.ts†L35-L120】

## Firestore Collections
### users/{uid}
- Fields: `uid`, `displayName`, `email`, `photoURL`, `createdOn`, `board`, `standard`, `role` (default `user`).【F:src/app/services/auth.service.ts†L93-L130】
- Operations: created/merged on login; role updates via ActiveUsersService `updateUserRole`.【F:src/app/services/active-users.service.ts†L194-L212】

### questions/{id}
- Fields: `board`, `standard`, `subject`, `chapter`, `title`, `question`, `options[]`, `correctIndex`, `solutions[]`, `createdAt`, `createdBy`, optional `flagCount`, `lastFlaggedAt`.【F:src/app/services/mcq.service.ts†L23-L77】【F:src/app/services/quiz.service.ts†L396-L455】
- Operations:
  - **Add MCQs**: batch `set` with creator/timestamp; triggers syllabus insert/count update.【F:src/app/services/mcq.service.ts†L23-L77】【F:src/app/services/syllabus.service.ts†L87-L118】
  - **Fetch MCQs**: filtered queries by board/standard/subject/chapter with pagination when chapter missing; quick quiz random chapter query picks 10 shuffled.【F:src/app/services/mcq.service.ts†L57-L138】【F:src/app/services/quiz.service.ts†L49-L104】
  - **Flag Question**: set `questionFlags/{questionId_userId}` and increment `flagCount` & `lastFlaggedAt`. Duplicate flag returns `already-flagged`.【F:src/app/services/quiz.service.ts†L396-L455】

### syllabus/{id}
- Fields: `board`, `standard`, `subject`, `chapter`, `mcqCount`, `createdAt`.【F:src/app/services/syllabus.service.ts†L16-L47】【F:src/app/services/syllabus.service.ts†L87-L118】
- Operations: snapshot subscription for UI; insert if missing when MCQs added; count recomputation; edit updates related questions; logs activity to `activity/{logId}` with change summary and affected question IDs.【F:src/app/services/syllabus.service.ts†L87-L118】

### QuizResults/{id}
- Fields: `userId`, `userName`, `standard`, `subject`, `chapter`, `quizType`, `sessionId?`, `totalQuestions`, `correctAnswers`, `wrongAnswers`, `percentage`, `timestamp`, `questions[]` (`questionId`, `selectedIndex`, `correctIndex`, `isCorrect`).【F:src/app/services/quiz.service.ts†L173-L219】
- Operations: saved after quiz via `saveQuizResult`; fetched by user via `fetchUserQuizResults`.【F:src/app/services/quiz.service.ts†L159-L333】

### questionFlags/{questionId_userId}
- Fields: `questionId`, `userId`, `flaggedAt`, question metadata, selected/correct indexes.【F:src/app/services/quiz.service.ts†L396-L455】

### LiveSessions/{sessionId}
- Fields per `LiveSession` model: `hostId`, `hostName`, `joinCode`, `mode`, `maxParticipants`, `scope {board, standard, subjectIds?, chapterIds?}`, `questionIds[]`, `scheduledStartAt`, `bufferSeconds`, `perQuestionSeconds`, `effectiveStartAt`, `autoAdvance`, `anchorIndex`, `anchorAt`, `status`, `overrideIndex`, `overrideAt`, `startedAt`, `createdAt`, `updatedAt`, `resultLinked`.【F:src/app/shared/models/live-quiz.models.ts†L12-L71】【F:src/app/services/live-quiz.service.ts†L21-L64】
- Subcollections:
  - **participants/{uid}**: `uid`, `displayName`, `photoURL`, `joinedAt`, `ready`, aggregates optional fields.【F:src/app/shared/models/live-quiz.models.ts†L73-L95】【F:src/app/services/live-quiz.service.ts†L65-L116】
  - **answers/{questionIndex}/items/{uid}**: `uid`, `displayName`, `selectedIndex`, `submittedAt`, `responseMs`.【F:src/app/shared/models/live-quiz.models.ts†L83-L95】【F:src/app/services/live-quiz.service.ts†L117-L200】
- Operations: create session with generated join code; join by code (live) or direct ID; observe session/participants/answers; compute leaderboard via `fetchLiveResultsForSession` using stored answers and question keys.【F:src/app/services/live-quiz.service.ts†L21-L200】【F:src/app/services/quiz.service.ts†L240-L332】

## Build-Time Script
- `scripts/gen-syllabus-index.js`: scans `src/assets/syllabus/*.json` to produce `index.json` with board/standard/file metadata before builds (`npm prebuild`).【F:scripts/gen-syllabus-index.js†L1-L18】【F:package.json†L4-L14】
