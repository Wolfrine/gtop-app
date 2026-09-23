# Question paper module: implementation and release checks

## Admin workflow

- Open `/admin/question-paper-generator` from the admin navigation or overview.
- Choose board, standard, subjects and chapters. Choose a template or a custom objective paper. Review the visible section counts, marks and difficulty before checking availability.
- Availability queries each selected chapter before applying a read limit, excludes incomplete/unapproved questions, allocates questions without repeated IDs or stems, and reports shortages by section and chapter. A question cannot satisfy two sections in the same paper. Incomplete scans are disclosed and cannot create false shortage requests.
- Preview the selected paper, then save a snapshot. Recent drafts reopen the original question and answer content even if the live bank changes. Changing the setup clears stale coverage and preview results.
- Completed papers can be printed or saved as PDF through the browser. The student paper and answer key open separately. Incomplete drafts can be saved but cannot be printed as completed papers.
- Request missing questions into `questionBankPriorityItems`. Creator submissions go to `devQuestions` with `reviewStatus=pending-admin-review`.
- Review at `/admin/question-review`: edit content, select the answer, check explanations, then approve or reject with a note. Approval atomically publishes the question, updates the exact syllabus count and marks the source draft reviewed. Repeated approval does not publish twice; stale drafts and destination-ID collisions are rejected.

## Supported scope and remaining phases

The shared learner bank currently requires option-based questions. The review UI therefore prevents publication of written-answer drafts to that bank. Compatible existing written questions can be used in papers when their format and answers are complete. Native DOCX export, online-test conversion, formal paper locking and a dedicated written-question bank remain later phases. Browser Save PDF is available now.

The creator task/configuration documents describe the queue contract. Their presence does not establish a running scheduler. A saved missing-question request must be processed by a creator run and reviewed before its questions become available.

## Startup and hosting

`AuthStore.ready()` waits for initial restoration and returns the current session state on each call. Route guards no longer reuse the initial signed-out result after Google login. A best-effort last-login update does not block restored-session readiness. Navigation and bootstrap failures expose recovery controls; a slow navigation also offers reload/home.

Firebase Hosting sends HTML routes and release/service-worker metadata without long-lived cache headers, while content-hashed assets retain long cache lifetimes. Emulator query parameters are accepted only on loopback hosts.

## Verification and deployment

Run from `gtop-v2`:

```sh
npm ci
npm run parity:check
npm test
npm run test:rules
npm run test:database-rules
npm run build:uat
npm run e2e
```

Rules/emulator checks require Java 21. Browser checks require the Playwright Chromium/WebKit dependencies installed by the existing dev/UAT workflows.

The new `e2e/question-paper.spec.ts` exercises section totals and chapter coverage, separate print outputs, snapshot save/reopen, stale-state invalidation, missing-question requests and actual admin publication/count updates. It captures the saved paper and review layouts under each configured viewport.

After hosting deployment, `scripts/verify-deployment.mjs` checks the deployed commit, entry scripts, desktop/mobile public landing and admin sign-in return route. `scripts/verify-live-paper-rules.mjs` downloads the active shared Firestore rules with the existing workflow credential and tests them in an emulator, including the complete admin publication transaction and student/visitor denial. This test does not modify the live database or rules.

Hosting success alone is insufficient: the active backend must permit the module's admin collections. If the active-rules check fails, deploy the reviewed rules through the existing protected `GTOP v2 protected Firebase backend` workflow. Preserve its `firebase-live-backend` environment and explicit deployment inputs. Production hosting remains on its existing protected release workflow.

### Shared backend repair

The 23 September dev/UAT runs deployed `47fbd1ac` and verified the hosted pages, but the active-rule test failed all three admin module operations (read templates/queue, save paper/priority, approve a question). Student and visitor denial passed. The active baseline was `projects/gtop-app/rulesets/69d80ee7-6068-4992-99c1-51a50163d37e`.

The prepared Firestore rules retain that baseline's feedback, automation visibility, admin result maintenance, session-host operations and signed-in metadata access. They add admin-only paper/review collections and immutable action history. They also close a legacy missing-role promotion loophole and permit learner flag transactions with one count increment per user's first flag. Existing rules and these changes pass 13 Firestore emulator tests.

The later `5634ef1a` UAT run passed all 85 applicable browser cases, with three viewport-specific skips, and both hosting deployments passed their live page checks. Its dev run exposed two intermittent cases: iPhone document-width measurement during the existing entrance animation, and selection rendering that could collapse select-all in an editor field. The former now waits for finite animations/fonts and stable geometry while retaining the zero-overflow assertion. The latter was reproduced in a real DOM test and fixed by rendering a draft/version-keyed editor synchronously on selection. CI must verify those final changes; the active shared-rule failures remain until the protected deployment below.

For this repair, run the protected backend workflow on `feature/question-paper-generator` with `deploy_backend=true`, `allow_planned_rule_change=true`, and `deployment_scope=firestore-rules-only`. This scope leaves Firestore indexes and Realtime Database rules unchanged. The workflow verifies the newly active rules after deployment. Its existing environment approval remains in place. Do not mark the module available merely because hosting has deployed; confirm the active-rule job passes first.

## Reviewed support content, 23 September 2026

Twelve reviewed MCQs were published based on twelve recent quizzes by three non-admin users: four each for CBSE 9 Science — Force and Laws of Motion, ICSE 10 Science — Basic Biology, and ICSE 10 Science — Genetics. Exact approved chapter totals were reconciled to 171, 172 and 67. One existing force question's numerical answer was corrected to 3 m/s²; historical quiz results were preserved.

The content audit, IDs, review provenance and correction reference are stored in `activity/student-support-20260923`. No student identities are included in that audit.
