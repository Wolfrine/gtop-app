import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/guards';

const learnerGuards = [authGuard, roleGuard(['user', 'admin'])];
const adminGuards = [authGuard, roleGuard(['admin'])];

export const routes: Routes = [
  {
    path: '',
    title: 'GTOP · Practice with clarity',
    loadComponent: () => import('./pages/public.pages').then((m) => m.LandingPage),
  },
  {
    path: 'privacy',
    title: 'Privacy · GTOP',
    loadComponent: () => import('./pages/public.pages').then((m) => m.StaticPage),
  },
  {
    path: 'profile-setup',
    title: 'Set up your profile · GTOP',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/public.pages').then((m) => m.ProfilePage),
  },
  {
    path: '',
    canActivate: learnerGuards,
    loadComponent: () => import('./shared/shells').then((m) => m.LearnerShellComponent),
    children: [
      {
        path: 'dashboard',
        title: 'Your practice · GTOP',
        loadComponent: () => import('./pages/learner.pages').then((m) => m.LearnerDashboardPage),
      },
      {
        path: 'practice',
        title: 'Build practice · GTOP',
        loadComponent: () =>
          import('./pages/practice-quiz.pages').then((m) => m.PracticeBuilderPage),
      },
      {
        path: 'quiz',
        title: 'Quiz · GTOP',
        loadComponent: () => import('./pages/practice-quiz.pages').then((m) => m.QuizPlayerPage),
      },
      {
        path: 'quiz-summary',
        title: 'Quiz review · GTOP',
        loadComponent: () => import('./pages/practice-quiz.pages').then((m) => m.QuizSummaryPage),
      },
      {
        path: 'reports',
        title: 'Reports · GTOP',
        loadComponent: () => import('./pages/practice-quiz.pages').then((m) => m.ReportsPage),
      },
      {
        path: 'profile',
        title: 'Profile · GTOP',
        loadComponent: () => import('./pages/public.pages').then((m) => m.ProfilePage),
      },
      {
        path: 'live',
        title: 'Live practice · GTOP',
        loadComponent: () => import('./pages/live-v2.pages').then((m) => m.LiveHubPage),
      },
      {
        path: 'live/host/:sessionId',
        title: 'Host live quiz · GTOP',
        loadComponent: () => import('./pages/live-v2.pages').then((m) => m.LiveSessionPage),
      },
      {
        path: 'live/play/:sessionId',
        title: 'Play live quiz · GTOP',
        loadComponent: () => import('./pages/live-v2.pages').then((m) => m.LiveSessionPage),
      },
      {
        path: 'live/summary/:sessionId',
        title: 'Live summary · GTOP',
        loadComponent: () => import('./pages/live-v2.pages').then((m) => m.LiveSessionPage),
      },
      {
        path: 'quiz-run',
        title: 'Quiz run · GTOP',
        loadComponent: () => import('./pages/live-v2.pages').then((m) => m.QuizRunPage),
      },
      {
        path: 'quiz-run/lobby/:sessionId',
        title: 'Quiz run lobby · GTOP',
        loadComponent: () => import('./pages/live-v2.pages').then((m) => m.LiveSessionPage),
      },
    ],
  },
  {
    path: 'admin',
    canActivate: adminGuards,
    loadComponent: () => import('./shared/shells').then((m) => m.AdminShellComponent),
    children: [
      {
        path: '',
        title: 'Administration · GTOP',
        loadComponent: () => import('./pages/admin.pages').then((m) => m.AdminDashboardPage),
      },
      {
        path: 'action-plan',
        title: 'Action plan · GTOP',
        loadComponent: () => import('./pages/action-plan.page').then((m) => m.ActionPlanPage),
      },
      {
        path: 'questions',
        title: 'Question bank · GTOP',
        loadComponent: () => import('./pages/admin.pages').then((m) => m.QuestionBankPage),
      },
      {
        path: 'syllabus',
        title: 'Syllabus · GTOP',
        loadComponent: () => import('./pages/admin.pages').then((m) => m.SyllabusAdminPage),
      },
      {
        path: 'users',
        title: 'Users · GTOP',
        loadComponent: () => import('./pages/admin.pages').then((m) => m.UsersAdminPage),
      },
      {
        path: 'users/:uid',
        title: 'User activity · GTOP',
        loadComponent: () => import('./pages/user-activity.page').then((m) => m.UserActivityPage),
      },
      {
        path: 'theme-lab',
        title: 'Theme Lab · GTOP',
        loadComponent: () => import('./pages/theme-lab.page').then((m) => m.ThemeLabPage),
      },
      {
        path: 'reports',
        title: 'Practice reports · GTOP',
        loadComponent: () => import('./pages/admin.pages').then((m) => m.AdminOperationsPage),
      },
      {
        path: 'live',
        title: 'Live control · GTOP',
        loadComponent: () => import('./pages/admin.pages').then((m) => m.AdminOperationsPage),
      },
      {
        path: 'logs',
        title: 'Activity logs · GTOP',
        loadComponent: () => import('./pages/admin.pages').then((m) => m.AdminOperationsPage),
      },
    ],
  },
  { path: 'admin/mcq-management', redirectTo: 'admin/questions', pathMatch: 'full' },
  { path: 'admin/add-mcq', redirectTo: 'admin/questions', pathMatch: 'full' },
  { path: 'admin/manage-syllabus', redirectTo: 'admin/syllabus', pathMatch: 'full' },
  { path: 'admin/manage-syllabus/edit', redirectTo: 'admin/syllabus', pathMatch: 'full' },
  { path: 'admin/user-list', redirectTo: 'admin/users', pathMatch: 'full' },
  { path: 'admin/user-profile/:uid', redirectTo: 'admin/users/:uid', pathMatch: 'full' },
  { path: 'syllabus-preview', redirectTo: 'admin/syllabus', pathMatch: 'full' },
  { path: 'logs', redirectTo: 'admin/logs', pathMatch: 'full' },
  { path: 'dev/ui', redirectTo: 'admin', pathMatch: 'full' },
  { path: '**', loadComponent: () => import('./pages/public.pages').then((m) => m.StaticPage) },
];
