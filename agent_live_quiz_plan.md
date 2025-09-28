# Live Quiz — Implementation Plan (Firestore)

Overview
- Goal: Add scheduled, Firestore‑driven live quizzes with auto‑advance and per‑question leaderboards while keeping existing quiz patterns intact and Reports working out‑of‑the‑box.
- Backend: Firestore only. No Realtime DB. Reuse existing `questions` and `QuizResults` collections and AngularFire patterns used in the app.

Principles
- Follow existing data access style: `onSnapshot` for live reads and one‑time fetches with immediate `unsubscribe()`, chunked `in` queries, `setDoc` for writes, `Timestamp.now()` for client timestamps.
- Minimize hot documents; shard writes by question.
- Keep correctness hidden during play; reveal only in summary.

User Flows
- Host/Admin
  - Create session with start time, buffer seconds, per‑question seconds, and question scope/count.
  - Share join code. Lobby shows participants joining during the buffer window.
  - At effective start (start + buffer), all clients auto‑start; host may override the current question index or end the quiz at any time.
- Participant
  - Join via code in the buffer window; auto‑start at effective time.
  - Answer within the configured per‑question time; after submitting, see a live leaderboard of who answered and how fast (no correctness).
  - Auto‑advance each question by the configured duration.
- Viewer/Admin (monitor)
  - Monitor roster and per‑question submissions/timings without answering.

Firestore Data Model
- LiveSessions/{sessionId}
  - host: `hostId`, `hostName`, `joinCode`
  - scope: `board`, `standard`, optional `subjectIds`, `chapterIds`
  - questions: `questionIds` string[] (IDs from shared `questions`)
  - scheduling: `scheduledStartAt` (Timestamp), `bufferSeconds` (number), `perQuestionSeconds` (number), `effectiveStartAt` (Timestamp), `autoAdvance` (boolean)
  - flow: `status` ('lobby' | 'active' | 'ended'), `overrideIndex` (number|null), `overrideAt` (Timestamp|null)
  - timestamps: `createdAt`, `updatedAt` (serverTimestamp)
  - linkage: `resultLinked` (boolean; set true once any participant saves a `QuizResults`)
- LiveSessions/{sessionId}/participants/{uid}
  - identity: `uid`, `displayName`, `photoURL`
  - join: `joinedAt` (serverTimestamp), `ready` (boolean)
  - aggregates (optional convenience): `submittedCount`, `totalResponseMs`, `lastAnswerAt`, `score`
  - presence: `lastSeen` (serverTimestamp, optional)
  - linkage: `resultId` (string; QuizResults doc ID for this user/session)
- LiveSessions/{sessionId}/answers/{questionIndex}/items/{uid}
  - submission: `uid`, `displayName`, `selectedIndex`, `submittedAt` (serverTimestamp), `responseMs`
- Questions source
  - No `questions` subcollection; fetch MCQs by `questionIds` from shared `questions` using chunked `in` queries.

Linking LiveSessions and QuizResults
- Each live result saved to `QuizResults` includes `sessionId` and `quizType: 'live'`.
- After saving, update `participants/{uid}.resultId` and set `LiveSessions.resultLinked = true`.
- Reports do not depend on these fields and already read `QuizResults`; this linkage enables deep drill‑downs from sessions.

Scheduling & Auto‑Advance
- Compute current question index on the client from schedule: `effectiveStartAt + index * perQuestionSeconds`.
- Host override: when `overrideIndex` changes, clients jump to that index immediately.
- Timing: use Firestore Timestamps for schedule fields; minor client clock drift is acceptable in v1.

Service API (LiveQuizService)
- `createSession(opts): Promise<{ sessionId, joinCode }>` — writes session doc with schedule and questionIds.
- `joinSessionByCode(code, user): Promise<{ sessionId }>` — finds lobby session by joinCode; writes participant doc.
- `observeSession(id, cb): () => void` — subscribe to session doc.
- `observeParticipants(id, cb): () => void` — subscribe to participants.
- `observeAnswers(id, index, cb): () => void` — subscribe to per‑question submissions for leaderboard.
- `fetchQuestionsForSession(session): Promise<any[]>` — fetch MCQs by `questionIds` (chunked `in`).
- `computeSchedule(session): { effectiveStartAt: Date; indexStartAt(index): Date }` — helper for timers.
- `submitAnswer(id, index, selectedIndex, questionStartAt): Promise<void>` — writes per‑question answer with `responseMs`.
- `overrideNext(id, nextIndex): Promise<void>` — sets `overrideIndex`, `overrideAt`.
- `endSession(id): Promise<void>` — sets `status = 'ended'`.

UI Components & Routes
- `LiveLandingComponent` — create/join (route `/live`).
- `LiveHostComponent` — roster, overrides (route `/live/host/:sessionId`).
- `LivePlayerComponent` — answering and per‑question leaderboard (route `/live/play/:sessionId`).
- `LiveResultsComponent` — optional; can reuse `QuizSummaryComponent` with expanded summaries.

Reporting Integration
- At end, each client computes correctness using fetched MCQs and calls `QuizService.saveQuizResult(userId, { userName, board, standard, subject, chapter, quizType: 'live', sessionId, questions: [{ id, selectedIndex, correctIndex }] })`.
- `QuizService.saveQuizResult` derives totals and writes to `QuizResults`, which Reports already consumes; live sessions appear automatically.
- After save, update `participants/{uid}.resultId` and optionally `LiveSessions.resultLinked`.

Listener Strategy & Performance
- One `onSnapshot` to session for all clients; one to participants for host/viewer; players may subscribe during lobby.
- Per‑question leaderboard subscribes to `answers/{index}/items` after user submits.
- Shard submissions by question to avoid hot spots; each user writes one small doc per question.
- Indexing: ensure `joinCode` has an index for equality lookups.

Security Rules (outline)
- Host only may mutate scheduling/overrides: `request.auth.uid == resource.data.hostId`.
- Participants can read the session and write their own docs under `participants/{uid}` and `answers/*/items/{uid}`.
- Do not enforce acceptingAnswers server‑side in v1; rely on schedule and UI. Tightening can be added later.

Validation & Edge Cases
- Duplicate join is idempotent with `setDoc(..., { merge: true })`.
- Re‑join after refresh: recompute index from schedule; honor `overrideIndex` if present.
- Late join during active: start from current scheduled index; past questions are unanswered.
- Correctness concealment: no correct answers shown during play. Anti‑cheat beyond this is out of scope for v1.

Acceptance Criteria
- Host can schedule session (configurable buffer and per‑question time), get join code, and see lobby roster.
- All clients auto‑start at effective time and auto‑advance by the configured per‑question seconds; host overrides take effect immediately.
- After submitting an answer, users see a live leaderboard (names + response times) for that question without revealing correctness.
- Host/viewer can monitor submissions and timings per question without answering.
- Each client saves a `QuizResults` doc with `quizType: 'live'` and `sessionId`; Reports show live sessions automatically.
- No changes to existing quick/custom quiz flows.

Phased Delivery (small, verifiable steps)
- Phase 0 — Types & schema: add TS interfaces and document Firestore paths.
- Phase 1 — Service skeleton: LiveQuizService stubs compile.
- Phase 2 — Create/Join UX: LiveLandingComponent; create → host route, join → player route. Add admin filter-driven random generation: Board (single), Standard (single), Subject(s) multi, Chapter(s) multi, Count (default 10). Use existing QuizService.fetchCustomQuizQuestions to generate and preview IDs. Selection Mode added with Randomize (active) and Manual (disabled, coming soon). CSV ID input removed; IDs derive from generated list.
- Phase 3 — Lobby & countdown: roster subscription and countdown to effective start.
- Phase 4 — Schedule engine: auto‑advance + override handling.
- Phase 5 — Answering + leaderboard: write submissions; subscribe to answers for current index.
- Phase 6 — Host/viewer monitor + overrides: controls and monitoring views.
 - Phase 6 — Host/viewer monitor + overrides: controls and monitoring views.
   - Host: show full question list (ordered by `questionIds`) with the currently-active question clearly highlighted.
   - Add an expansion panel per question that displays participants' submissions (name + response time), ordered by fastest; update live via answers snapshot.
   - Show per-question submission counts and a quick summary chip (e.g., n submitted / total participants) to help pacing.
   - Keep correctness hidden until the quiz ends; no answer keys in this view.
- Phase 7 — Results save + summary: compute, save via QuizService, update linkage, reuse summary UI.
- Phase 8 — Hardening: duplicate-submit guards, re‑join handling, drift tolerance.
  - Add clock skew mitigation: calibrate client/server offset by reading a `serverTimestamp` once and apply offset to local `Date.now()` in schedule math to avoid user device clock errors.

Out‑of‑Scope / Future Enhancements
- Short join links and share UX.
- Auto‑advance on all submitted or timer expiry preferences.
- Session archival/history under Admin.
- Manual selection list: Admin can browse filtered questions (by board/standard/subject/chapter), tick checkboxes to pick exact items up to a count cap, then create a session from the curated list. Implement after lobby/schedule phases (target Phase 6+).
  - Selection Mode already present in UI; Manual option is disabled in v1 and should be enabled when this feature lands.

Observations
- Quiz end time to also be calculated from start time and no of question + per question timer. Host client can update status. Rest of the clients to move to quiz summary once current time > quiz end time. Let gpt 5 also think if any better approach.
- Live quiz list display to show Board > Standard > Subjects > Chapters detail so that participants can know
- When users selects Live Quiz to join -> in case the board and standard are different then ask prompt whether they want to join this different board/standard quiz.
- Similarly Quiz summary component can be reused - only leaderboard to be added and icon against each question in case user wants to see question specific participants details
