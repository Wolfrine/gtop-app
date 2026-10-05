import { Routes } from '@angular/router';
import { labGuard } from './pages/learning-lab/learning-lab.service';
import { LandingPageComponent } from './pages/landing-page/landing-page.component';
import { ProfileSetupComponent } from './pages/profile-setup/profile-setup.component';
import { UserDashboardComponent } from './pages/user-dashboard/user-dashboard.component';
import { AdminDashboardComponent } from './pages/admin-dashboard/admin-dashboard.component';
import { McqManagementComponent } from './pages/mcq-management/mcq-management.component';
import { AddMcqComponent } from './pages/add-mcq/add-mcq.component';
import { AuthGuard } from './services/auth.guard';
import { RoleGuard } from './services/role.guard';
import { ManageSyllabusComponent } from './pages/manage-syllabus/manage-syllabus.component'; // ✅ Import Manage Syllabus Component
import { QuizPageComponent } from './pages/quiz-page/quiz-page.component';
import { QuizSummaryComponent } from './pages/quiz-summary/quiz-summary.component';
import { EditSyllabusComponent } from './pages/manage-syllabus/edit-syllabus/edit-syllabus.component';
import { ReportsPageComponent } from './pages/reports-page/reports-page.component';
import { UserListComponent } from './pages/admin-dashboard/user-list/user-list.component';
import { ProfileComponent } from './pages/profile/profile.component';
import { SyllabusPreviewComponent } from './pages/syllabus-preview/syllabus-preview.component';
import { LogsComponent } from './pages/logs/logs.component';
import { UiKitchenComponent } from './pages/ui-kitchen/ui-kitchen.component';
import { LiveLandingComponent } from './pages/live/live-landing/live-landing.component';
import { LiveHostComponent } from './pages/live/live-host/live-host.component';
import { LivePlayerComponent } from './pages/live/live-player/live-player.component';
import { LiveSummaryComponent } from './pages/live/live-summary/live-summary.component';
import { QuizRunLandingComponent } from './pages/quiz-run/quiz-run-landing/quiz-run-landing.component';
import { QuizRunLobbyComponent } from './pages/quiz-run/quiz-run-lobby/quiz-run-lobby.component';




export const routes: Routes = [
    {
        path: 'admin/question-papers/legacy',
        loadComponent: () => import('./features/question-bank/pages/question-papers.page').then(m => m.QuestionPapersPage),
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['admin'], seo: { title: 'Earlier paper requests | GTOP Admin', robots: 'noindex, nofollow' } },
    },
    {
        path: 'admin/question-papers/view/:paperId',
        loadComponent: () => import('./features/question-bank/pages/paper-chat-viewer.page').then(m => m.PaperChatViewerPage),
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['admin'], seo: { title: 'Saved paper | GTOP Admin', robots: 'noindex, nofollow' } },
    },
    {
        path: 'admin/question-papers/all',
        loadComponent: () => import('./features/question-bank/pages/paper-chat.page').then(m => m.PaperChatPage),
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['admin'], seo: { title: 'All papers | GTOP Admin', robots: 'noindex, nofollow' } },
    },
    {
        path: 'admin/question-papers/new',
        loadComponent: () => import('./features/question-bank/pages/paper-chat.page').then(m => m.PaperChatPage),
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['admin'], paperMode: 'new', seo: { title: 'New paper | GTOP Admin', robots: 'noindex, nofollow' } },
    },
    {
        path: 'admin/question-papers',
        loadComponent: () => import('./features/question-bank/pages/paper-chat.page').then(m => m.PaperChatPage),
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['admin'], seo: { title: 'Questions & papers | GTOP', robots: 'noindex, nofollow' } },
    },
    {
        path: 'admin/question-papers/chat/:conversationId',
        loadComponent: () => import('./features/question-bank/pages/paper-chat.page').then(m => m.PaperChatPage),
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['admin'], seo: { title: 'Paper chat | GTOP Admin', robots: 'noindex, nofollow' } },
    },
    {
        path: 'admin/question-library',
        loadComponent: () => import('./features/question-bank/pages/question-library.page').then(m => m.QuestionLibraryPage),
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['admin'], seo: { title: 'Questions & papers | GTOP', robots: 'noindex, nofollow' } },
    },
    {
        path: 'admin/question-bank',
        loadComponent: () => import('./features/question-bank/pages/question-bank-workspace.page').then(m => m.QuestionBankWorkspacePage),
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['admin'], seo: { title: 'Question bank | GTOP Admin', robots: 'noindex, nofollow' } }
    },
    {
        path: 'admin/question-paper-generator',
        loadComponent: () => import('./features/question-bank/pages/question-paper-generator.page').then(m => m.QuestionPaperGeneratorPage),
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['admin'], seo: { title: 'Question papers | GTOP Admin', robots: 'noindex, nofollow' } }
    },
    {
        path: 'admin/question-review',
        loadComponent: () => import('./features/question-bank/pages/question-review-workbench.page').then(m => m.QuestionReviewWorkbenchPage),
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['admin'], seo: { title: 'Review new questions | GTOP Admin', robots: 'noindex, nofollow' } }
    },
    {
        path: 'learning-lab',
        loadComponent: () => import('./pages/learning-lab/learning-lab.component').then(m => m.LearningLabComponent),
        canActivate: [labGuard],
        data: { seo: { title: 'Learning Lab | GTOP', description: 'Learn by predicting, experimenting and explaining.', robots: 'noindex, nofollow' } }
    },
    {
        path: 'learning-lab/plants',
        loadComponent: () => import('./pages/learning-lab/plant-lab.component').then(m => m.PlantLabComponent),
        canActivate: [labGuard],
        data: { seo: { title: 'Plant Reproduction Lab | GTOP', description: 'Explore flower anatomy, pollination, fertilisation, seeds and vegetative propagation.', robots: 'noindex, nofollow' } }
    },
    {
        path: 'learning-lab/plants/results',
        loadComponent: () => import('./pages/learning-lab/plant-results.component').then(m => m.PlantResultsComponent),
        canActivate: [labGuard],
        data: { adminOnly: true, seo: { title: 'Plant Reproduction Feedback | GTOP', robots: 'noindex, nofollow' } }
    },
    {
        path: 'learning-lab/current',
        loadComponent: () => import('./pages/learning-lab/current-lab.component').then(m => m.CurrentLabComponent),
        canActivate: [labGuard],
        data: { seo: { title: 'Current Lab — Electricity | GTOP', description: 'Explore voltage, resistance and current in three interactive experiments.', robots: 'noindex, nofollow' } }
    },
    {
        path: 'learning-lab/results',
        loadComponent: () => import('./pages/learning-lab/lab-results.component').then(m => m.LabResultsComponent),
        canActivate: [labGuard],
        data: { adminOnly: true, seo: { title: 'Learning Lab Results & Feedback | GTOP', robots: 'noindex, nofollow' } }
    },
    {
        path: '',
        component: LandingPageComponent,
        data: {
            seo: {
                title: 'GTOP | Growth Tutorials Objective Practice Platform',
                description: 'Join GTOP (Growth Tutorials Objective Practice) to attempt curated MCQ quizzes, join live sessions, and monitor your competitive exam readiness.',
                keywords: 'GTOP, Growth Tutorials, objective practice, competitive exams, quizzes, live quiz, analytics',
                robots: 'index, follow'
            }
        }
    },
    {
        path: 'profile-setup',
        component: ProfileSetupComponent,
        data: {
            seo: {
                title: 'Complete Your GTOP Profile',
                description: 'Tell us about your academic goals so GTOP can personalize quizzes, reports, and reminders for you.',
                robots: 'noindex, nofollow'
            }
        }
    },
    {
        path: 'profile',
        component: ProfileComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: {
            roles: ['user', 'admin'],
            seo: {
                title: 'GTOP Profile Overview',
                description: 'Review and update your Growth Tutorials profile details to keep personalized quiz recommendations accurate.',
                robots: 'noindex, nofollow'
            }
        }
    },
    {
        path: 'dashboard',
        component: UserDashboardComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: {
            roles: ['user', 'admin'],
            seo: {
                title: 'GTOP Dashboard | Track Your Quiz Progress',
                description: 'Monitor your recent quiz activity, accuracy trends, and unlock targeted practice recommendations inside the GTOP dashboard.',
                robots: 'noindex, nofollow'
            }
        }
    },
    {
        path: 'admin',
        component: AdminDashboardComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: {
            roles: ['admin'],
            seo: {
                title: 'GTOP Admin Console',
                description: 'Administer Growth Tutorials by tracking live activity, announcements, and management shortcuts from the GTOP admin dashboard.',
                robots: 'noindex, nofollow'
            }
        }
    },
    {
        path: 'admin/action-plan',
        loadComponent: () => import('./pages/action-plan/action-plan.component').then(module => module.ActionPlanComponent),
        canActivate: [AuthGuard, RoleGuard],
        data: {
            roles: ['admin'],
            seo: {
                title: 'GTOP Action Plan',
                description: 'Coordinate GTOP priorities, ownership, progress, reviews, and blockers across admins, teams, and agents.',
                robots: 'noindex, nofollow'
            }
        }
    },
    {
        path: 'admin/mcq-management',
        component: McqManagementComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: {
            roles: ['admin'],
            seo: {
                title: 'GTOP MCQ Bank Management',
                description: 'Curate and maintain the MCQ library that powers GTOP quizzes with filters, bulk actions, and version control.',
                robots: 'noindex, nofollow'
            }
        }
    },
    {
        path: 'admin/add-mcq',
        component: AddMcqComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: {
            roles: ['admin'],
            seo: {
                title: 'Add New MCQs | GTOP Admin',
                description: 'Create fresh GTOP objective questions with answers, explanations, and tagging to enhance practice sets.',
                robots: 'noindex, nofollow'
            }
        }
    },
    {
        path: 'admin/manage-syllabus',  // ✅ NEW Route Added
        component: ManageSyllabusComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: {
            roles: ['admin'],
            seo: {
                title: 'Manage GTOP Syllabus',
                description: 'Organize chapters and subjects that structure GTOP quizzes so learners always target the right topics.',
                robots: 'noindex, nofollow'
            }
        }
    },
    {
        path: 'syllabus-preview',
        component: SyllabusPreviewComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: {
            roles: ['admin'],
            seo: {
                title: 'GTOP Syllabus Preview',
                description: 'Preview the published Growth Tutorials syllabus exactly as learners experience it in GTOP.',
                robots: 'noindex, nofollow'
            }
        }
    },
    {
        path: 'logs',
        component: LogsComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: {
            roles: ['admin'],
            seo: {
                title: 'GTOP Activity Logs',
                description: 'Audit Growth Tutorials events, feature flags, and deployment notes to keep the GTOP platform healthy.',
                robots: 'noindex, nofollow'
            }
        }
    },
    {
        path: 'quiz',
        component: QuizPageComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: {
            roles: ['user', 'admin'],
            seo: {
                title: 'Take a GTOP Quiz',
                description: 'Answer timed MCQs tailored to your profile and syllabus focus with instant feedback in GTOP quizzes.',
                robots: 'noindex, nofollow'
            }
        }
    },
    {
        path: 'quiz-summary',
        component: QuizSummaryComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: {
            roles: ['user', 'admin'],
            seo: {
                title: 'GTOP Quiz Summary',
                description: 'Review your question-level accuracy, explanations, and improvement cues after completing a GTOP quiz.',
                robots: 'noindex, nofollow'
            }
        }
    },
    {
        path: 'quiz-run',
        component: QuizRunLandingComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: {
            roles: ['user', 'admin'],
            seo: {
                title: 'GTOP Quiz Run',
                description: 'Launch or join scheduled GTOP quiz runs to compete with peers in real time.',
                robots: 'noindex, nofollow'
            }
        }
    },
    {
        path: 'quiz-run/lobby/:sessionId',
        component: QuizRunLobbyComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: {
            roles: ['user', 'admin'],
            seo: {
                title: 'GTOP Quiz Lobby',
                description: 'Wait for participants, sync rules, and get ready before your GTOP live quiz begins.',
                robots: 'noindex, nofollow'
            }
        }
    },
    // Live Quiz
    {
        path: 'live',
        component: LiveLandingComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: {
            roles: ['user', 'admin'],
            seo: {
                title: 'GTOP Live Quiz Hub',
                description: 'Browse scheduled GTOP live quiz sessions, join hosts, and compete head-to-head with your cohort.',
                robots: 'noindex, nofollow'
            }
        }
    },
    {
        path: 'live/host/:sessionId',
        component: LiveHostComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: {
            roles: ['user', 'admin'],
            seo: {
                title: 'Host a GTOP Live Quiz',
                description: 'Manage participants, launch questions, and control pacing while hosting a GTOP live quiz session.',
                robots: 'noindex, nofollow'
            }
        }
    },
    {
        path: 'live/play/:sessionId',
        component: LivePlayerComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: {
            roles: ['user', 'admin'],
            seo: {
                title: 'Play GTOP Live Quiz',
                description: 'Answer live GTOP questions in sync with classmates and track your leaderboard rank in real time.',
                robots: 'noindex, nofollow'
            }
        }
    },
    {
        path: 'live/summary/:sessionId',
        component: LiveSummaryComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: {
            roles: ['user', 'admin'],
            seo: {
                title: 'GTOP Live Quiz Summary',
                description: 'Compare final standings and analyse responses after your GTOP live quiz concludes.',
                robots: 'noindex, nofollow'
            }
        }
    },
    {
        path: 'reports',
        component: ReportsPageComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: {
            roles: ['user', 'admin'],
            seo: {
                title: 'GTOP Quiz Reports',
                description: 'Analyse historical quiz performance, accuracy by topic, and improvement streaks with GTOP reports.',
                robots: 'noindex, nofollow'
            }
        }
    },

    {
        path: 'admin/manage-syllabus/edit',
        component: EditSyllabusComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: {
            roles: ['admin'],
            seo: {
                title: 'Edit GTOP Syllabus Item',
                description: 'Modify subjects, chapters, and their availability across GTOP quizzes before publishing updates.',
                robots: 'noindex, nofollow'
            }
        }
    },
    {
        path: 'admin/user-list',
        component: UserListComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: {
            roles: ['admin'],
            seo: {
                title: 'GTOP User Directory',
                description: 'View active learners, manage roles, and ensure healthy engagement across the GTOP platform.',
                robots: 'noindex, nofollow'
            }
        }
    },

    // Dev-only UI preview (restricted to admin role)
    {
        path: 'dev/ui',
        component: UiKitchenComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: {
            roles: ['admin'],
            seo: {
                title: 'GTOP UI Kitchen',
                description: 'Preview experimental GTOP interface patterns and validate components before launch.',
                robots: 'noindex, nofollow'
            }
        }
    },

    { path: '**', redirectTo: '' }
];
