# Paper chat release

The implementation is merged in [PR 56](https://github.com/Wolfrine/gtop-app/pull/56). Production promotion and worker activation require successful live verification.

## Deployment route

The original Firebase CLI deployment failed with HTTP 403 creating a Firestore index. The existing deployment account has index read access, Cloud Functions Admin, Cloud Run Admin, Service Account User and Service Account Token Creator, but lacks index creation and project IAM mutation.

[Read-only delegation verification 37188889398](https://github.com/Wolfrine/gtop-app/actions/runs/37188889398) successfully minted a temporary token for the already-authorized runtime account. It verified index creation, Eventarc receive and Cloud Run invoke permissions. No new IAM bindings or persistent credentials were created.

GitHub Actions now uses a temporary, datastore-scoped token for the three reviewed indexes. It preserves existing indexes and waits for READY. Rules are deployed with the original account. The Google Cloud CLI deploys exactly the four paper functions using the existing runtime permissions and the actual Firestore location, with matching retry policies, limits and paper-service labels. This avoids the Firebase CLI's unnecessary project-IAM bootstrap changes where effective runtime permissions already exist. Function states, runtime, source commit and trigger configuration are read back.

Application validation and backend deployment run concurrently. Hosting promotion waits for both, uses the verified build artifact from the same commit, and checks actual hosted version and assets.

## Release completion

1. Verify backend deployment, active rules, anonymous-access denial, authenticated existing-admin configuration and Firebase Storage bucket.
2. Verify final app tests, hosting promotion and served commit/asset checks.
3. Atomically activate questionBankAgentInstructions/paper-chat-v1 and Agents/questionBankCreator.paperChatEnabled using fresh update tokens; record the verified commit and activation time.
4. Read back the schedule: 08:00, 10:00, 12:00, 14:00, 16:00, 18:00 and 20:00 Asia/Kolkata. Confirm bank reuse first and no manual question approval for chat papers.
5. Mark action plan PyvGBkV1TytX9MMzXH1i Done after live release and worker activation. The urgent papers require actual admin requirements; no fictional production requests are created.

Verification already covers module/rule checks, publisher validation and actual emulator delivery, the browser matrix, five desktop/mobile visual review cycles and A4 student/answer PDFs with image, maths and page counters. Visual status is agent-reviewed; owner acceptance is pending. Real-device push and a production generated-image request need real-user exercise.
