# Private GTOP assistant gateway

This is an independent Node.js 22 Firebase function. It does not invoke a model,
read the legacy question bank, or start any old generation scheduler. The outbound
Windows controller owns local-model and subscription-authenticated Codex execution.
The gateway owns identity, immutable user messages, durable jobs, current execution
facts, ownership, leases, revision guards, independent paper validation and private
printable HTML delivery. `CONTRACT.md` defines the shared interface.

## Security and storage

An administrator must also appear in the explicitly provisioned
`assistantConfig/pilot.allowedOwnerUids`. Every conversation/job/paper lookup checks
ownership. A paired worker must be enabled, possess its Firebase custom claim, and
be assigned the owner. Its plaintext random bootstrap secret stays on the PC;
only its SHA-256 is provisioned in `assistantWorkers/{workerId}`. Bootstrap token
signing uses the existing runtime identity; signing failure does not grant IAM.

New data uses `assistantConversations`, `assistantJobs`, `assistantPapers`,
`assistantFeedback`, `assistantConfig`, and `assistantWorkers`. Direct clients cannot
read or write these namespaces under the canonical rules. All access passes through
the gateway. User responses exclude bootstrap hashes, worker assignments, leases,
private metrics and local-model proposals. Worker payloads reconstruct root/current
messages and their UTF-8 hashes from persisted user text. Model-written permission
or original-request fields are never accepted.

Jobs are claimed atomically for 120 seconds and renewed every 30 seconds by the
controller. Expired in-flight jobs fail recoverably and need an explicit user retry.
Cancellation, superseding requests and revoked owner access invalidate delivery.
Publication validates attempted marks, chapter coverage, source metadata and
revision containment; both HTML artifacts and the revision are committed atomically.
Private artifact documents store gzip/base64 content under 850 KB, with a 4 MB raw
HTML ceiling. Retrieval decompresses and checks original UTF-8 SHA-256 and byte
length before returning HTML; corrupt or oversized documents fail closed.
Academic correctness still requires the teacher's review.

## Local verification

Use Node.js 22 (the local bundled Node.js 24 also runs these checks):

```text
cd assistant-service
npm ci
npm run check
npm test
cd ..
npx firebase-tools@15 emulators:exec --config firebase.assistant.json --only auth,firestore,functions,database --project demo-gtop-assistant "node --test assistant-service/test/firestore.integration.mjs"
```

The integration suite refuses to run without Auth and Firestore emulators. Its
identities, messages and papers are explicitly synthetic; it writes no production
fixtures. It tests the actual HTTP function and canonical rules, alongside pure
gateway and domain tests.

## Deployment boundary

`.github/workflows/gtop-assistant-release.yml` validates backend/domain/controller
logic, real emulator endpoints/rules, existing shared-rule regressions and the
independent frontend. It then uses existing
protected Firebase environments and the existing Actions identity to deploy only
`gtopAssistantGateway`, verify its runtime/release and access, and promote only
`gtop-question-papers` Hosting. It deploys only the reviewed `assistantWorker`
identity exclusion in shared Firestore/Realtime Database rules, preserving normal
human permissions, with unrelated live rule drift blocked. Existing server-only
Storage policies are read and preserved. It does not deploy core Hosting, old
functions, indexes, migrations, or scheduler configuration. The site and private pilot/worker
configuration must be explicitly provisioned; missing access or signing authority
is a release blocker, never an automatic IAM repair.
