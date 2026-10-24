# Local AI memory release — 25 October 2026

Sachit requested an effective local assistant without idle model services consuming the PC's RAM or preventing gaming. The live machine had 31.93GiB physical RAM, about 94% in use. The GTOP Ollama child `llama-server.exe` held about 8.2GiB working set and 14.2GiB private committed memory. Those are different measurements and must not be added together. Its installed Qwen3.5:4b-q4_K_M was pinned with an expiry in 2319: the controller warmed it at startup and both warmup and normal chat used `keep_alive:-1`.

After an authoritative bounded query found no queued/running/validating assistant jobs, only the identified GTOP worker and its esbuild child were stopped. Model-specific Ollama unload returned `done_reason:unload`, `/api/ps` became empty, and physical RAM use fell to65.7%, with10.95GiB free. This is an observed whole-machine snapshot, not a guarantee of a fixed idle percentage with other apps running. Unrelated Node, Codex, ChatGPT, media services and scheduled jobs were preserved.

## Runtime behavior

- The lightweight outbound queue listener starts without loading a model. An unloaded loopback Ollama dispatcher remains available to accept inference. No public PC port, reverse tunnel, Windows password or new scheduled task is introduced.
- Each actual conversational inference loads the installed model and uses `keep_alive:0`. A bounded unload in `finally` also runs after invalid output, cancellation or an inference error, with a fresh cleanup signal. Cleanup failures are recorded privately and do not hide the original inference failure.
- Exact greetings/thanks use the controller's existing language-sensitive social replies without inference or curriculum lookup. Other conversation still uses Qwen, preserving the role-aware prompt,8K context,700-token ceiling, sourced requirements and English/Hindi/Hinglish behavior.
- Model weights and sampling remain unchanged. Conversation memory lives in saved messages, preferences and sourced task briefs, with original requests independently retained for Codex. Model residency is not conversational memory.
- Codex processes run only during actual generation/review/research stages. Paper stages do not prewarm Qwen. One concurrent chat may still load Qwen during a paper job.
- Heartbeats distinguish listener availability (`ready`) from sampled model residency (`modelReady`). The launcher imports TypeScript directly, avoiding a separate tsx CLI parent, and runs the worker below normal priority. A small transform helper may remain alongside that Node worker.

This uses Ollama's documented [zero keep-alive unload](https://docs.ollama.com/api/generate). Cold loading trades response latency for releasing RAM and VRAM between requests.

## Verification and limits

TypeScript and PowerShell syntax checks pass.52controller tests include8new lifecycle tests: no startup inference, queue wake, social fast path, bounded invalid-JSON repair, cancellation cleanup, original failure preservation/recorded cleanup failure, already-cancelled requests and truthful residency.40backend/domain tests also pass, preserving owner/lease/cancellation fences, saved requirements and original handoffs. Fault-path lifecycle tests use synthetic HTTP responses.

Real installed-model acceptance used the actual worker claim loops and AssistantService queue with a synthetic administrator in an isolated in-memory store. No production conversation, paper or Codex generation was created. Idle startup left the model list empty. Two real turns loaded and unloaded the model, and the second answer correctly recalled60marks from the first while the creation pause remained set. Saved requirements retained CBSE, Class10, Science and60marks.

| Observed turn | Model load | Inference including load | Complete with queue wait |
| --- | ---: | ---: | ---: |
| Planning request, no creation |44.178s|46.726s|50.361s|
| Follow-up asking the remembered mark total |5.961s|7.532s|12.899s|

These are two observations on this PC, not a general latency benchmark. After each turn `/api/ps` was empty. Whole-machine RAM use during this later test was around80%, showing that other resident applications and current OS accounting affect the overall figure. A later snapshot showed the user's game running with about4GiB working set, with the model runner absent. Game performance itself was not measured. The original idle model runner was the confirmed largest removable consumer; removing it does not establish that every other process is unnecessary.

Private before/after snapshots, actual prompts/responses, task briefs, release results and cold-start timings remain under `H:/GTOP-Local-AI/pilot-runtime/production/release-qa/on-demand-2026-10-25/`. Protected CI and final production listener readback are recorded below after delivery. No UI, model weights, legacy scheduler or cloud application behavior is changed by this local controller release.

## Production listener readback

The actual Windows launcher was exercised, including corrected PowerShell argument-array quoting and a fail-fast check for immediate child exit. Repeating the launcher against the same configuration correctly refused a duplicate. The final listener process120168 uses one direct Node invocation at below-normal priority; its observed working set was79.1MiB and private memory71.6MiB. Its startup error log was empty. An authoritative worker-document readback at24October21:44:51.823UTC (25October03:14:51.823IST) reported `harness-4-on-demand`, `ready`, `modelReady:false`; `/api/ps` was empty. The production job query was empty before launch. No production acceptance request or new paper was submitted.

Code release `2dc43a665256a7ebb0a97b79a5cedb3dc17b1d7e` passed [protected run 40135647300](https://github.com/Wolfrine/gtop-app/actions/runs/40135647300), including the actual Auth/Firestore/function integration, shared permission regressions, frontend tests/build and dependency/runtime checks. Backend and Hosting deployment jobs were correctly skipped for this controller-only release. The earlier worker commit `3fa89f5` also passed its protected checks. The live source hashes, paired private configuration, final process metadata and CI results remain with the private runtime evidence.

Final resource readback at 21:46:55 UTC found no loaded model or llama runner. The listener used 80.8 MiB working set and the unloaded Ollama dispatcher about 39.9 MiB; the listener had used 0.656 CPU seconds since startup. Total system memory was 84.2% with the game and other applications running. This replaces an idle llama runner that alone held 8.23 GiB working set; it does not require closing unrelated applications. The first unload's 65.7% whole-machine snapshot occurred before the game was observed running.
