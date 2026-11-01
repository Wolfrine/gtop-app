# GTOP local runner repair — 1 November 2026

Owner authorization: complete local harness repair, scoped live acceptance and main delivery. Execution uses one agent. The impact area is the Windows GTOP controller and its PTI runner consumer. PTI source and concurrent Velum Research files were never modified by this worker. After the owner confirmed the inspect lanes had ended and the Research edit excluded the installed runtime, installation proceeded in that runtime only. No UI or cloud backend/Hosting changes were required.

## Failure and evidence

The [before snapshot](before.json) contains only operational fields and model metadata. It does not contain pairing material, gateway tokens, prompts or conversation content.

- GTOP configured Qwen `qwen3.5:4b-q4_K_M` on shared `http://127.0.0.1:11434`. That listener belonged to desktop Ollama PID 20516 and returned empty installed/resident model lists.
- User/process `OLLAMA_MODELS` selected the empty SEFPO model store. GTOP's intended H: store still held the selected manifest and all seven referenced blobs at their declared sizes. The manifest SHA-256 was `0bfd9b30a103a15f8293afaf1846a5073890afad5248553f3ea978626372c586`.
- The installed PTI initiator was 1.1.0. Its last start attempt recorded `model_unavailable`, while its polling status could show `state:failed` with `errorCode:null`. A successful gateway poll incorrectly obscured the failed runner cause.
- GTOP's configured desktop Codex build `9614f1d9b40d9c4f` had been removed by an application update. Current discovery found `22cfb1d302613eae`, reporting `codex-cli 0.166.0-alpha.5.1`.
- No active GTOP application jobs were returned by the bounded MCP query for queued/running/leased/validating/delegated states. Only the PTI initiator appeared in the relevant GTOP/question/initiator scheduled-task check. This is a timestamped safety observation, not permission to resume historical jobs.

The immediate outage was endpoint/model-store coupling: GTOP depended on the tray-owned shared port while expecting a separate H-backed model store. The obsolete Codex pin was an independent second failure. The precise historical event that replaced the earlier dispatcher was not reconstructed. Existing tests covered conversation behavior but did not catch the external runner contract or desktop-update lifecycle.

Earlier bridge attempts had a real path allowlist and could not repair the runtime. The current task has edit/Full Access with approval never; actual source writes and checks succeeded. Those earlier permission restrictions are not treated as current policy.

## Canonical source repair

`tools/gtop-assistant/src/runner.ts` consumes PTI's `GTOP-RUNNER-CONTRACT.md` v1:

- Require numeric `runnerContractVersion:1` and an explicit dedicated loopback URL. Reject shared 11434, aliases, credentials, paths, queries and invalid port ranges.
- Validate the fixed credential-free contract's SHA-256 identity, worker/config/model/endpoint, H: storage, matching launch environment and trusted release resolver location. Reject redirected or invalid contracts before claiming work.
- Use `pathToFileURL()` to load the release resolver and call it for every Codex job. A removed app build can be replaced while the worker stays alive. Helper failures are actionable and never resurrect the obsolete config pin. A compatible older v1 launcher may use its explicit existing contract executable only when no helper was supplied.
- An explicit standalone launcher uses equivalent newest-existing desktop executable discovery; it does not trust arbitrary PATH commands or an old worker-config path.

`adapters.ts` applies the scoped endpoint to tags, residency, chat and unload calls, with redirects refused. Startup health reads have a three-attempt limit with 250/750 ms waits; permanent missing-model/executable failures stop immediately. No inference, Codex generation or expensive job is automatically replayed. The existing 15-minute Codex invocation limit and server lease/cancellation fences remain in effect.

`worker.ts` separates installed model, resident model, usable Codex and dispatcher availability. Unavailable prerequisites report offline and suspend new claims. Safe local `worker-health.json` records the reason and sampled time. Empty `/api/ps` is healthy while idle; it is not evidence of a missing installation. No startup warm-up occurs. Inference uses `keep_alive:0` and explicit cleanup in `finally`, including cancellation and failure.

The standalone launcher defaults and README now reference the F-drive runtime. Private `worker.json` was migrated to endpoint 11435/version 1 without changing protected pairing, and the stale Codex setting was removed. A private rollback copy remains under the owning runtime, outside Git.

## Acceptance and operating boundaries

Baseline: 72 controller tests passed before implementation. The repaired consumer passes 90 controller tests and TypeScript checking; 48 backend tests passed. Another 34 PTI initiator tests passed from an isolated copy under GTOP QA, leaving the active PTI source untouched. New tests cover contract identity/config/environment mismatch, untrusted/removed helpers, dynamic resolution across updates, removed candidate directories, stable selection, no shared-port fallback, installed-versus-resident health, bounded startup retries, cancellation, missing-model refusal before claims, unavailable Codex/offline state and idle cleanup. A final regression guard refuses explicit-original-total/default conflicts before generation, preserves later sourced corrections, and does not confuse per-question marks with a total.

The PTI native source was built into the GTOP QA directory and passed its subsystem, endpoint, fixed-config, quoting and windowless probe tests: helper/child console handles were zero, desktop unchanged. This probe started no model or production worker and is not scheduled-runtime acceptance.

The final `scripts/accept-runner.ts` verifies real Qwen inference and cleanup, then a fresh ten-mark, fifteen-minute, two-question Class 5 practice paper through actual Codex planning/generation/review, service validation, separate student/answer artifacts, retrieval and SHA checks. Application state is in memory and explicitly synthetic. It starts no production claim loops, does not use production gateway authentication, and cannot read or resume retired jobs. Domain validation and exact scope assertions run before generation. A separate `scripts/check-acceptance-artifacts.mjs` independently checks the saved bytes, hashes, question counts, marks and duration. Classroom, teacher and physical-print acceptance are not claimed.

After ownership clearance, the existing main installer installed PTI `1.2.0-7e29cf8`, retaining `onePieceEnabled:true`. It registered/started the existing windowless scheduled initiator. Its new PID was 1736; the owned dispatcher is PID 22240 and the initial worker PID was 27516. Native ownership records include executable identity, process creation times, dedicated endpoint/model root and contract ID. Both new native hosts report `createNoWindow:true`. Existing One Piece native PID 1640 and tray Ollama PID 20516 remained alive. The worker alone is idle-reloaded after committing the final total-conflict guard; [final runtime evidence](runtime-final.json) records its new identity and fresh gateway readiness.

The [installed runtime evidence](runtime-after.json) was obtained by `scripts/verify-installed-runner.ts`: it validates the actual v1 contract and native process ownership, checks local health, and uses the existing paired worker client to poll the real gateway. The gateway confirmed `state:ready`, worker `ready`, starter `online`, a fresh worker heartbeat and `modelReady:false`. This operational poll publishes normal starter telemetry; it creates no paper/conversation jobs. Actual production worker heartbeats and Action Plan updates are operational writes, separate from the synthetic application's `productionWrites:false` claim.

The [preservation snapshot](preservation-after.json) confirms the 11434 tray PID and user model-root value are unchanged, the H: manifest hash and every referenced blob's size/write time are unchanged, and no GTOP/question scheduler was found. Both large weight blobs also passed full SHA-256 checks against their manifest digests. The scheduled initiator was running with `IgnoreNew`; its history still reported `0x800710E0`, and the operational event log was unavailable. That historical field is not counted as successful task completion. The actual newly scheduled process, fresh publications and native ownership were independently verified; no healthy process was restarted to clear the history field.

Do not alter the user/machine SEFPO environment, tray listener or H: weights. On an occupied dedicated port, wrong ownership or existing legacy worker, refuse rather than kill/adopt the process. Do not restart the retired two-hour creator or requeue historical requests. Recheck active work immediately before production worker startup.

## Prevention and rollback

1. Require contract v1 and current executable discovery before accepting work; retain per-job resolved executable/arguments and contract ID in private invocation evidence.
2. Test app-update removal, unavailable dispatcher, empty tags, old worker contract and failed helper as release regressions. Keep source tests separate from actual runtime and delivery checks.
3. Monitor `worker-health.json`, PTI `gtop-startup.json`, exact process identity and gateway heartbeat age. `launch_verified` or a successful poll alone cannot mean ready/delivered.
4. Keep request deduplication, exact process/start-time ownership, native mutexes, the PTI 75-second start budget and 45-second dispatcher sub-budget. Refuse unknown ownership. Retry only owned startup health reads, never model pulls or question generation.
5. If cutover fails, restore only GTOP's previous config/helper selection and source under an idle owner-authorized cutover. Stop only newly created identity-verified GTOP children. Preserve SEFPO, model weights, original jobs and diagnostic evidence. Restoring the old broken config is rollback, not recovery.

## Measured live outcomes

| Attempt | Outcome |
| --- | --- |
| Initial cold arithmetic/tool conversation | First model response completed in 139.95 s, including 81.50 s load and 55.03 s prompt processing. A second tool step exceeded the existing 150 s conversation budget. Cleanup succeeded in 10 ms and residency returned empty. No paper generation occurred. |
| First standalone greeting and four-mark paper fixture | Greeting passed in 34.36 s, including 33.43 s load. The single-digit mark total was not recognized by the existing parser, so defaults expanded the paper to 80 marks/34 questions. Independent review refused delivery for conflict with the original request. The subsequent correction was interrupted by the parent task limit; no residual CLI or dispatcher remained when checked. No completed artifact set is claimed or reused. |
| Installed ten-mark/ten-minute fixture | Qwen and Codex planning passed, but the domain validator correctly refused the duration below its 15-minute minimum. No paper was delegated or generated. The fixture now runs domain validation before generation. |
| Installed ten-mark/fifteen-minute fixture | Passed: Qwen turn and unload; actual `gpt-6.1-sol` / `xhigh` planning, generation (160.833 s) and independent review (26.040 s); exactly two five-mark questions; Addition-only scope; no internal choices; no correction pass; separate service artifact retrieval and independent saved-byte verification. |

The [successful acceptance record](live-acceptance.json) and [independent artifact check](artifact-check.json) record student HTML 374604 bytes / SHA-256 `a496cc80a2c004daa58dc3635a1ee0722f72db29822a9365c80240312bf8f6bf`, and answer HTML 392718 bytes / SHA-256 `6af13b9733336f12417003a72cf5e3db33320b3ca64145e2e7c003dd83866a8e`. Full synthetic prompts, review, invocation records and artifacts remain under `F:\Workspace\Support\GTOP\assistant-runtime\release-qa\installed-v1.2-minimal-10-15`. No production paper/conversation or retired request was created/resumed by acceptance.

Source repair `056aa777132ca21c24c40eaf9541c1c3d86c1227` passed [CI 41290910840](https://github.com/Wolfrine/gtop-app/actions/runs/41290910840). Absolute-path hardening and scope fencing `365b4bc57d8709a1d3a315a415a46fc656a0f923` passed [CI 41292733542](https://github.com/Wolfrine/gtop-app/actions/runs/41292733542). Both runs retained the existing verification pipeline and skipped unchanged backend/Hosting deployment.

## Remaining limits

- Cold multi-step Qwen work can exhaust the 150-second budget. Cleanup and bounded fallback work; this repair does not promise interactive cold-start latency or raise inference budgets.
- Shared backend parsing/product limits were not expanded: accepted totals are currently 10–100 marks and duration 15–360 minutes. The old parser can miss single-digit totals. The final GTOP harness guard now refuses the observed explicit `Total 4 marks`/default-80 conflict before model generation; it does not claim general support for below-range papers. The failed fixture and review refusal remain preserved, and acceptance validates supported scope before generation.
- PTI `status.json` still clears its local `errorCode` on a successful poll even when an older service request failed. The v1.2 `gtop-startup.json` diagnostic and GTOP `worker-health.json` provide the actionable local reason. PTI source was deliberately left untouched; the current restored service is genuinely ready.
- The browser access host was unavailable, so the PTI owner button/browser flow was not observed. The installed native start, real gateway readiness and actual model/controller delivery path were verified separately; no owner-device UI acceptance is claimed.
