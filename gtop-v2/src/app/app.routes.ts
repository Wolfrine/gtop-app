import { Routes } from '@angular/router';
import {
  adminLearningRedirectGuard,
  authGuard,
  legacyQuizEntryGuard,
  roleGuard,
} from './core/guards';

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
        canActivate: [adminLearningRedirectGuard('dashboard')],
        title: 'Your practice · GTOP',
        loadComponent: () => import('./pages/learner.pages').then((m) => m.LearnerDashboardPage),
      },
      {
        path: 'practice',
        canActivate: [adminLearningRedirectGuard('practice')],
        title: 'Build practice · GTOP',
        loadComponent: () =>
          import('./pages/practice-quiz.pages').then((m) => m.PracticeBuilderPage),
      },
      {
        path: 'quiz',
        canActivate: [legacyQuizEntryGuard],
        data: { shellDisplay: 'immersive' },
        title: 'Quiz · GTOP',
        loadComponent: () => import('./pages/practice-quiz.pages').then((m) => m.QuizPlayerPage),
      },
      {
        path: 'quiz-summary',
        canActivate: [adminLearningRedirectGuard('quiz-summary')],
        title: 'Quiz review · GTOP',
        loadComponent: () => import('./pages/practice-quiz.pages').then((m) => m.QuizSummaryPage),
      },
      {
        path: 'reports',
        canActivate: [adminLearningRedirectGuard('reports')],
        title: 'Reports · GTOP',
        loadComponent: () => import('./pages/practice-quiz.pages').then((m) => m.ReportsPage),
      },
      {
        path: 'profile',
        canActivate: [adminLearningRedirectGuard('profile')],
        title: 'Profile · GTOP',
        loadComponent: () => import('./pages/public.pages').then((m) => m.ProfilePage),
      },
      {
        path: 'live',
        canActivate: [adminLearningRedirectGuard('live')],
        title: 'Live practice · GTOP',
        loadComponent: () => import('./pages/live-v2.pages').then((m) => m.LiveHubPage),
      },
      {
        path: 'live/host/:sessionId',
        canActivate: [adminLearningRedirectGuard('live/host')],
        data: { shellDisplay: 'immersive' },
        title: 'Host live quiz · GTOP',
        loadComponent: () => import('./pages/live-v2.pages').then((m) => m.LiveSessionPage),
      },
      {
        path: 'live/play/:sessionId',
        canActivate: [adminLearningRedirectGuard('live/play')],
        data: { shellDisplay: 'immersive' },
        title: 'Play live quiz · GTOP',
        loadComponent: () => import('./pages/live-v2.pages').then((m) => m.LiveSessionPage),
      },
      {
        path: 'live/summary/:sessionId',
        canActivate: [adminLearningRedirectGuard('live/summary')],
        title: 'Live summary · GTOP',
        loadComponent: () => import('./pages/live-v2.pages').then((m) => m.LiveSessionPage),
      },
      {
        path: 'quiz-run',
        canActivate: [adminLearningRedirectGuard('quiz-run')],
        title: 'Quiz run · GTOP',
        loadComponent: () => import('./pages/live-v2.pages').then((m) => m.QuizRunPage),
      },
      {
        path: 'quiz-run/lobby/:sessionId',
        canActivate: [adminLearningRedirectGuard('quiz-run/lobby')],
        data: { shellDisplay: 'immersive' },
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
        path: 'question-paper-generator',
        title: 'Question paper generator · GTOP',
        loadComponent: () =>
          import('./pages/question-paper-generator.page').then(
            (m) => m.QuestionPaperGeneratorPage,
          ),
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
      {
        path: 'learning/dashboard',
        title: 'Admin learning dashboard · GTOP',
        loadComponent: () => import('./pages/learner.pages').then((m) => m.LearnerDashboardPage),
      },
      {
        path: 'learning/practice',
        title: 'Admin practice · GTOP',
        loadComponent: () =>
          import('./pages/practice-quiz.pages').then((m) => m.PracticeBuilderPage),
      },
      {
        path: 'learning/quiz',
        data: { shellDisplay: 'immersive' },
        title: 'Admin quiz · GTOP',
        loadComponent: () => import('./pages/practice-quiz.pages').then((m) => m.QuizPlayerPage),
      },
      {
        path: 'learning/quiz-summary',
        title: 'Admin quiz review · GTOP',
        loadComponent: () => import('./pages/practice-quiz.pages').then((m) => m.QuizSummaryPage),
      },
      {
        path: 'learning/reports',
        title: 'My admin practice reports · GTOP',
        loadComponent: () => import('./pages/practice-quiz.pages').then((m) => m.ReportsPage),
      },
      {
        path: 'learning/profile',
        title: 'Admin profile · GTOP',
        loadComponent: () => import('./pages/public.pages').then((m) => m.ProfilePage),
      },
      {
        path: 'learning/live',
        title: 'Admin live practice · GTOP',
        loadComponent: () => import('./pages/live-v2.pages').then((m) => m.LiveHubPage),
      },
      {
        path: 'learning/live/host/:sessionId',
        data: { shellDisplay: 'immersive' },
        title: 'Host live quiz · GTOP',
        loadComponent: () => import('./pages/live-v2.pages').then((m) => m.LiveSessionPage),
      },
      {
        path: 'learning/live/play/:sessionId',
        data: { shellDisplay: 'immersive' },
        title: 'Play live quiz · GTOP',
        loadComponent: () => import('./pages/live-v2.pages').then((m) => m.LiveSessionPage),
      },
      {
        path: 'learning/live/summary/:sessionId',
        title: 'Live summary · GTOP',
        loadComponent: () => import('./pages/live-v2.pages').then((m) => m.LiveSessionPage),
      },
      {
        path: 'learning/quiz-run',
        title: 'Admin quiz run · GTOP',
        loadComponent: () => import('./pages/live-v2.pages').then((m) => m.QuizRunPage),
      },
      {
        path: 'learning/quiz-run/lobby/:sessionId',
        data: { shellDisplay: 'immersive' },
        title: 'Admin quiz run lobby · GTOP',
        loadComponent: () => import('./pages/live-v2.pages').then((m) => m.LiveSessionPage),
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
