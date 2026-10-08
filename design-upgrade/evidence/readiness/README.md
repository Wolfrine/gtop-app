# Readiness evidence

Captured 8 October 2026 against application commit `00116b57042df34a49b99031dbea3c1bebe897a4`. Original bytes are stored in this repository; Actions links provide provenance rather than being the sole source.

| Run | Outcome | Meaning |
|---|---|---|
| [Initial](https://github.com/Wolfrine/gtop-app/actions/runs/37758424604) | 10 existing checks passed; 2 new checks failed | The new busy fixture omitted register initialization |
| [Follow-up](https://github.com/Wolfrine/gtop-app/actions/runs/37759629039) | Initialization worked; 2 checks failed | The check expected “Load older papers”; the actual control was “Continue search” |
| [Final focused run](https://github.com/Wolfrine/gtop-app/actions/runs/37760643776) | Both busy checks passed | Each viewport showed 30 records, then 60 through the continuation control, from 90 synthetic source records |

The application did not require a code change for these proofs. The corrections were in capture setup and assertions. Ten earlier successful checks were not repeated in the final focused run.

## Find evidence

- [Capture catalog](../../screens/catalog.json): all 53 PNGs, dimensions, provenance, hashes, inspection status and diagnostic exclusions.
- [Import manifest](import-manifest.json): all 70 original artifact files with byte lengths and SHA-256 values.
- [Provenance](provenance.json): capture boundary and setup history.
- [Workflow revisions](workflow-revisions/): exact capture setup revisions.
- [Initial results](runs/initial/tests.json), [follow-up results](runs/followup/tests.json), [final results](runs/final/tests.json).
- [Public capture metadata](runs/followup/public/manifest.json).

Run `python3 design-upgrade/verify_evidence.py` from the repository to verify the stored originals, screenshot metadata, result counts and local document links. This verifies archive integrity, not product quality.

## Gallery

The named captures below are representative capability evidence. Public landing views are live; authenticated views use synthetic local Firebase data. Full audit coverage remains Step 2.

| Capture | Mobile | Desktop |
|---|---|---|
| Live landing | [PNG](../../screens/2026-10-08-readiness/followup/public/gtop-390.png) | [PNG](../../screens/2026-10-08-readiness/followup/public/gtop-1440.png) |
| Learner restored quiz | [PNG](../../screens/2026-10-08-readiness/initial/e2e/practice-reliability-learn-5ff0b--restores-answers-on-reload-mobile390/learner-restored.png) | [PNG](../../screens/2026-10-08-readiness/initial/e2e/practice-reliability-learn-5ff0b--restores-answers-on-reload-desktop1440/learner-restored.png) |
| Admin curriculum selection | [PNG](../../screens/2026-10-08-readiness/initial/e2e/practice-reliability-admin-f8da0--of-another-board-and-class-mobile390/admin-selected.png) | [PNG](../../screens/2026-10-08-readiness/initial/e2e/practice-reliability-admin-f8da0--of-another-board-and-class-desktop1440/admin-selected.png) |
| Missing profile | [PNG](../../screens/2026-10-08-readiness/initial/e2e/practice-reliability-missi-fb64a-explicit-recoverable-states-mobile390/missing-profile.png) | [PNG](../../screens/2026-10-08-readiness/initial/e2e/practice-reliability-missi-fb64a-explicit-recoverable-states-desktop1440/missing-profile.png) |
| Empty curriculum | [PNG](../../screens/2026-10-08-readiness/initial/e2e/practice-reliability-missi-fb64a-explicit-recoverable-states-mobile390/empty-curriculum.png) | [PNG](../../screens/2026-10-08-readiness/initial/e2e/practice-reliability-missi-fb64a-explicit-recoverable-states-desktop1440/empty-curriculum.png) |
| Profile removed during quiz | [PNG](../../screens/2026-10-08-readiness/initial/e2e/practice-reliability-missi-fb64a-explicit-recoverable-states-mobile390/profile-removed-during-quiz.png) | [PNG](../../screens/2026-10-08-readiness/initial/e2e/practice-reliability-missi-fb64a-explicit-recoverable-states-desktop1440/profile-removed-during-quiz.png) |
| Cancelled paper request | [PNG](../../screens/2026-10-08-readiness/initial/e2e/paper-chat-chat-saves-a-re-70fce-s-cancellation-after-reload-mobile390/chat-cancelled.png) | [PNG](../../screens/2026-10-08-readiness/initial/e2e/paper-chat-chat-saves-a-re-70fce-s-cancellation-after-reload-desktop1440/chat-cancelled.png) |
| Separate answer key | [PNG](../../screens/2026-10-08-readiness/initial/e2e/paper-chat-delivered-paper-d7b1e-r-archive-remain-accessible-mobile390/paper-answer-key.png) | [PNG](../../screens/2026-10-08-readiness/initial/e2e/paper-chat-delivered-paper-d7b1e-r-archive-remain-accessible-desktop1440/paper-answer-key.png) |
| Busy paper register | [PNG](../../screens/2026-10-08-readiness/final/e2e/readiness-states-readiness-e77e7-irst-page-and-older-records-mobile390/busy-register-90-records.png) | [PNG](../../screens/2026-10-08-readiness/final/e2e/readiness-states-readiness-e77e7-irst-page-and-older-records-desktop1440/busy-register-90-records.png) |
| twks access proof | [PNG](../../screens/2026-10-08-readiness/followup/public/twks-390.png) | [PNG](../../screens/2026-10-08-readiness/followup/public/twks-1440.png) |

## Exclusions and limits

The initial twks image caught loading; use the follow-up captures for access proof. Nightjar remains incomplete reference evidence and is excluded from design comparison. `test-failed-*.png` and failure traces preserve setup diagnostics; they do not demonstrate accepted screen states. Automatically saved test-end screenshots may duplicate named captures.

There are no accepted benchmark comparisons or GTOP screen ratings in this collection. Motion, actual physical devices, real-user comprehension and complete route coverage require their own evidence.
