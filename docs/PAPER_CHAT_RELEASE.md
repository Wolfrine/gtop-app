# Paper chat release status and Firebase access fix

Updated: 2026-10-04. The implementation is merged in PR [56](https://github.com/Wolfrine/gtop-app/pull/56). It is built and tested, but is **not live**. Production hosting promotion is gated behind successful backend deployment and verification. Chat processing remains disabled in `Agents/questionBankCreator` until that verification succeeds.

## Confirmed blocker

[Production run 37187728832](https://github.com/Wolfrine/gtop-app/actions/runs/37187728832) passed rules, publisher unit tests and actual publication integration, then failed creating the `paperMessages` Firestore index with HTTP 403.

[Read-only access inspection 37188161688](https://github.com/Wolfrine/gtop-app/actions/runs/37188161688) identified the deployment account as `firebase-adminsdk-fbsvc@gtop-app.iam.gserviceaccount.com`. It has function deployment, Cloud Run IAM and runtime impersonation access, but lacks `datastore.indexes.create`, `datastore.indexes.update` and `resourcemanager.projects.setIamPolicy`. No credentials or tokens were logged; no IAM bindings were changed by the inspection.

## Project-owner action

Open [GTOP project IAM](https://console.cloud.google.com/iam-admin/iam?project=gtop-app). Grant **Cloud Datastore Index Admin** (`roles/datastore.indexAdmin`) to the deployment account above. This permits the three checked-in paper-chat indexes; it does not grant project-wide IAM administration. See [Firebase's index permission documentation](https://firebase.google.com/docs/firestore/query-data/indexing#roles_and_permissions).

The installed Firebase CLI also bootstraps the following roles for the first background-function service. Its role inspection found no explicit bindings for these roles. This is a likely subsequent requirement, inferred from the installed CLI's `ensureServiceAgentRoles` implementation; the production function deployment has not reached that stage yet. A project owner can preconfigure these bindings rather than granting the deployment account permission to change project IAM:

| Principal | Role |
| --- | --- |
| `78765581239-compute@developer.gserviceaccount.com` | Cloud Run Invoker (`roles/run.invoker`) |
| `78765581239-compute@developer.gserviceaccount.com` | Eventarc Event Receiver (`roles/eventarc.eventReceiver`) |
| `service-78765581239@gcp-sa-pubsub.iam.gserviceaccount.com` | Service Account Token Creator (`roles/iam.serviceAccountTokenCreator`) |

These are Firebase CLI bootstrap bindings, not permission for the admin to approve questions. Cloud Run invocation and Eventarc receiver roles are documented in [Eventarc permissions](https://cloud.google.com/eventarc/docs/roles-permissions). Verify the service-agent principal exists before granting it; the deployment has already requested service identities. Existing managed service-agent roles must also remain intact.

From a project-owner Cloud Shell session, the corresponding commands are:

```sh
gcloud projects add-iam-policy-binding gtop-app --member=serviceAccount:firebase-adminsdk-fbsvc@gtop-app.iam.gserviceaccount.com --role=roles/datastore.indexAdmin
gcloud projects add-iam-policy-binding gtop-app --member=serviceAccount:78765581239-compute@developer.gserviceaccount.com --role=roles/run.invoker
gcloud projects add-iam-policy-binding gtop-app --member=serviceAccount:78765581239-compute@developer.gserviceaccount.com --role=roles/eventarc.eventReceiver
gcloud projects add-iam-policy-binding gtop-app --member=serviceAccount:service-78765581239@gcp-sa-pubsub.iam.gserviceaccount.com --role=roles/iam.serviceAccountTokenCreator
```

## Resume and verify

1. Rerun the failed production workflow, or dispatch **Deploy current GTOP application** with target `production` and `confirm_production` enabled. The user has already authorized this release.
2. Require backend deployment, active-rule verification, anonymous-access denial, authenticated existing-admin configuration and Firebase Storage bucket verification to succeed.
3. Require the final app checks, hosting promotion and served commit/asset verification to succeed.
4. Atomically activate `questionBankAgentInstructions/paper-chat-v1` and set `Agents/questionBankCreator.paperChatEnabled` to true with fresh update-token preconditions. Record the verified release commit and activation time.
5. Read back the automation schedule and worker configuration. The saved schedule is 08:00, 10:00, 12:00, 14:00, 16:00, 18:00 and 20:00 Asia/Kolkata, with bank reuse first and no manual question approval for chat papers.
6. Mark action plan `PyvGBkV1TytX9MMzXH1i` Done only after live release and worker activation. The two urgent papers still need their actual requirements submitted by the admin; no fictional production requests have been created.

Local and development verification covered module logic, Firestore and database rules, publisher validation and real emulator delivery, the full browser matrix, five desktop/mobile visual review cycles, and actual A4 student/answer PDFs with image, maths and page counters. Visual status is agent-reviewed; owner acceptance remains pending. Real-device push and a production generated-image request still need real-user exercise.
