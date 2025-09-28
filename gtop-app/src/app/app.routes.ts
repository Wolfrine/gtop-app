import { Routes } from '@angular/router';
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
import { SyllabusPreviewComponent } from './pages/syllabus-preview/syllabus-preview.component';
import { LogsComponent } from './pages/logs/logs.component';
import { UiKitchenComponent } from './pages/ui-kitchen/ui-kitchen.component';
import { LiveLandingComponent } from './pages/live/live-landing/live-landing.component';
import { LiveHostComponent } from './pages/live/live-host/live-host.component';
import { LivePlayerComponent } from './pages/live/live-player/live-player.component';
import { LiveSummaryComponent } from './pages/live/live-summary/live-summary.component';




export const routes: Routes = [
    { path: '', component: LandingPageComponent },
    { path: 'profile-setup', component: ProfileSetupComponent },
    {
        path: 'dashboard',
        component: UserDashboardComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['user', 'admin'] }
    },
    {
        path: 'admin',
        component: AdminDashboardComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['admin'] }
    },
    {
        path: 'admin/mcq-management',
        component: McqManagementComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['admin'] }
    },
    {
        path: 'admin/add-mcq',
        component: AddMcqComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['admin'] }
    },
    {
        path: 'admin/manage-syllabus',  // ✅ NEW Route Added
        component: ManageSyllabusComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['admin'] }
    },
    {
        path: 'syllabus-preview',
        component: SyllabusPreviewComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['admin'] }
    },
    {
        path: 'logs',
        component: LogsComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['admin'] }
    },
    {
        path: 'quiz',
        component: QuizPageComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['user', 'admin'] }
    },
    {
        path: 'quiz-summary',
        component: QuizSummaryComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['user', 'admin'] }
    },
    // Live Quiz
    {
        path: 'live',
        component: LiveLandingComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['user', 'admin'] }
    },
    {
        path: 'live/host/:sessionId',
        component: LiveHostComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['user', 'admin'] }
    },
    {
        path: 'live/play/:sessionId',
        component: LivePlayerComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['user', 'admin'] }
    },
    {
        path: 'live/summary/:sessionId',
        component: LiveSummaryComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['user', 'admin'] }
    },
    {
        path: 'reports',
        component: ReportsPageComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['user', 'admin'] }
    },

    {
        path: 'admin/manage-syllabus/edit',
        component: EditSyllabusComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['admin'] }
    },
    {
        path: 'admin/user-list',
        component: UserListComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['admin'] }
    },

    // Dev-only UI preview (restricted to admin role)
    {
        path: 'dev/ui',
        component: UiKitchenComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['admin'] }
    },

    { path: '**', redirectTo: '' }
];
