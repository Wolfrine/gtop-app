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

These are two observations on this PC, not a general latency benchmark. After each turn `/api/ps` was empty. Whole-machine RAM use during this later test was around80%, showing that other resident applications and current OS accounting affect the overall figure. The original idle model runner was the confirmed largest removable consumer; removing it does not establish that every other process is unnecessary.

Private before/after snapshots, actual prompts/responses, task briefs, release results and cold-start timings remain under `H:/GTOP-Local-AI/pilot-runtime/production/release-qa/on-demand-2026-10-25/`. Protected CI and final production listener readback are recorded below after delivery. No UI, model weights, legacy scheduler or cloud application behavior is changed by this local controller release.
