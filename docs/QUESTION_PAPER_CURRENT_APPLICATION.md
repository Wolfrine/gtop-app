# Question paper module in the current application

The canonical product is `gtop-app/` on `main`. The earlier question-paper prototype was implemented in `gtop-v2/` and does not form the release baseline. PRs 47 and 48 were closed at the owner's request. This integration starts from main commit a735038b32cb459af530507c5778e37cdc9ea6c7.

## Dev review

Branch: `integrate/question-paper-main`.
Target: https://dev-gtop-app.web.app

Use the current Admin Console or sidebar to open **Question papers** or **Review questions**. The existing illustrated discovery landing, navigation, Learning Lab, quiz and report components remain in the canonical application. New module styles are scoped to their feature hosts.

Paper generation supports scoped syllabus selection, configurable templates/sections, exact question and mark allocation, explicit shortages, creator priority requests, immutable saved question/answer snapshots, separate paper and answer-key printing, and browser Save PDF. Review supports editing, duplicate and stale-content checks, atomic publication of complete MCQs, exact syllabus count updates, and rejection notes. Written responses can be reviewed but are not published to the MCQ learner bank.

The original 12 reviewed support questions remain published in the existing bank. No fixture questions are written to the live backend by automated browser tests.

## Verification and release boundary

The current-app workflow runs module tests, rules tests, a production build, and browser journeys across desktop, phone, landscape and tablet sizes. Journeys cover the current landing artwork, module navigation, Learning Lab links, guest and learner access, restored admin sessions, print outputs, saved snapshots, gap requests and atomic review publication. It checks actual deployed commit identity, JavaScript assets and desktop/mobile startup after hosting deployment.

The current dev site uses the shared live Firebase project. Hosting deployment alone does not activate new collection permissions. A separate read-only verification job inspects the actual live rules and tests them in an emulator. The reviewed rules preserve the existing application's feedback, automation, session-host, result-maintenance and private metadata permissions.

If live rules still deny module operations, run the existing **GTOP protected Firebase backend** workflow (`firebase-v2-backend.yml`, retained filename) on `integrate/question-paper-main` with `deploy_backend=true`, `allow_planned_rule_change=true` and `deployment_scope=firestore-rules-only`. Its manual dispatch, explicit confirmations and `firebase-live-backend` environment gate remain in force. This deploys only Firestore rules, then verifies the active release. It does not modify Realtime Database rules or indexes.

Keep the integration in draft until actual backend access is verified. Do not merge or deploy to production as part of dev review. Main remains canonical; only this current review branch is retained alongside it.

Native DOCX export, formal paper locking, online-test conversion, a dedicated written-question bank and a running creator scheduler are later phases.
