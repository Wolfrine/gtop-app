# Learning Lab in GTOP V1

The founder confirmed V1 is live and V2 was reverted. This feature belongs to the Angular 17 app in `gtop-app/`. The accepted Current Lab prototype is ported into native Angular components; GTOP owns navigation and sign-in.

## Routes and access

- `/learning-lab`: lesson catalog, available to every signed-in account.
- `/learning-lab/current`: Current Lab electricity lesson, available regardless of role, board or standard.
- `/learning-lab/results`: Results & Feedback, restricted to the GTOP `admin` role.

The shared sidebar includes Learning Lab in both learner and admin menus, including mobile navigation. The lesson guard waits for Firebase authentication restoration and does not require grade selection. The existing sign-in startup redirect preserves Learning Lab deep links. Existing quiz routes and Hub return parameters are untouched.

## Persistence and boundaries

`users/{uid}.learningLab` stores `lessonId: current-lab` and the learner's latest five versioned attempts. Firestore transactions update only this field; role, UID, grade and other profile fields are preserved. Attempts contain baseline answers, first mission predictions, completed observations, first checked answers, confidence, usefulness, feedback, and timestamps. Scores are computed from the versioned lesson content rather than trusted from stored totals.

Predictions save before unlocking controls. Observations save at the exact mission target. Final answers save when the learner checks them; unsubmitted assessment drafts are not persisted. Progress can be resumed after reloading. Practice without saving performs no learning-data writes. Failed saves keep inputs available and display an error instead of claiming success.

Starting a sixth attempt drops the oldest retained attempt, with this limit disclosed before starting. Each profile stays bounded. Admin queries use the single-field `learningLab.lessonId` index and load 50 accounts at a time; totals describe the loaded accounts and retained attempts. Repeat attempts and admin trials are included and are labelled accordingly. Related baseline/final questions are compared on the same checked-attempt sample without claims of causal improvement.

This uses the existing owner/admin access contract for `users` documented in `gtop-v2/firestore.rules`, the repository's checked-in shared rule source. No collection, rules deployment, dependency or backend migration is added. Emulator tests load that contract explicitly. The currently deployed Firebase rules were not independently retrieved; signed-in acceptance on the development site is still required before production promotion.

These are formative self-reports in the learner's editable profile, not tamper-resistant exam records. The service preserves first responses during normal use and concurrent tab retries; existing profile permissions let the account owner or an admin edit their underlying profile directly. Do not use these records for high-stakes grading. A future immutable assessment store would require its own backend contract.

## Validation

From `gtop-app/`:

```sh
npm ci
node scripts/learning-lab.test.cjs
npm run build -- --configuration production
```

The domain tests exercise Ohm's law, the three observations, charge/energy conservation, open circuits, invalid transitions, first answers, feedback and retention using the actual lesson/state source.

The rules/service integration test needs an isolated runtime containing `firebase-tools@13.35.1`, `@firebase/rules-unit-testing@4.0.1`, and `firebase@11.4.0`, with Java 17 available. Set `GTOP_TEST_MODULE_ROOT` to that runtime's absolute `node_modules` path. Run Firebase `emulators:exec` for demo project `demo-gtop-learning-lab`, Firestore port 8180, with the rules copied from `gtop-v2/firestore.rules` into the runtime's configured rules path. Its command is `node <absolute-app-path>/scripts/learning-lab.rules.test.cjs`.

The integration test runs the actual service methods with test injection bindings and the real Firestore emulator. It verifies owner saves and restores, cross-account and anonymous denials, admin results, learner/institute-admin route access, concurrent predictions, immutable first submissions through the service, preserved profile fields, role-change denial, and bounded retention. Demo records never touch the live Firebase project.

The compiled Angular templates also pass an isolated DOM flow using a test-only in-memory account store: prediction gates, numeric sliders, all three observations, parallel SVG branching, five-question scoring, feedback, admin display, and resume. The fixture is excluded from the production entry point and never writes live data. To repeat it, install `jsdom@26.0.0` in the isolated runtime and run:

```sh
npx ng build --configuration development --browser scripts/fixtures/learning-lab-preview.ts --ts-config tsconfig.lab-preview.json --output-path dist/lab-preview
GTOP_TEST_MODULE_ROOT=/absolute/verification/node_modules node scripts/learning-lab.dom.test.cjs
```

The Angular production build, domain tests, service/rules integration, and compiled DOM flow pass. The existing application bundle/style warnings remain below their error limits. Browser interaction and signed-in development acceptance remain outstanding: this workspace did not permit the local preview listener, and its GTOP browser session was signed out. No fake feedback was placed in GTOP.

## Delivery and acceptance

Use the non-main development branch. Its normal GitHub workflow builds V1 and deploys to `dev-gtop-app`. Production promotion is a separate review step; do not deploy the V2 folder for this feature.

Before promotion, open the module as a learner and admin, test a mobile-width sidebar, complete a saved lesson, reload and resume, submit feedback, and verify that it appears only in the admin view. Confirm one other learner cannot read that record. An incomplete-profile or institute-admin account should still enter Learning Lab. Verify an existing quiz and summary still retain their normal flow.

The admin Action Plan could not be updated because no authenticated admin browser session was available. Backfill the activity and link the feature PR at the first authenticated opportunity.
