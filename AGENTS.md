# Instructions for gtop-app Repository

This repository contains an Angular application called **gtop-app** (Growth Tutorials Objective Practice). It is generated with Angular CLI 17.3 and uses Firebase for backend services. The project is located inside the `gtop-app/` folder and includes components for quiz management, dashboards, and other learning features. Angular Material and Chart.js are used for UI and charts.

Useful commands (run inside `gtop-app/`):
- Always run `npm run build -- --configuration production` at the end of development to ensure the project builds successfully.
- `npm install` – install dependencies
- `npm start` or `ng serve` – run the development server
- `npm run build` – create a production build
- `ng test` – run unit tests

A GitHub Action workflow (`.github/workflows/firebase-deploy.yml`) deploys the Angular build to Firebase Hosting on pushes to the `main` branch.

## Components
- **HeaderComponent**, **FooterComponent**, **SideNavComponent**, **ManualQuizModalComponent**
- Pages: **LandingPage**, **ProfileSetup**, **UserDashboard**, **AdminDashboard**, **MCQManagement**, **AddMCQ**, **ManageSyllabus** (with **EditSyllabus**), **QuizPage**, **QuizSummary**, **ReportsPage**, **UserList**

## Services and Guards
- `AuthService` (handles Google authentication and session management)
- `ActiveUsersService` (tracks presence in Realtime Database)
- `MCQService` (CRUD operations for questions)
- `QuizService` (manages quiz logic)
- `SyllabusService` (syllabus combo management)
- `VersionService` (fetches app version from Firebase)
- `AuthGuard` / `RoleGuard` (route protection)

## Sitemap
```
/                      -> LandingPageComponent
/profile-setup         -> ProfileSetupComponent
/dashboard             -> UserDashboardComponent (user or admin)
/admin                 -> AdminDashboardComponent (admin only)
/admin/mcq-management  -> McqManagementComponent (admin only)
/admin/add-mcq         -> AddMcqComponent (admin only)
/admin/manage-syllabus -> ManageSyllabusComponent (admin only)
/admin/manage-syllabus/edit -> EditSyllabusComponent (admin only)
/admin/user-list       -> UserListComponent (admin only)
/quiz                  -> QuizPageComponent
/quiz-summary          -> QuizSummaryComponent
/reports               -> ReportsPageComponent
**                     -> redirect to '/'
```

## Typical user journeys
1. **New user** → visits `/` → signs in with Google → completes `/profile-setup` → lands on `/dashboard` → starts `/quiz` → sees `/quiz-summary` → checks `/reports`.
2. **Admin** → visits `/` → signs in → completes `/profile-setup` → accesses `/admin` → manages MCQs and syllabus via `/admin/mcq-management` or `/admin/manage-syllabus` → adds questions at `/admin/add-mcq` → views `/admin/user-list` for active users reports.
