import { Routes } from '@angular/router';
import { LandingPageComponent } from './pages/landing-page/landing-page.component';
import { ProfileSetupComponent } from './pages/profile-setup/profile-setup.component';

export const routes: Routes = [
    { path: '', component: LandingPageComponent },
    { path: 'profile-setup', component: ProfileSetupComponent }, // ✅ Added Profile Setup Route
    { path: '**', redirectTo: '' } // Redirect unknown routes to landing page
];