# Plant Reproduction Lab

## Scope and delivery

Impact area: the Learning Lab learner journey and its separate admin feedback view. Discovery is limited to GTOP, the existing lesson contract, and NCERT biology. Delivery is a native Angular lesson on the development branch, preserving Current Lab, the accepted landing page and all existing quiz flows.

- Learner: `/learning-lab/plants`, available to every signed-in GTOP role through the existing lab guard.
- Admin: `/learning-lab/plants/results`, protected by the existing admin-only guard and an additional service role check.
- Catalog: `/learning-lab`; Current Lab feedback links to Plant Reproduction feedback and back.

## Learning experience

The flower is immediately interactive. Five explorations connect anatomy, pollen delivery, magnified fertilisation, fruit/seeds and wind dispersal, and vegetative propagation. Each presents one next action, visible consequences, contextual guidance and an automatic discovery when its observable outcome is reached. Predictions are optional; they no longer lock the experiment. A failed petal trial is available for comparison, not a hidden prerequisite.

Original botanical specimens invite interaction; distinct diagrams show the cutaway, pollen tube, egg fusion, fruit and embryo, potato comparison and Bryophyllum plantlet. Wind trials compare still air, a breeze and stronger wind; selecting a condition does not rerun the previous release. The notebook retains up to twelve pollen trials, inspected parts and explored wind conditions. Navigation and resumed visits preserve unfinished fieldwork. Replays and closing a leaf do not revoke completed discoveries.

The final five questions appear one at a time after the discoveries. First checked answers remain immutable; usefulness and optional feedback remain available to admins. The mobile layout keeps the active scene and main action visible while controls scroll. Native controls, labelled direct targets and reduced-motion support are retained.

The schematic flower is not a species-specific dissection. Pollination assumes viable pollen and a receptive, self-compatible flower; pollen from a different species is rejected in this model. Tube growth reaches the ovule before gamete delivery appears. The core sequence shows egg fertilisation, with double fertilisation explained in an optional disclosure. Fruit development is a typical fertilised-flower model, not a claim that every fruit requires fertilisation. Development steps represent event order rather than calibrated biological time. The potato comparison assumes healthy pieces under equal suitable moisture, oxygen and warmth.

Concept reference: https://ncert.nic.in/textbook/pdf/gesc108.pdf

## Persistence and privacy

The latest five versioned attempts are stored only in the signed-in user's existing `users/{uid}.plantLab` field, with `lessonId: plant-reproduction`. The `learningLab` Current Lab field and unrelated account fields are untouched. Version 2 attempts begin with an empty baseline; version 1 visits remain readable. Transactions retain first responses across repeated saves and concurrent tabs. Fieldwork is bounded and saved serially per visit; concurrent experimental changes use the most recent transaction, while first assessment responses remain protected. No rules, collection, hosting target, dependency or backend migration is introduced. Feedback is account-linked, not anonymous, and is formative rather than tamper-resistant assessment data.

Practice without saving uses component memory and makes no lesson writes. Load/save failures do not claim success. Learner/admin views clear and navigate away on account changes; session generations discard stale asynchronous responses, and service reads and transaction callbacks validate the owning UID. Account-change handlers run inside Angular's zone so route teardown and rendered-data cleanup also complete for external auth callbacks.

Admin results load at most 50 accounts per page and label retained attempts, repeat attempts and small-sample limits. Averages and related baseline/final answers are descriptive, not proof of learning gain. Historical before/after comparisons include only the same attempts that answered a baseline; new immediate-start visits are excluded from that comparison.

## Checks

- `node scripts/plant-lab.test.cjs`: pollen compatibility, stage boundaries, optional predictions, assessment gates, fieldwork validation and legacy compatibility, first responses, malformed history, feedback limits and retention.
- `node scripts/learning-lab.test.cjs`: Current Lab regression suite.
- `npm run build -- --configuration production`: actual Angular templates, routes, dependencies and production build. Existing app bundle/style warning budgets remain; no error budgets are raised.
- `scripts/plant-lab.rules.test.cjs`: actual service against the demo Firestore emulator using the canonical checked-in rule contract. Covers own-account saves, cross-account denials, admin feedback, concurrent submissions and preservation of Current Lab/profile fields. No live records are created.
- `scripts/plant-lab.dom.test.cjs`: compiled Angular entry point in an isolated DOM fixture, including the real GTOP shell and landing/sign-in navigation, five explorations, unfinished-state navigation, failed trials, completed-stage replay, assessment, feedback, admin results, resume, no-write practice and account-change cleanup. Fixture files are excluded from production.

For the DOM fixture, build with `node node_modules/@angular/cli/bin/ng.js build --configuration development --browser scripts/fixtures/plant-lab-preview.ts --ts-config tsconfig.plant-preview.json --output-path dist/plant-preview`, then run the test with `GTOP_TEST_MODULE_ROOT` pointing to the isolated runtime containing jsdom. The emulator test uses the same isolated runtime with Firebase test packages; optional `GTOP_PLANT_RULES_PATH` selects the canonical rules snapshot.

The redesigned lesson was opened and operated in the browser at desktop and phone sizes with the real GTOP header/sidebar/footer. The final summary polish and remaining phone variants still need a visual recheck: browser URL-policy access was subsequently denied. This caught and corrected the shell overflow that blocked sticky actions and overlong failed-pollen guidance. Screenshot evidence and review boundaries are in `../../docs/uiux/plant-visual-review/`. The preview substitutes account and storage services; live signed-in Firebase acceptance remains distinct. The admin Action Plan cannot be updated without an authenticated admin session; prior project records also document denied actionPlans access.

## Artwork

`assets/learning-lab/plant-greenhouse.webp` is original generated background artwork. Built-in image-generation prompt: photographic greenhouse with emerald foliage, fuchsia hibiscus framing the edges, golden morning light, and a softly blurred dark-green center; no people, text, labels, UI or diagrams. The generated PNG was encoded as WebP for delivery. All teaching anatomy and event sequences are deterministic diagrams separate from the background.

Version 2 adds `flower-specimen-v2.webp` and `dandelion-specimen-v2.webp`: original isolated botanical illustrations generated as transparent PNGs and encoded as WebP (approximately 371 KiB and 462 KiB). These illustrate the specimens, while exact anatomy and event relationships are drawn as SVG. No generated image supplies scientific labels or the interface.

## Browser preview

Build the isolated Angular entry point using the command above, then run `sites-preview start <absolute-app-path>`. The preview serves only that fixture output through the checked-in Vite config. `/review.html` frames the real app shell at desktop, phone and tablet widths. Stop the supervised preview after review. The fixture, review controls and mock services are excluded from production output.
