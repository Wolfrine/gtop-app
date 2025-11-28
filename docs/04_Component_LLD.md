# Component LLD
_File: 04_Component_LLD.md_

## Routing
- `app.routes.ts`: Defines SPA routes with SEO metadata and role-based guards for landing, profile, dashboards, quiz flow, admin tools, live sessions, reports, and dev UI kitchen.【F:src/app/app.routes.ts†L30-L320】

## Core Configuration
- `app.config.ts`: Provides router, hydration, Firebase app/auth/firestore/database, animations, and service worker registration (production only).【F:src/app/app.config.ts†L1-L53】

## Services
- **AuthService** (`services/auth.service.ts`): Handles Google popup/One Tap login, session check, Firestore user persistence, role-based redirect, presence hookup, and board/standard update. Exposes `user$` observable and sign-out routine.【F:src/app/services/auth.service.ts†L35-L236】
- **AuthGuard**/ **RoleGuard**: Route guards (not shown here) reading `AuthService` and route data roles for access control.【F:src/app/app.routes.ts†L55-L320】
- **ActiveUsersService**: Realtime DB presence tracking (`activeUsers/{uid}`), role updates, online/offline lists, and observables for admin monitoring.【F:src/app/services/active-users.service.ts†L15-L235】
- **MCQService**: CRUD helper for `questions` collection; batch add with creator metadata; fetch with filters/pagination; quick quiz fetch; links to `syllabus` updates and uses AngularFire Firestore queries/batches.【F:src/app/services/mcq.service.ts†L23-L155】
- **SyllabusService**: Maintains `syllabus$` BehaviorSubject from Firestore snapshot, refresh utilities, count recomputation, combo insertion, and edit that cascades updates to questions plus activity log creation.【F:src/app/services/syllabus.service.ts†L16-L118】
- **QuizService**: Manages in-memory quiz questions, pending retries, quick/custom fetch, result saving to `QuizResults`, history fetch, live leaderboard aggregation, retry reconstruction, question flagging, and summary expansion helpers.【F:src/app/services/quiz.service.ts†L15-L485】
- **LiveQuizService**: Creates/joins/observes live sessions in `LiveSessions`, manages participants and answers subcollections, lists upcoming sessions, and supports join-by-code vs direct join. Works with models in `shared/models/live-quiz.models.ts`.【F:src/app/services/live-quiz.service.ts†L15-L200】【F:src/app/shared/models/live-quiz.models.ts†L1-L95】
- **LoggingService**: Patches console methods to capture log entries into observable list for admin logs view.【F:src/app/services/logging.service.ts†L1-L35】
- **SeoService**, **VersionService**, **SyllabusPreviewService**: Auxiliary services (not detailed here) for meta tags, version fetch, and syllabus preview rendering (see source for specifics).【F:src/app/services/version.service.ts†L1-L120】

## Components/Pages (Selected)
- **LandingPageComponent**: Public entry prompting sign-in (see `pages/landing-page`). Route: `/`.【F:src/app/app.routes.ts†L30-L44】
- **ProfileSetupComponent**: Collects board/standard post-login. Route: `/profile-setup`.【F:src/app/app.routes.ts†L43-L55】
- **UserDashboard/AdminDashboard**: Authenticated dashboards for students/admins. Routes `/dashboard`, `/admin`.【F:src/app/app.routes.ts†L68-L110】
- **MCQManagement/AddMcq**: Admin views for question listing and creation. Routes `/admin/mcq-management`, `/admin/add-mcq`.【F:src/app/app.routes.ts†L93-L118】
- **ManageSyllabus/EditSyllabus/SyllabusPreview**: Admin syllabus management and preview. Routes `/admin/manage-syllabus`, `/admin/manage-syllabus/edit`, `/syllabus-preview`.【F:src/app/app.routes.ts†L119-L146】【F:src/app/app.routes.ts†L276-L289】
- **QuizPage/QuizSummary**: Quiz taking and summary views. Routes `/quiz`, `/quiz-summary`.【F:src/app/app.routes.ts†L158-L183】
- **ReportsPage**: Historical results and retry entry point. Route `/reports`.【F:src/app/app.routes.ts†L263-L275】
- **Live Landing/Host/Player/Summary**: Live quiz entry points. Routes `/live`, `/live/host/:sessionId`, `/live/play/:sessionId`, `/live/summary/:sessionId`.【F:src/app/app.routes.ts†L210-L262】
- **QuizRunLanding/QuizRunLobby**: Quiz run variant flows. Routes `/quiz-run`, `/quiz-run/lobby/:sessionId`.【F:src/app/app.routes.ts†L184-L209】
- **LogsComponent**: Admin log view backed by `LoggingService`. Route `/logs`.【F:src/app/app.routes.ts†L145-L157】【F:src/app/services/logging.service.ts†L1-L35】
- **UserListComponent**: Admin online/offline user directory using presence data. Route `/admin/user-list`.【F:src/app/app.routes.ts†L290-L302】【F:src/app/services/active-users.service.ts†L147-L171】

## Shared Models
- `shared/models/live-quiz.models.ts`: Interfaces for live session, participant, answers, schedule computation, and status enums guiding Firestore schema for live features.【F:src/app/shared/models/live-quiz.models.ts†L1-L95】

## Cross-Cutting Concerns
- **Presence & Role Management**: centralized in `ActiveUsersService` and `AuthService`.
- **SEO metadata**: route data consumed by SEO service (not shown) to set meta tags per view.【F:src/app/app.routes.ts†L30-L320】
- **Error/Logging**: Console patching via `LoggingService` captures client errors for admin view.【F:src/app/services/logging.service.ts†L1-L35】
- **PWA**: Service worker registration configured in `app.config.ts` for production only.【F:src/app/app.config.ts†L40-L53】
