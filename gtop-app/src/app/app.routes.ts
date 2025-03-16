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

    { path: '**', redirectTo: '' }
];
