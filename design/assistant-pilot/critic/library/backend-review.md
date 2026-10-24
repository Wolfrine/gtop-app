# Library backend privacy and correctness review

**Current verdict: no blocker remains in the inspected diff.** One concrete ownership side effect was reported and corrected during review. This is independent source/test-definition inspection, not a claim that the critic executed the parent's suite or Firebase probes.

## Finding and correction

The original `retry(uid,jid)` called `expireOne(jid)` before checking ownership. An invited administrator could obtain another creator's job ID from the new read-only transcript, call that job's retry endpoint and receive 404 **after** its expired running/validating job had already been mutated to failed with a cleared lease. The earlier cross-owner test used a completed job and checked only status, missing the side effect.

The parent corrected this. Current `assistant-service/service.mjs:165` passes the caller UID into `expireOne`; line 198 checks owner mismatch inside the transaction before any write. Existing owner validation remains at line 167. `assistant-service/test/gateway.test.mjs:44` now advances a running job past expiry, snapshots the complete store, verifies cross-admin retry and admin transcript read leave it unchanged, and checks owner retry still succeeds. The critic reread the corrected source and assertions; the parent reported the gateway suite passing.

## Inspected evidence

| Concern | Current evidence |
| --- | --- |
| Request authorization | `gateway.mjs:17`–29 verifies bearer claims and calls `service.user`; `service.mjs:41`–45 requires both current admin role and current invited-owner allowlist. New admin methods recheck that authorization. Worker identities cannot enter this user path. |
| Bounded list disclosure | `service.mjs:103` lists explicit metadata fields only; `summary` and `publicConversation` whitelist output. Creator display name is returned, while profile email and the complete user profile are not. Conversation latest-paper enrichment checks both owner and conversation linkage at line 110. |
| Read-only transcript | `service.mjs:115`–118 calls `conversationView`, not the owner view's expiration path. Public jobs omit lease/worker/proposal payloads. Transcript returns original conversation messages and paper summaries as explicitly authorized shared admin content; it does not return conversation memory or internal handoffs. |
| Artifact read | `service.mjs:120` authorizes the invited administrator, resolves the stored owner and delegates to the existing integrity-checked artifact read at line 191. No stored paper/artifact is mutated. `gateway.mjs:41` keeps the existing restrictive artifact CSP and no-store/private headers. |
| Owner-only mutations | Submit and cancel check stored owner before writes at `service.mjs:147` and 159. Retry now scopes expiration before checking owner for its normal transaction. No new admin mutation endpoint exists. |
| Pagination | `service.mjs:104` requests 51 rows ordered by document ID, returns 50 and advances after the last returned ID. `store.mjs:8`–12 implements the real Firestore cursor before projection/limit; MemoryStore mirrors ASCII generated-ID ordering. No user-controlled collection path is accepted. |
| Generated title persistence | `service.mjs:317` atomically persists the delivered-paper title, latest-paper ID and `titleSource:'generated-paper'` alongside publication. Read enrichment checks existing paper linkage; generic conversational replies do not overwrite this title. This is a source-verified write, not inferred solely from the derived title response. |

Relevant test definitions were inspected: `gateway.test.mjs:30`–48 covers allowed cross-admin reads, metadata/internal-field limits, artifact immutability, denied identities, revocation, 113-record paging, invalid cursors and the corrected expired-job ownership boundary. `firestore.integration.mjs:26`–43 uses isolated `demo-gtop-assistant` Auth/Firestore/functions, real tokens and 53 seeded synthetic papers to assert 50+3 paging without duplicates and cross-owner read/write behavior.

The parent reported local 37-test and two real-emulator tests passing before the additional correction, then 17 gateway tests passing after it. These execution results are parent-owned; the critic did not launch new experiments or tests. Source/test definitions do not prove hosted deployment or production IAM. Shared admin transcripts intentionally contain user-authored conversation text; the UI must communicate that invited-administrator scope clearly, which is checked separately in the Library visual review.

Final parent-reported rerun: 38 local tests and two actual Auth/Firestore/function tests passed, now including a cross-admin retry of an expired running task with the complete stored job unchanged, and unchanged admin read. The critic retains this as parent execution evidence. Hashes for the five inspected backend/test files are recorded in `backend-manifest.json`.
