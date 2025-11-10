# Authentication Management Overview

This document explains how GTOP handles user authentication after adding email/password, phone OTP, Google, and guest preview flows.

## Supported Providers

| Provider | Firebase Setting | Angular Entry Point | Notes |
|----------|------------------|----------------------|-------|
| Google OAuth | Enabled in Firebase console (Google provider) | `AuthPanelComponent` "Instant access" tab → **Continue with Google** button (`AuthService.signInWithGoogle`) | Uses popup flow and existing One Tap support when available. |
| Email & Password | Firebase Email/Password provider | `AuthPanelComponent` "Email" tab → sign in / create account (`AuthService.signInWithEmail`, `AuthService.registerWithEmail`) | Enforces minimum 6 character password. Password reset uses `AuthService.sendPasswordReset`. |
| Phone OTP | Firebase Phone provider | `AuthPanelComponent` "Phone OTP" tab (`AuthService.startPhoneSignIn`, `AuthService.confirmPhoneSignIn`) | Requires invisible reCAPTCHA via Firebase. Phone numbers auto-prefix `+91` when 10 digits are entered without a country code. |
| Anonymous Guest | Firebase Anonymous provider | `AuthPanelComponent` "Instant access" tab → **Explore as guest** (`AuthService.continueAsGuest`) | Creates a guest profile with a five-quiz preview limit and `role: 'guest'`. |

All authentication flows persist a user profile document in `Firestore /users/{uid}` via `AuthService.storeUserInFirestore`. Default roles are preserved; guests receive a `guestQuizCount` counter.

## Angular Components & Services

- **`src/app/components/auth/auth-panel/auth-panel.component.*`** – New standalone panel embedded on the landing hero. It exposes email, phone, Google, and guest entry points, handles OTP verification UI, and coordinates with the `AuthService`.
- **`src/app/services/auth.service.ts`** – Extended with:
  - `registerWithEmail`, `signInWithEmail`, `sendPasswordReset` for email flows.
  - `startPhoneSignIn`, `confirmPhoneSignIn` for OTP login.
  - `continueAsGuest` for anonymous preview accounts (assigns `role: 'guest'` and initialises `guestQuizCount = 0`).
  - `handlePostAuthentication` helper ensures Firestore profiles are merged and live snapshots are attached for every provider.
- **`src/app/services/guest-access.service.ts`** – Tracks the guest quiz quota (max 5). Uses Firestore's atomic `increment` to persist the `guestQuizCount` counter.
- **`src/app/services/guest-quiz.guard.ts`** – Added to the `/quiz` route. Prevents guests who reached the limit from starting new quizzes and redirects back to the dashboard with a message.
- **`src/app/pages/user-dashboard/*`** – Shows a guest banner, remaining attempts, disables quiz CTAs after the limit, and reuses `MatSnackBar` to guide guests toward full sign-up.

## Guest Preview Limit Logic

1. `continueAsGuest` signs in anonymously, stores `role: 'guest'`, and seeds `guestQuizCount = 0`.
2. `GuestQuizGuard` checks the count before navigating to `/quiz`. If the guest exhausted all 5 attempts, the guard redirects to `/dashboard` with `state: { guestLimitReached: true }`.
3. `QuizService.saveQuizResult` increments the counter via `GuestAccessService.recordGuestAttempt` whenever a guest completes a quiz.
4. `UserDashboardComponent` listens to the user snapshot, surfaces remaining attempts, disables buttons, and surfaces an upsell snackbar once the limit is reached.

## Landing Page Integration

- `LandingPageComponent` now imports `AuthPanelComponent` and positions it inside the hero section beside the marketing copy and SVG illustration (`landing-page.component.html/.scss`).
- The hero layout has been updated with a responsive two-column grid so the auth card and illustration stay balanced on desktop while stacking gracefully on mobile.

## Implementation Checklist

- [x] Ensure the Firebase project has Email/Password, Phone, Google, and Anonymous providers enabled (screenshot confirmed).
- [x] Provide a valid reCAPTCHA domain configuration for Firebase Phone Auth.
- [x] Keep `AuthService.googleClientId` in sync with the OAuth client ID configured in Firebase.
- [x] Update this document whenever new providers or guard logic are added.

## Relevant Files

- `src/app/services/auth.service.ts`
- `src/app/components/auth/auth-panel/auth-panel.component.(ts|html|scss)`
- `src/app/services/guest-access.service.ts`
- `src/app/services/guest-quiz.guard.ts`
- `src/app/pages/user-dashboard/user-dashboard.component.(ts|html|scss)`
- `src/app/pages/landing-page/landing-page.component.(ts|html|scss)`
- `src/app/app.routes.ts`
- `src/app/services/quiz.service.ts`

For questions about Firebase configuration or extending the auth UX, update this file to reflect the changes so future contributors have a single source of truth.
