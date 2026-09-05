# Raw Note - 2026-09-05 - Learning Lab Integration Review

## Source

The founder returned after the Learning Lab delivery and said the last work had not completed, asking for a check. Repository state, development deployment, and a reproduction through the actual V1 entry pages were reviewed.

## Context

The earlier work produced a development deployment and a draft PR, but the module had never been promoted to live GTOP. The first test fixture opened the lesson directly and did not exercise the normal sign-in journey.

## Key Points

- PR #44 remained draft and unmerged, with a successful development deployment. This did not fulfill availability to users on live GTOP.
- The real landing and profile-setup components kept subscriptions after navigation. Saving an account-linked lesson attempt emitted a profile update and caused those departed pages to navigate to the dashboard.
- A revised compiled Angular DOM test started at the actual landing page, passed through the actual profile/sign-in page, and emitted profile updates after saves. It reproduced the unexpected dashboard navigation on the original code and passed after subscription cleanup.
- Successful compilation, isolated lesson tests, and deployment do not establish that the integrated user journey works.
- Signed-in verification against the deployed application remains distinct from local checks; the current browser has no signed-in GTOP session. The report must distinguish a corrected development build from a live release.

## Decisions

- Preserve lesson continuity through the ordinary sign-in, navigation, save, feedback, and return journey.
- Judge availability from the user's intended application and audience, and describe unfinished verification or release steps explicitly.

## Open Questions

- Signed-in development acceptance and promotion to live GTOP remain to be completed.

## Suggested Wiki Integration

- Features: an interactive lesson's readiness includes entry from the surrounding product and uninterrupted progress saving.
- Keep the concrete Angular fix, test commands and release state in technical documentation and delivery tracking.
