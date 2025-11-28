# Deployment and Environments
_File: 07_Deployment_and_Environments.md_

## Local Setup
1. Install Node.js (v20 in CI) and npm.
2. From `gtop-app/`, run `npm install` to install dependencies.【F:package.json†L3-L22】
3. Build syllabus index automatically via `npm run build` (prebuild hook runs `scripts/gen-syllabus-index.js`).【F:package.json†L4-L14】【F:scripts/gen-syllabus-index.js†L1-L18】
4. Start dev server: `npm start` or `ng serve` (defaults to `http://localhost:4200`).【F:README.md†L5-L16】

## Testing
- Unit tests: `npm test` / `ng test` (Karma).【F:README.md†L17-L24】
- No end-to-end tests configured by default (Angular CLI placeholder).【F:README.md†L17-L24】

## Build
- Production build: `npm run build -- --configuration production` (recommended per repo instructions).【F:AGENTS.md†L8-L15】
- Watch mode: `npm run watch` builds in development configuration.【F:package.json†L11-L15】

## Environment Configuration
- Firebase configuration embedded in `app.config.ts` for the `gtop-app` project (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId, measurementId).【F:src/app/app.config.ts†L15-L25】
- Service worker enabled when `isDevMode()` is false (production build).【F:src/app/app.config.ts†L40-L53】
- No separate `.env` files found; assumes defaults baked into code.

## Hosting/CI
- GitHub Actions deploy workflow publishes Angular build to Firebase Hosting. `main` → `prod-gtop-app` target; other branches → `dev-gtop-app` preview channel.【F:AGENTS.md†L13-L36】
- Workflow installs dependencies with `npm ci`, builds production bundle, and deploys via Firebase Hosting GitHub Action using `secrets.GITHUB_TOKEN` and `secrets.FIREBASE_SERVICE_ACCOUNT`.【F:AGENTS.md†L13-L36】

## Running Scripts
- `scripts/gen-syllabus-index.js`: Generates `src/assets/syllabus/index.json` from syllabus JSON files; runs automatically before build but can be invoked manually with `node scripts/gen-syllabus-index.js`.【F:scripts/gen-syllabus-index.js†L1-L18】【F:package.json†L4-L14】
