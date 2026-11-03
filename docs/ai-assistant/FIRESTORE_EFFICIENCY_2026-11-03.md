# GTOP Firestore efficiency delivery, 2026-11-03

## Scope and preserved behavior

GTOP-only correction on `main`, continuing the Nov 2 listener/Qwen delivery at
`48bdb912d476c004bcd4876314274d40bf6cd961`. PTI source and its starter REST
contract are unchanged. No production paper, conversation, or job is created by
acceptance checks. The unrelated installed-runner verifier edit is excluded.

- Keep `assistantWorkers` as stable server-only pairing/authorization. Heartbeats
  validate that pairing but write only sanitized `assistantWorkerHealth` telemetry.
  Dispatch rules retain immediate pairing revocation and no payload/query grants.
- Publish health every 40 seconds under the unchanged 90-second freshness bound.
  Job lease renewal/cancellation stays every 30 seconds with a 120-second lease.
  Existing 30-second workers remain compatible during rolling deployment.
- Give invited owners exact-document content/presence notifications. Healthy,
  visible idle Papers clients no longer repeatedly fetch session/history over HTTP.
  Foreground/reconnect invalidation, auth fencing, denied-listener revalidation,
  hidden-tab teardown and bounded outage/cross-admin fallback remain.
- Publish UI invalidations for material job/conversation changes, without waking
  clients for unchanged progress or pure lease renewal. Partial text behavior,
  Qwen lifecycle, Codex execution and printed artifacts are unchanged.

## Evidence before release

Production Monitoring DELTA counters, not a billing invoice:

| UTC window on Nov 3 | Reads | Writes | Hourly equivalent R/W |
|---|---:|---:|---:|
| 00:00-01:00 | 483 | 175 | 483 / 175 |
| 07:40-07:50 | 79 | 30 | 474 / 180 |

The hour had 120 worker heartbeats and 55 starter polls, matching 175 writes.
The former shared heartbeat/authorization document could also cause rule
dependency re-evaluation for two dispatch listeners: approximately 240 reads/hour
is a source-based estimate, not separately identified by Monitoring labels.
The visible idle frontend's prior 60-second gateway refresh amplified reads
according to loaded history; no live open-tab before/after total is claimed.

Remaining costs include pairing validation per heartbeat, health updates,
starter mailbox polling, listener startup/token refresh and actual usage. Joining
health makes the unchanged starter poll transaction three reads rather than two.
At 55 starter polls/hour, the new quiet model is about 270 reads/145 writes per
hour; this is an estimate pending measured acceptance. A visible health listener
also pays for delivered health updates and security dependencies.

## Verification and release status

Preserved local checks: backend/domain 65/65, worker 95/95, actual emulator
integration 5/5. Focused final backend 8/8 and worker lifecycle 15/15 passed.
The last frontend auth/pairing recovery changes passed 48/48 tests. CI reruns
required security/build gates, including two final existing-document write-denial
assertions. Synthetic fixture rendering is distinct from signed-in owner/device
acceptance; native Chrome inspection was blocked by automatic URL-policy review.

At preparation, no Nov 3 commit or deployment has occurred. Final CI revisions,
idle worker cutover and post-release quiet counters will be appended after actual
verification. Evidence/scratch is under
`F:\Workspace\Codex\2026-11-03\gtop-firestore\outputs`.
