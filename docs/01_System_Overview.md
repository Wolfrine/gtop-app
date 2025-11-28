# System Overview
_File: 01_System_Overview.md_

Growth Tutorials Objective Practice (GTOP) is an Angular 17 single-page application backed by Firebase (Auth, Firestore, Realtime Database, Hosting, Service Worker) that lets students take MCQ-based quizzes, view reports, and join live quiz sessions while admins manage question banks, syllabus metadata, and user access.【F:src/app/app.routes.ts†L30-L320】【F:src/app/app.config.ts†L1-L53】

## User Types
- **User (student)** – default role created on sign-in; can take quizzes, view summaries, reports, live sessions.【F:src/app/services/auth.service.ts†L70-L150】【F:src/app/app.routes.ts†L158-L320】
- **Admin** – elevated role granting access to dashboards, MCQ management, syllabus management, logs, and user list views.【F:src/app/app.routes.ts†L80-L320】【F:src/app/services/active-users.service.ts†L204-L235】
- **Institute Admin (planned)** – redirect target exists but no dedicated routes; treated as TODO.【F:src/app/services/auth.service.ts†L217-L236】

## High-Level Features
- Google-based authentication (popup and One Tap) with Firestore user profile storage.【F:src/app/services/auth.service.ts†L35-L150】
- Dashboard with user/admin variants and profile setup flow.【F:src/app/app.routes.ts†L30-L110】
- Quiz play (quick/custom), summaries, retry logic, and reporting history saved to Firestore collections.【F:src/app/services/quiz.service.ts†L33-L363】
- Question bank CRUD for admins with syllabus linkage and MCQ counts.【F:src/app/services/mcq.service.ts†L23-L155】【F:src/app/services/syllabus.service.ts†L15-L118】
- Syllabus preview/edit and index generation from static assets.【F:scripts/gen-syllabus-index.js†L1-L18】
- Live quiz sessions with lobby/host/player/summary flows and quiz runs mode.【F:src/app/services/live-quiz.service.ts†L15-L120】【F:src/app/shared/models/live-quiz.models.ts†L1-L95】
- Presence tracking via Realtime Database and admin user list.【F:src/app/services/active-users.service.ts†L1-L120】
- SEO metadata per route and PWA service worker registration.【F:src/app/app.routes.ts†L30-L320】【F:src/app/app.config.ts†L31-L53】

## Tech Stack
- **Frontend**: Angular 17 with Angular Material and ng2-charts/Chart.js.【F:package.json†L9-L36】
- **Backend/Services**: Firebase Auth, Firestore, Realtime Database; client-side AngularFire integration.【F:src/app/app.config.ts†L1-L53】
- **Hosting/CI**: Firebase Hosting with GitHub Actions deploy workflow (main → prod, others → preview).【F:AGENTS.md†L13-L36】
- **Build/Tooling**: Node 20 (CI), Angular CLI, npm scripts, service worker for PWA.【F:package.json†L3-L22】【F:src/app/app.config.ts†L40-L53】
