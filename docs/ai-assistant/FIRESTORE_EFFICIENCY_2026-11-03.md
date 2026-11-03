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
hour; this is a source estimate, not the measured result below. A visible health listener
also pays for delivered health updates and security dependencies.

## Measured post-release comparison

Cloud Monitoring project/database DELTA points and Cloud Run request logs were
collected at 09:22:37 UTC, then rechecked at 09:27:31 UTC. Metrics have 60-second
sampling and a stated ingestion delay up to 240 seconds. The final collection
is over five minutes after both windows; every series has five or three complete
minute points, with no pagination truncation. Probes and Action Plan writes from
this parent were outside these windows. These are short hourly equivalents, not
a measured full day or an invoice.

| Nov 3 UTC window | Read ops | CREATE / UPDATE writes | Reads/hour | Writes/hour |
|---|---:|---:|---:|---:|
| Baseline 00:00-01:00 | 483 | absent / 175 | 483 | 175 |
| Post-release 09:13-09:18 | 25 | 5 / 11 | 300 | 192 |
| Trailing 09:19-09:22 | 17 | 0 / 8 | 340 | 160 |

Both post windows show zero QUERY reads. First-window reads are 24 LOOKUP plus
one NOT_FOUND; trailing reads are 17 LOOKUP. First-window totals were unchanged
on the mature recheck. Its five CREATEs are not explained by heartbeat/starter
handlers or local worker job counters; their source remains unverified. The core
CI browser run overlapped that window, but no causal attribution is established.
Do not describe this first window as a total write reduction.

The trailing window has only five successful worker heartbeats and three starter
polls in gateway logs, all from revision `00016-jer`; eight UPDATE writes match
those eight requests. There were no claim, session, job or frontend HTTP routes
in either post window. A request straddling a minute boundary can differ from the
minute in which its write is counted. Three trailing reads exceed the simple
five-heartbeat plus three-times-three-poll model and remain unattributed by these
aggregate labels. No billing reduction is claimed for an individual listener.

Compared with the hour baseline, measured reads are 30-38% lower. Trailing writes
are 9% lower, while the first sample's total writes are higher due to the CREATE
operations. The nominal worker cadence reduces heartbeat writes from 120 to 90
per hour; the short sample caught five beats in three minutes, so its 100/hour
equivalent is sampling phase, not a changed 40-second timer. No additional live
experiment or workload was generated to obtain these counters.

## Verified release

Implementation commit: `9e0ac050d0d269d29d87b9816f94397707a6791b` on `main`.
[Assistant workflow 41607912303](https://github.com/Wolfrine/gtop-app/actions/runs/41607912303)
passed verify, backend and Hosting. It deployed the rules and gateway revision
`gtopassistantgateway-00016-jer`; the gateway release label and served Papers
`version.json` both match the implementation commit. Hosting completed at
09:10:30 UTC. No direct/manual cloud deployment bypass was used.

CI passed 65 backend tests, 94 worker tests (one Windows-only test skipped on
Linux), five actual emulator integration tests, 32 shared Firestore rule tests,
one database rule test and 48 frontend tests, plus builds/audits. The final
existing-document write-denial assertions ran in CI. Preserved local Windows
worker suite: 95/95; focused final backend 8/8 and worker lifecycle 15/15.

The four synthetic Papers idle/working renders passed and were visually inspected
at 1440x900 and 390x844 from CI artifact `13216709935`. Composer, availability,
progress and cancel controls remain visible without clipping. No draft was sent.
Native Chrome inspection was blocked by automatic approval review because its URL
could not be verified; signed-in owner/device acceptance remains unverified.

[Core workflow 41607912415](https://github.com/Wolfrine/gtop-app/actions/runs/41607912415)
also succeeded: 211 unit tests, shared-rule gates and production build passed;
browser summary was 241 passed, two flaky on retry and 117 skipped. Its unrelated
backend, Hosting and shared-backend promotions were skipped as assistant-only.

Live read-only smoke passed invited-owner session/status and exact metadata
access, anonymous/cross-owner denial and direct-job denial. Production pairing
was not disabled to provoke revocation; immediate revocation and user demotion
were verified against the same rule source in the emulator.

## Installed worker and availability

Two bounded queue queries returned no queued/running/validating jobs before the
idle replacement at 09:10:50 UTC. Exact prior PID/native ownership, recent idle
telemetry, unloaded model and only infrastructure children were checked. The
old worker PID 29288 was terminated while idle; its native host exited before
the exact stale lock was removed. This was an idle process replacement, not an
OS graceful-signal shutdown (the installed Windows launcher has no such endpoint).
The existing hidden native launcher started host 36360 and worker 35488.

New local health reports 40000ms interval, 90000ms freshness, model installed,
Codex available and model not resident. Dispatch became ready with one listener
session, two initial empty claims, zero errors and zero jobs. Across local
snapshots 09:12:21-09:18:21 UTC, health advanced nine times while claims,
notifications, listener sessions, errors and jobs did not change. The post-window
queue was empty. Ollama PIDs 22240 (GTOP 11435) and 20516 (11434) are unchanged.
No PTI source/settings, starter API, Qwen adapter, Codex runner, dispatch transport,
paper contents or printed artifacts were modified.

Field-masked production probes outside the quiet window show pairing updateTime
unchanged at `2026-11-03T09:08:54.747055Z` while health advanced from ready at
09:11:40 to ready at 09:18:20. No pairing secrets were retrieved by these probes.

## Limits and evidence

No production job, inference or paper-generation acceptance was submitted. Qwen
residency/tool-loop cleanup is covered by the retained focused tests and unchanged
adapter; a fresh live inference latency comparison was intentionally not run.
Frontend HTTP savings are tested for visible/hidden/auth/reconnect behavior but
not measured in an open signed-in owner tab. Existing old tabs retain their old
polling until the offered app update/reload is accepted. Bounded fallback,
cross-admin views, active-job expiry reconciliation and fifty-minute worker token
refresh still read Firestore. Health listeners also incur delivery/security reads.

The parent integrated separate frontend and read-only evidence lanes, then
completed release acceptance itself. Evidence/scratch is under
`F:\Workspace\Codex\2026-11-03\gtop-firestore\outputs`, including baseline usage,
masked metadata, CI summary, synthetic renders and local counter snapshots.
