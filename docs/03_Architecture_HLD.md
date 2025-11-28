# Architecture HLD
_File: 03_Architecture_HLD.md_

## System Context (Text Diagram)
Users (students/admins) → Angular SPA (browser, service worker enabled) → Firebase services (Auth, Firestore, Realtime Database, Hosting).【F:src/app/app.config.ts†L1-L53】【F:src/app/app.routes.ts†L30-L320】

## High-Level Components
- **Angular App**: Routes for landing, dashboards, quiz flow, reports, admin tools, live quiz modules.【F:src/app/app.routes.ts†L30-L320】
- **Firebase Auth**: Google OAuth (popup/One Tap) manages identity; AuthGuard/RoleGuard gate routes.【F:src/app/services/auth.service.ts†L35-L207】【F:src/app/app.routes.ts†L55-L320】
- **Firestore**: Stores users, questions, syllabus, quiz results, live session metadata, flags, activity logs.【F:src/app/services/auth.service.ts†L93-L136】【F:src/app/services/mcq.service.ts†L23-L138】【F:src/app/services/quiz.service.ts†L159-L333】【F:src/app/services/syllabus.service.ts†L48-L118】【F:src/app/services/live-quiz.service.ts†L21-L200】
- **Realtime Database**: Tracks presence in `activeUsers` for live counts and admin visibility.【F:src/app/services/active-users.service.ts†L15-L144】
- **Service Worker/PWA**: Registered in production for offline caching.【F:src/app/app.config.ts†L40-L53】
- **Static Assets**: Syllabus JSON catalog indexed at build time for selection and preview.【F:scripts/gen-syllabus-index.js†L1-L18】

## Interaction Patterns
- **Frontend→Backend**: Client-side SDK calls (AngularFire) for Firestore queries, writes, and Realtime DB updates; no custom REST APIs.
- **Auth Flow**: Browser initiates Google sign-in; tokens handled by Firebase; user data persisted in Firestore; presence updated in Realtime DB.【F:src/app/services/auth.service.ts†L60-L150】【F:src/app/services/active-users.service.ts†L15-L80】
- **Quiz Data**: MCQs fetched from Firestore with filters; quiz results saved to `QuizResults`; flags increment question metadata; retries rely on cached/queried question IDs.【F:src/app/services/mcq.service.ts†L57-L138】【F:src/app/services/quiz.service.ts†L159-L333】【F:src/app/services/quiz.service.ts†L396-L485】
- **Syllabus**: Firestore `syllabus` collection synchronized to client BehaviorSubject; edits propagate to questions via batch updates; counts computed via count queries.【F:src/app/services/syllabus.service.ts†L16-L118】
- **Live Sessions**: Host/players subscribe to session docs and subcollections for participants/answers; scheduling computed client-side using anchor timestamps and optional overrides.【F:src/app/services/live-quiz.service.ts†L21-L200】【F:src/app/shared/models/live-quiz.models.ts†L33-L95】

## Async Processing
- **Snapshot listeners** for Firestore collections (users, syllabus, live sessions) keep UI reactive.【F:src/app/services/syllabus.service.ts†L16-L47】【F:src/app/services/live-quiz.service.ts†L117-L200】
- **Presence onDisconnect** in Realtime DB ensures cleanup when clients disconnect unexpectedly.【F:src/app/services/active-users.service.ts†L35-L70】
- **Build-time script** generates syllabus index before builds (`npm prebuild`).【F:package.json†L4-L14】【F:scripts/gen-syllabus-index.js†L1-L18】

## Architectural Decisions
- **Monolithic SPA** using Angular standalone components; no separate backend server.
- **Data in Firebase** to avoid server management; Firestore used for transactional data and Realtime DB for presence.
- **Role-based routing** enforced client-side; assumes Firestore user documents hold authoritative roles.
- **PWA enablement** via Angular service worker for production reliability.【F:src/app/app.config.ts†L40-L53】
