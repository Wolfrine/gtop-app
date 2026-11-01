# GTOP local runner repair — 1 November 2026

Owner authorization: complete local harness repair, scoped live acceptance and main delivery. Execution uses one agent. The impact area is the Windows GTOP controller and its PTI runner consumer; the PTI initiator source remains owned by its concurrent lane. No UI changes or cloud backend/Hosting changes are required.

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

Baseline: 72 controller tests passed before implementation. New tests cover contract identity/config/environment mismatch, untrusted/removed helpers, dynamic resolution across updates, removed candidate directories, stable selection, no shared-port fallback, installed-versus-resident health, bounded startup retries, cancellation, missing-model refusal before claims, unavailable Codex/offline state and idle cleanup. Backend tests exercise the real service/store/domain behavior without production records.

The PTI native source was built into the GTOP QA directory and passed its subsystem, endpoint, fixed-config, quoting and windowless probe tests: helper/child console handles were zero, desktop unchanged. This probe started no model or production worker and is not scheduled-runtime acceptance.

The new `scripts/accept-runner.ts` is intentionally small: real Qwen inference and cleanup, then one fresh four-mark/two-question Class 5 practice paper through actual Codex planning/generation/review, service validation, separate student/answer artifacts, retrieval and SHA checks. Application state is in memory and explicitly synthetic. It starts no production claim loops, does not use production gateway authentication, and cannot read or resume retired jobs. This does not establish classroom, teacher, physical-print or production-gateway acceptance.

PTI source/runtime cutover remains conditional on its concurrent inspect lane releasing ownership. Installing or restarting PTI while that lane is active is excluded. Keep optional One Piece settings and its independent process unchanged. The expected installation uses the existing versioned main installer; source checks alone do not install it. A genuine scheduled invocation, fresh owned-process identity, live heartbeat and actual inference must be recorded separately.

Do not alter the user/machine SEFPO environment, tray listener or H: weights. On an occupied dedicated port, wrong ownership or existing legacy worker, refuse rather than kill/adopt the process. Do not restart the retired two-hour creator or requeue historical requests. Recheck active work immediately before production worker startup.

## Prevention and rollback

1. Require contract v1 and current executable discovery before accepting work; retain per-job resolved executable/arguments and contract ID in private invocation evidence.
2. Test app-update removal, unavailable dispatcher, empty tags, old worker contract and failed helper as release regressions. Keep source tests separate from actual runtime and delivery checks.
3. Monitor `worker-health.json`, PTI `gtop-startup.json`, exact process identity and gateway heartbeat age. `launch_verified` or a successful poll alone cannot mean ready/delivered.
4. Keep request deduplication, exact process/start-time ownership, native mutexes, the PTI 75-second start budget and 45-second dispatcher sub-budget. Refuse unknown ownership. Retry only owned startup health reads, never model pulls or question generation.
5. If cutover fails, restore only GTOP's previous config/helper selection and source under an idle owner-authorized cutover. Stop only newly created identity-verified GTOP children. Preserve SEFPO, model weights, original jobs and diagnostic evidence. Restoring the old broken config is rollback, not recovery.

## Current outcome

Source/type checks and unit regressions are complete. Live runtime and end-to-end results will be appended after ownership clearance and measured execution. A pending or blocked runtime acceptance is not a completed repair.
