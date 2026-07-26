# GTOP v2

GTOP v2 is the rebuilt Growth Tutorials Objective Practice experience. It uses Angular 21, the modular Firebase SDK, typed repositories, separate learner/admin shells, and the existing production Firebase data contracts.

## Local development

```powershell
npm.cmd ci
npm.cmd start
```

The local build uses the production Firebase project. Add `?emulator=1` when running Firebase Auth and Firestore emulators.

## UAT

```powershell
npm.cmd run build:uat
```

The UAT build intentionally reads and writes live production Firebase data. It displays a permanent warning banner and requires extra confirmation for destructive administrative actions.

## Verification

```powershell
npm.cmd test
npm.cmd run test:rules
npm.cmd run e2e
npm.cmd run build:uat
```

The Firestore rules suite requires Java because it starts the Firebase emulator. Playwright requires its Chromium runtime (`npx playwright install chromium`).

## Hosting

Non-main changes are deployed by `.github/workflows/firebase-v2-uat.yml` to the stable `gtop-app-v2-uat` Firebase Hosting site. V1 production remains owned by `gtop-app/` until owner-approved cutover.
