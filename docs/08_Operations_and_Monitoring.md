# Operations and Monitoring
_File: 08_Operations_and_Monitoring.md_

## Scheduled Jobs / Cron
- No server-side cron jobs present. Build-time script `gen-syllabus-index.js` runs via npm `prebuild` hook to keep syllabus index updated.【F:package.json†L4-L14】【F:scripts/gen-syllabus-index.js†L1-L18】

## Logging
- Client-side console methods are patched by `LoggingService`, capturing `log/error/warn/info` entries with timestamps into an in-memory array exposed as `logs$` (used by admin Logs page).【F:src/app/services/logging.service.ts†L1-L35】【F:src/app/app.routes.ts†L145-L157】
- No external log shipping configured.

## Error Handling
- Authentication methods wrap calls in try/catch and log to console; One Tap failure is logged but non-blocking.【F:src/app/services/auth.service.ts†L60-L94】
- MCQ/quiz service methods throw or log errors on failed Firestore/Realtime operations; duplicate flagging raises `already-flagged`.【F:src/app/services/mcq.service.ts†L23-L77】【F:src/app/services/quiz.service.ts†L396-L455】

## Health Checks
- No explicit health-check endpoints; Firebase Hosting serves static SPA. Operational status inferred from Firebase console.

## Monitoring Live Activity
- Realtime DB `activeUsers` list gives live online/offline status for admins; auto-updates via listeners.【F:src/app/services/active-users.service.ts†L15-L144】
- Live quiz sessions observed via Firestore snapshots for session doc, participants, and answers collections.【F:src/app/services/live-quiz.service.ts†L65-L200】
