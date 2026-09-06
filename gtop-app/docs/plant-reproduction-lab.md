# Plant Reproduction Lab

## Scope and delivery

Impact area: the Learning Lab learner journey and its separate admin feedback view. Discovery is limited to GTOP, the existing lesson contract, and NCERT biology. Delivery is a native Angular lesson on the development branch, preserving Current Lab, the accepted landing page and all existing quiz flows.

- Learner: `/learning-lab/plants`, available to every signed-in GTOP role through the existing lab guard.
- Admin: `/learning-lab/plants/results`, protected by the existing admin-only guard and an additional service role check.
- Catalog: `/learning-lab`; Current Lab feedback links to Plant Reproduction feedback and back.

## Learning experience

Two baseline predictions lead into five explorations: flower anatomy, pollen delivery, pollen-tube growth and fertilisation, fruit/seeds and dispersal, and vegetative propagation. Every exploration requires a first prediction before controls unlock. Recording requires the relevant observed outcome, including an unsuccessful petal trial followed by a compatible stigma trial, and the two-pot comparison followed by the leaf example.

The final five questions retain the first checked response and provide explanations. A field notebook connects first predictions to observations. Ratings and optional feedback appear in the admin view. Controls have keyboard/tap alternatives, native form labels, responsive layouts and reduced-motion styling. On narrow screens the first predictions precede the decorative specimen.

The schematic flower is not a species-specific dissection. Pollination assumes viable pollen and a receptive, self-compatible flower; pollen from a different species is rejected in this model. Tube growth reaches the ovule before gamete delivery appears. The core sequence shows egg fertilisation, with double fertilisation explained in an optional disclosure. Fruit development is a typical fertilised-flower model, not a claim that every fruit requires fertilisation. Development sliders represent event order rather than calibrated biological time. The potato comparison assumes healthy pieces under equal suitable moisture, oxygen and warmth.

Concept reference: https://ncert.nic.in/textbook/pdf/gesc108.pdf

## Persistence and privacy

The latest five versioned attempts are stored only in the signed-in user's existing `users/{uid}.plantLab` field, with `lessonId: plant-reproduction`. The `learningLab` Current Lab field and unrelated account fields are untouched. Transactions retain first responses across repeated saves and concurrent tabs. No rules, collection, hosting target, dependency or backend migration is introduced. Feedback is account-linked, not anonymous, and is formative rather than tamper-resistant assessment data.

Practice without saving uses component memory and makes no lesson writes. Load/save failures do not claim success. Learner/admin views clear and navigate away on account changes; session generations discard stale asynchronous responses, and service reads and transaction callbacks validate the owning UID. Account-change handlers run inside Angular's zone so route teardown and rendered-data cleanup also complete for external auth callbacks.

Admin results load at most 50 accounts per page and label retained attempts, repeat attempts and small-sample limits. Averages and related baseline/final answers are descriptive, not proof of learning gain.

## Checks

- `node scripts/plant-lab.test.cjs`: pollen compatibility, stage boundaries, prediction/assessment gates, first responses, malformed history, feedback limits and retention.
- `node scripts/learning-lab.test.cjs`: Current Lab regression suite.
- `npm run build -- --configuration production`: actual Angular templates, routes, dependencies and production build. Existing app bundle/style warning budgets remain; no error budgets are raised.
- `scripts/plant-lab.rules.test.cjs`: actual service against the demo Firestore emulator using the canonical checked-in rule contract. Covers own-account saves, cross-account denials, admin feedback, concurrent submissions and preservation of Current Lab/profile fields. No live records are created.
- `scripts/plant-lab.dom.test.cjs`: compiled Angular entry point in an isolated DOM fixture, including landing/sign-in navigation, five explorations, animation timing, assessment, feedback, admin results, resume, no-write practice and account-change cleanup. Fixture files are excluded from production.

For the DOM fixture, build with `node node_modules/@angular/cli/bin/ng.js build --configuration development --browser scripts/fixtures/plant-lab-preview.ts --ts-config tsconfig.plant-preview.json --output-path dist/plant-preview`, then run the test with `GTOP_TEST_MODULE_ROOT` pointing to the isolated runtime containing jsdom. The emulator test uses the same isolated runtime with Firebase test packages; optional `GTOP_PLANT_RULES_PATH` selects the canonical rules snapshot.

The source Checker identified and rechecked account-change cleanup and pollen-tube timing. Real signed-in development acceptance and visual review by the founder remain distinct from these automated checks. The admin Action Plan was not updated: this workspace has no authenticated GTOP admin session, and prior project records document denied actionPlans access. No coordination update or live learner feedback was invented.

## Artwork

`assets/learning-lab/plant-greenhouse.webp` is original generated background artwork. Built-in image-generation prompt: photographic greenhouse with emerald foliage, fuchsia hibiscus framing the edges, golden morning light, and a softly blurred dark-green center; no people, text, labels, UI or diagrams. The generated PNG was encoded as WebP for delivery. All teaching anatomy and event sequences are deterministic diagrams separate from the background.
