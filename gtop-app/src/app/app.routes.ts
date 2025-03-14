import { Routes } from '@angular/router';
import { LandingPageComponent } from './pages/landing-page/landing-page.component';
import { ProfileSetupComponent } from './pages/profile-setup/profile-setup.component';
import { UserDashboardComponent } from './pages/user-dashboard/user-dashboard.component';
import { AdminDashboardComponent } from './pages/admin-dashboard/admin-dashboard.component';
import { AuthGuard } from './services/auth.guard';
import { RoleGuard } from './services/role.guard';

export const routes: Routes = [
    { path: '', component: LandingPageComponent },
    { path: 'profile-setup', component: ProfileSetupComponent },
    {
        path: 'dashboard',
        component: UserDashboardComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['user', 'admin'] } // ✅ Admins can access dashboard
    },
    {
        path: 'admin',
        component: AdminDashboardComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['admin'] } // ❌ Only admins can access
    },
    { path: '**', redirectTo: '' } // Redirect unknown routes
];
