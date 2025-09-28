# Instructions for gtop-app Repository

This repository contains an Angular application called **gtop-app** (Growth Tutorials Objective Practice). It is generated with Angular CLI 17.3 and uses Firebase for backend services. The project is located inside the `gtop-app/` folder and includes components for quiz management, dashboards, and other learning features. Angular Material and Chart.js are used for UI and charts.

## UI/UX Implementation Plan
- A phase-wise UI/UX roadmap is maintained in `agent_uiux_plan.md`. Review it before starting any visual or interaction changes and update phase checkboxes plus notes when milestones ship.

Useful commands (run inside `gtop-app/`):
- Always run `npm run build -- --configuration production` at the end of development to ensure the project builds successfully.
- `npm install` – install dependencies
- `npm start` or `ng serve` – run the development server
- `npm run build` – create a production build
- `ng test` – run unit tests

A GitHub Action workflow (`.github/workflows/firebase-deploy.yml`) deploys the Angular build to Firebase Hosting on pushes to the `main` branch.

## Deployment Process
- Automated deployments run on every push via the `Deploy to Firebase Hosting` workflow. The job installs dependencies with `npm ci`, builds with `npm run build -- --configuration production`, and publishes the `gtop-app` entry point using the Firebase Hosting GitHub Action.
- The workflow authenticates with `secrets.GITHUB_TOKEN` and `secrets.FIREBASE_SERVICE_ACCOUNT` and uses `node@20` in the CI environment.
- Pushes to `main` deploy to the `prod-gtop-app` hosting target (live site); pushes to any other branch deploy to the `dev-gtop-app` preview channel so changes can be verified before merging.
- Before pushing, run `npm run build -- --configuration production` locally to catch build issues early. Commit the compiled Angular output generated during CI only if explicitly required—Firebase hosting deploys the build artifacts created in the workflow.
- For emergency manual releases, authenticate with Firebase CLI (`firebase login`) and run `firebase deploy --only hosting:prod-gtop-app` from inside the `gtop-app/` directory. Use `firebase deploy --only hosting:dev-gtop-app` if you need to refresh the preview environment.

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


## Future To-Do - you can ask if these are to be taken up next. And can remove once they are completed
1. Live Quiz
2. Report graph to summarize over months in case there are large number of quiz taken
3. Reports to load only 10 previous quiz at a time - currently all quiz are loading. Check for firestore calls though.
4. Implement footer version bump on each change done by codex
5. AI/LLM based integration for quiz addition - which will get manually reviewed
6. Reports to include subject and chapter wise overview
7. Dashboard Last Score is not showing the latest one. Reports last score is proper.
8. Custom quiz are saved as quick quiz so that needs to be corrected and accordingly shown in reports.