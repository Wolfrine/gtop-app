# Paper chat release

The implementation is merged in [PR 56](https://github.com/Wolfrine/gtop-app/pull/56). Production promotion and worker activation require successful live verification.

## Deployment route

The original Firebase CLI deployment failed with HTTP 403 creating a Firestore index. The existing deployment account has index read access, Cloud Functions Admin, Cloud Run Admin, Service Account User and Service Account Token Creator, but lacks index creation and project IAM mutation.

[Read-only delegation verification 37188889398](https://github.com/Wolfrine/gtop-app/actions/runs/37188889398) successfully minted a temporary token for the already-authorized runtime account. It verified index creation, Eventarc receive and Cloud Run invoke permissions. No new IAM bindings or persistent credentials were created.

GitHub Actions now uses a temporary, datastore-scoped token for the three reviewed indexes. It preserves existing indexes, matches the exact collection group and complete field ordering, and waits for READY. Live compound queries are verified as well as metadata; this caught an API list response that included indexes from other collection groups. Rules are deployed with the original account. The Google Cloud CLI deploys the authenticated Gen2 gateway and three supported Gen1 Firestore background adapters using the existing runtime permissions, with matching retry policies, limits and paper-service labels. The adapters call the same validated handlers; they avoid the confirmed missing Eventarc Service Agent role. Node.js 22 is supported for both generations. This avoids the Firebase CLI's unnecessary project-IAM bootstrap changes where effective runtime permissions already exist. Function states, runtime, source commit and trigger configuration are read back.

Application validation and backend deployment run concurrently. Hosting promotion waits for both, uses the verified build artifact from the same commit, and checks actual hosted version and assets.

The live service check found that the app's configured Firebase image bucket had not been provisioned. The separate paper-backend setup workflow uses the same existing runtime delegation and the official default-bucket API to create and link only that configured bucket in the database region. It installs server-only direct-client rules on a newly provisioned empty bucket and reads back the actual Storage metadata and Firebase link. Existing populated buckets and existing rules are preserved. No billing changes, IAM grants or permanent credentials are introduced.

That setup passed, including actual runtime upload and Firebase token-download of identical image bytes, followed by safe removal of the unique temporary object. All four functions and live admin notification configuration also passed. Hosting published the tested app, but its separate verification runner lacked Playwright dependencies. The promotion job now installs those dependencies and Chromium, verifies the paper-chat sign-in return path, and retains the actual desktop/mobile hosted-page screenshots. The final release remains gated on this complete live check.

## Release completion

1. Verify backend deployment, active rules, anonymous-access denial, authenticated existing-admin configuration and Firebase Storage bucket.
2. Verify final app tests, hosting promotion and served commit/asset checks.
3. Atomically activate questionBankAgentInstructions/paper-chat-v1 and Agents/questionBankCreator.paperChatEnabled using fresh update tokens; record the verified commit and activation time.
4. Read back the schedule: 08:00, 10:00, 12:00, 14:00, 16:00, 18:00 and 20:00 Asia/Kolkata. Confirm bank reuse first and no manual question approval for chat papers.
5. Mark action plan PyvGBkV1TytX9MMzXH1i Done after live release and worker activation. The urgent papers require actual admin requirements; no fictional production requests are created.

Verification already covers module/rule checks, publisher validation and actual emulator delivery, the browser matrix, five desktop/mobile visual review cycles and A4 student/answer PDFs with image, maths and page counters. Visual status is agent-reviewed; owner acceptance is pending. Real-device push and a production generated-image request need real-user exercise.
