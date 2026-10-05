# Reviewed asynchronous practice invitation

This experiment tests whether a short, curriculum-specific invitation helps learners start and return to solo practice. Supplied evidence was sparse: 74 CBSE Class 12 attempts from four learners, and 23 Solutions attempts from one learner. It does not establish broad demand, ten users/day, acquisition, or growth. No GA reports were read.

## Learner and teacher workflow

Admins use the existing Custom Quiz setup to select one board, class, subject, chapter and five questions, then Copy practice link. Sharing checks the reviewed server documents first and provides a selectable link if clipboard access fails. The public `/practice` preview explains curriculum, pace and revision purpose without exposing questions. URLs contain configured curriculum and count, with no learner, recipient, result or question identifiers.

Existing sign-in and profile setup retain the invitation through `returnUrl`. Ordinary learners must match their own board and class; admin curriculum freedom is intentional and explained. A mismatch offers the dashboard without changing the learner profile. Repeated/invalid scope and conflicting run modes fail closed. Existing `returnTo` and `hubReturnPath` support is retained through a small allowlist of internal destinations.

The invitation uses the actual asynchronous solo player, its answer presentation, explanations and result saver. It does not use QuizRun. After an actual server-acknowledged completion, below result review, learners may choose Keep this practice on my dashboard or Not now. Keep stores an account-local card due after 24 hours on this device; its copy explicitly says it is shown when GTOP is opened. Off removes the cue only after verified persistence. Failures remain visible and do not claim a successful save/removal.

No browser notification permission, push subscription, background delivery, email, SMS, contact list, public leaderboard, paper-admin consent, security rule or Functions changes are included. Existing private result storage retains the learner's owned answers and immutable source snapshots.

## Content boundary

The pilot manifest is CBSE / Class 12 / Chemistry / Solutions, revision `cbse-12-chemistry-solutions-starter-5-2026-10-04`. The app supports configured scopes and only enables sharing/starting for a reviewed manifest. Additional scopes require a reviewed manifest rather than a hardcoded change to the solo player.

The exact five-question pack came from private Library `libfile_0197fc7810cc819185b47ed698d528ea`, version 0, 13,763 bytes. All five SHA-256 fingerprints were recomputed locally over `[board, standard, subject, chapter, question, options, correctIndex, solutions]`. The committed manifest contains scope, IDs and fingerprints, not the private question pack. Runtime reads require all five exact documents and matching fingerprints; there is no random fallback, question generation or bank mutation. This is introductory revision after concepts are introduced, not a mastery diagnostic or human teacher approval.

## Durable integration

The isolated integration includes the reliability source `a8be6d535a9e9a50c3f21190fe99bfeff964b130` from PR #57. It reuses `presentQuestion`, `restorePresentation`, `validOrder`, and `canonicalIndex`; no second shuffle is implemented.

`InvitationAttempt` records account/role, stable attempt ID, entry type, optional retry parent, reviewed revision, exact ordered IDs/fingerprints, immutable canonical snapshots, presented option orders and answers, question index, completion, acknowledged receipt and voluntary cue decision. Account-scoped tab persistence is separate from ordinary quizzes. Reload restores the same ID/order/answers before any new practice is considered. Navigation directives creating a new/retry attempt are consumed once, so a hard reload cannot create another attempt.

The invitation guard prepares a candidate without staging a source, then rechecks navigation, generation, account and curriculum before commit. The player loads this dedicated source before ordinary custom/random/retry handling and checkpoints actual answer/navigation/submission events. Ordinary navigation cannot silently overwrite a completed unsaved invitation: explicit previous-result recovery opens the exact retained summary.

The generic saver keeps `quizType: custom` for reporting and adds validated `source.kind: invitation` plus the private immutable invitation payload. Validation enforces the reviewed revision, exactly five IDs/hashes, stable canonical answers/order and a 256 KB bound. The payload participates in the existing idempotent save equality, server acknowledgement and recovery. Consent is offered only for the captured current owned attempt after its exact acknowledged receipt; optimistic or late callbacks, account changes, duplicates and historical views cannot trigger it.

Historical review restores original snapshots without fetching changed bank content. Revisit five questions creates a fresh empty attempt and links its parent through local navigation state. An older owned historical parent is verified against its actual server result before creating the child. It does not adopt a more recent result as parent. Other learners' result identities are not carried into an admin's own practice. Ordinary retry retains its existing behavior.

Unavailable results show recovery without a fabricated zero-score hero. If offline navigation cannot load the summary module, the completed attempt remains retained; reconnection and an explicit document reload reopen the same result for saving. Local emulator mode is retained across reloads only on localhost. Reduced-motion preference disables the summary chart animation; normal-motion rendering is also checked for settled complete geometry.

## Measurement and verification

Bounded local evidence and existing analytics hooks distinguish `invite_exposure`, `invite_open`, `practice_first_answer`, `acknowledged_completion`, `practice_return_click` and `practice_return`. Clicking does not clear the cue or imply successful source loading. Payloads contain stage/time, constant experiment/count and sanitized analytics page location. They add no learner, recipient, question, result or scope-label identifiers. Existing analytics transport can carry its own identifiers; these hooks do not prove anonymous transport or unique acquisition.

The portable integration Playwright spec requires an explicitly supplied private fixture and synthetic loopback-emulator accounts; it skips when that fixture is absent. Tests use the real Angular player, existing Firebase rules, actual saves and historical reads, and allow only loopback services plus font assets. No production writes or analytics requests are allowed. Contract tests cover identity, source validation, lifecycle cancellation, consent/storage failures and canonical presentation. Browser acceptance includes desktop and 390/320 px phone renders, reload, mismatch, historical/source-edit recovery, deliberate retry, offline recovery, voluntary Not now and Off failures, and real touch swipe/tap reachability.

Final candidate checks, exact source/build fingerprints, screenshots and independent critic/QA findings are recorded in the PR and linked Library evidence packet. The 24-hour due state is verified with a controlled clock; this is not a measured next-day production return. WebKit remains unverified because its browser asset could not be downloaded in this environment. Production build has the repository's existing bundle/style budget warnings. There is no merge, deployment or demonstrated growth in this increment.
