# Current GTOP Firestore access

Canonical source: `gtop-app/firestore.rules`. The production and dev applications share project `gtop-app`, database `(default)`; hosting deployment does not deploy rules.

The active May 17 rules omitted the newer paper, review and Action Plan collections. A catch-all deny therefore rejected admins. The much older public-read rules are not the current release and must not be restored: they exposed account/results data and allowed a user to edit their own role to `admin`.

## Current access map

| Data | Learner / signed-in user | GT admin |
| --- | --- | --- |
| Profile, Learning Lab and Plant Lab | Read/write own profile; cannot promote role or delete account | Read/list and maintain profiles |
| Approved questions, syllabus and syllabus previews | Read | Maintain |
| Quiz results | Create own attempt; read/query own history; no rewrite/delete | Read and maintain |
| Question reports | Read own report; deterministic report ID; atomic report/count update; no bank edits | Triage and maintain |
| Live sessions | Discover sessions; host own session; write own participant/answer; no identity spoofing or host reassignment | Session administration |
| Paper templates, blueprints, drafts and answer snapshots | No access | Read/write |
| Review drafts (`devQuestions`, legacy `dev-questions`), taxonomy and creator priorities/instructions | No access | Read/write |
| Action Plans | No access | Read/create/update; history append-only |
| Feedback | Submit | Read and manage |
| Automation runs/tasks/events/coverage and feature/data issues | No access | Read-only browser visibility |
| MCP audit/locks, private auth state and unrecognized collections | No browser access | No browser access; trusted server/MCP access remains governed separately |

`Meta` remains signed-in read/admin write. Signed-out visitors cannot read private Firestore records. Public landing artwork and syllabus indexes remain static hosting assets. Server-only legacy collections such as `AI_Tasks`, `AI_Suggestions` and `syllabus_alternate` do not have current browser consumers and are not made public or browser-writable.

## Publication and evidence

On 2026-09-23 the owner explicitly authorized updating the required permissions. The Firebase console was already authenticated. Its full active source was copied and matched against the previously inspected release before replacement. The editor was then checked to contain the exact validated replacement before Publish. The console confirmed a new active rules version (Today, 3:06 PM IST).

Published source SHA-256: `a47b9ad81412e016bb723ed60705e66228c7a874ecee9e5b0aac317a209ace95`.

Pre-publication verification passed: 20 Firestore emulator tests (including the actual current quiz-report service under concurrent submissions), the real Learning Lab and Plant Lab service suites, 42 module/guard/SDK tests, and the production Angular build. The flag service now creates its report and increments the question counter in one transaction using the same AngularFire SDK instance. Existing production clients can still submit their separate report; their best-effort counter write remains denied as before until the updated client is promoted.

`npm run test:rules` runs the complete access suite plus both actual lab services using the canonical rules. `scripts/verify-live-paper-rules.mjs` independently retrieves the active Rules API source through existing CI authentication, then tests admin paper/review operations and learner/visitor denial in an isolated emulator. Its artifact records the actual ruleset identifier and source. This read-only job must pass after any rules publication; passing only local tests is not evidence of activation.

No production hosting, Realtime Database rules, indexes or user roles were changed. Protected workflow gates remain intact. Future workflow deployments use `firebase-v2-backend.yml`; authorized direct console publication is also available when that account is authenticated. Rollback can select the previous rules release in Firebase, but doing so disables the newly added module permissions.
