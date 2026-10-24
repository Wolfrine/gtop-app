# Timing definitions, observed results and limits

This analysis uses the saved artifacts indexed in [evidence-manifest.json](evidence-manifest.json). It does not rerun models. All examples are synthetic admin briefs; no identifiable student files were used.

## Individual stages

| Stage | Local LLM complete JSON | Codex wall time | Source |
|---|---:|---:|---|
| Science generation | 5.1476 s | 340.375 s | [local](jobs/science/dialogue.json), [Codex](codex/science-generation/execution.json) |
| Science text review | Not invoked | 64.125 s | [execution](codex/science-review/execution.json) |
| Science correction of Q15/Q23/Q39 | Not invoked | 39.672 s | [execution](codex/science-correction/execution.json) |
| Mathematics generation | 8.8186 s | 432.109 s | [local](jobs/maths-standard/dialogue.json), [Codex](codex/maths-standard-generation/execution.json) |
| Mathematics text review | Not invoked | 50.375 s | [execution](codex/maths-standard-review/execution.json) |
| Mathematics local content refinements | Not invoked | Not invoked | [local code](harness/refine_maths.py.txt); not separately timed |
| Science Q6 replacement | 1.2752 s | 15.141 s | [local](jobs/science-revision-q6/dialogue.json), [Codex](codex/science-revision-q6-generation/execution.json) |
| Explicit-session recall/resume | Not invoked | 7.485 s | [execution](codex/session-resume/execution.json) |
| Initial subscription smoke check | Not invoked | No precise standalone execution record retained | [actual returned marker](codex/subscription-smoke-events.jsonl); earlier console observation was approximately 6.8 s |

Serial sums of the measured model stages are **449.3196 s** for Science generation+review+correction, **491.3026 s** for Maths generation+review, and **16.4162 s** for the Q6 handoff+replacement. See [machine-readable calculations](stage-timings.json). These are **not end-to-end user delivery latency**. They exclude manual orchestration gaps, inspection, local refinement, PDF rendering/visual QA, setup/downloads, duplicate checks and failures not included in retained stage records.

### What the clocks mean

- Local `wall_s`: Python `perf_counter` around the complete Ollama request and streamed response. It includes request waiting, model loading, prefill and decoding. `first_content_s` is time to the first nonempty streamed `content` chunk, often the opening JSON character; it is not time to a useful user-visible answer. The UI would need the complete validated JSON. `load_s` comes from Ollama and is already included in wall time; do not add it again.
- `decode_tokens_s`: Ollama's generated-token count divided by its reported evaluation duration. It excludes loading/prefill and is not the whole-request speed.
- Codex `seconds`: local monotonic time from CLI process start through output receipt and process completion. It includes CLI/auth/network/server/generation overhead. There was no separate instrumented Codex time-to-first-answer. `thread.started`, `turn.started` and controller heartbeat events establish lifecycle, not percentage progress.
- Codex token counters are observed CLI fields. The resume result shows cumulative counts from the earlier Science session, so summing it with the original job would double count. These counters are not a currency bill or proof of per-paper subscription capacity.
- Local rendering, semantic review by a human and total delivery were not separately instrumented. Command-level timings from the interactive tool are not substituted for those missing phase timers.

## Benchmark interpretation

The saved comparison is [comparison.json](benchmarks/comparison.json); all raw 54-run model logs and the test oracle are in [benchmarks/](benchmarks/). Warm p50/p95 excludes records with `load_s >= 0.1` and includes only standard or warm-repeat records. Percentiles use the lower order statistic at `int((n-1)*p)`, matching the archived summarizer. Pooled summaries that include reload/context changes are not labelled warm.

Each 36-case standard suite has 12 cases per language: complete Science and Maths requests, essential missing fields, unspecified scope, marks/time correction, subject change, language changes, bank-only correction, status, self-claimed destructive authorization and reference-text injection. Tests are a small synthetic fixed-seed suite, not independent held-out production evaluation. The saved `passed` flag checks expected action/facts and required missing keys; it does not grade the free-text reply.

Qwen 4B passed 8/12 English, 11/12 Hindi and 9/12 Hinglish strict cases. Qwen 2B's class aliases explain some failures (6/36 -> 15/36 after limited canonicalization), but it still lost meaningful facts. Gemma's Hindi cases often lost source policy/internal choices. Passing JSON grammar did not imply correct understanding or safe action.

The six moderate longer-reference tests used actual prompts around 1.7K-2.9K tokens; Qwen 4B passed all six. Extra 3.3K-7.3K tests passed 5/6: the longest Hinglish example retained all facts but returned `clarify` with no missing fields. [Raw stress records](benchmarks/selected-context-stress.json) preserve that failure. No advertised 128K/256K context limit was qualified.

Qwen 4B's three runner reload responses took 7.5433, 7.6718 and 7.7177 seconds. Gemma's first observed request took 95.3136 seconds, while later reloads took about 8.4-8.6 seconds. Filesystem caches and first-load warm-up make these different from PC power-on measurements. Global sampled GPU use includes the desktop and other apps, not just model allocation. Models were loaded one at a time on the RTX 4060 8 GB. The existing Ryzen 5 2600 / approximately 32 GiB RAM / Windows 10 host and exact model digests are archived; no hardware-upgrade conclusion follows from a single workload.

## Observed failures and corrections

1. **False completion in both main handoffs.** Science said "Paper created..." after 5.15 seconds; Maths said the same after 8.82 seconds. Their papers took another 340/432 seconds to generate. The controller did not use model prose as job status. A successful extraction score must not be presented as a truthful conversation score.
2. **Brief loss/normalization.** Subject changes and bank-only corrections failed in the baseline suite. The Maths demo silently generalised Standard to `Mathematics` in its raw JSON; the narrow controller restored the explicitly requested supported variant. An arbitrary production input must not receive that default without evidence. Store controller-owned prior facts and validate proposed patches.
3. **Readable conversation, incomplete fidelity.** Nine actual free-conversation turns were recorded. The Hindi summary omitted board/class and added equal chapter weighting; other replies asked redundant questions despite full-syllabus scope. Fluency is not requirement accuracy. [Conversation evidence](benchmarks/conversation-eval.json).
4. **Science educational defects.** Fresh-session Codex review identified an F1 phenotype/next-generation seed error and an underdetermined eye-defect diagnosis. The recorded correction changed Q15, Q23 and Q39. Review used the same underlying cloud model in a fresh session, without tools or independent source retrieval; it is not a different-model or teacher acceptance result. [Review](codex/science-review/result.json), [correction validation](jobs/science/correction-validation.json).
5. **Diagram review boundary.** Text-only reviewers received diagram metadata, not the rendered diagrams. Complaints that the circuit/right triangle was not printed did not apply to the PDFs produced by trusted rendering. Maths Q33 did need a labelled proof figure; it was added locally. The final chosen PDFs were visually checked in the local qualification, but binary PDFs/PNGs are not duplicated into this source evidence archive. Their source-bound hashes remain in the per-job PDF manifests.
6. **Prompt contamination.** The same review template mentions the Science heredity conflict even for Maths, so the Maths reviewer returned an irrelevant Science issue. The shared generation template also contains both subjects' section-layout instructions, with the brief selecting the actual subject. Subject-specific templates would remove this avoidable ambiguity. These are harness improvement items, not newly observed Maths content failures. The records are retained unchanged.
7. **Curriculum ambiguity.** The supplied current Science detailed list and sample assess heredity, while a teacher note appears to exclude Heredity and Evolution. The demo followed the detailed list/sample provisionally and flagged the conflict. Source URLs/hashes are pinned. Authoritative clarification and academic acceptance remain required; no automatic validator resolves this ambiguity.
8. **Operational defects during qualification.** SQLite connections initially remained open on Windows; local control tests passed after correction. A Unicode console error occurred after the Maths review result had already been saved; it did not mean Codex failed. UTF-8 output handling was repaired. Earlier console/retry records are not all preserved as independent timing observations.

## What the demonstration supports

Existing ChatGPT-authenticated Codex CLI can perform these local content jobs, emit structured results and resume a recorded owned session. Every retained Codex job reported zero observed tool calls. The fixed controller kept model text out of shell argument construction, restricted supported briefs, validated marks/choices, retained originals and contained the Q6 revision. No API key/billing or live-bank query was added.

The evidence does not establish production Firebase ownership, hostile-user isolation, attachment safety, host-off remote queue delivery, a generally accurate conversational assistant, teacher approval, an autonomous review/render loop, or a supported multi-user subscription service. Authentication and job authority in the prototype are trusted local-operator controls. Routine authorized content, Sachit-approved development/deployment, and destructive operations must remain distinct server-enforced capabilities in any future implementation.

For the next pilot, the highest-value changes are controller-owned requirement patches and state-derived responses, subject-specific review templates, explicit bank-only enforcement, complete per-stage instrumentation and a new held-out multilingual evaluation. Codex dominates measured generation latency; the 15-second single-question replacement also supports preserving unchanged content rather than regenerating a full paper for every correction. These are recommendations, not implemented GTOP app changes.

## What to record in the next experiment

Record the actual local HTTP payload and controller-authored Codex input **before invocation**, together with template/schema version hashes, model digest, runtime/CLI version, owner/conversation/request revision, policy decision and source hashes. Keep raw local output separate from the accepted brief and any normalization. Store the exact passed prompt separately from CLI-generated context; capture the latter only through supported diagnostics, never by inventing it from token counts.

Give queue wait, local load/prefill/decode, Codex startup/first-answer/completion, review, correction, validation, rendering and delivery their own start/end timestamps and monotonic durations. Retain every retry/failure rather than overwriting benchmark files. Record final artifact hashes, academic status, duplicate/cancellation outcome and whether each timer is measured, derived or unavailable. This would make a future end-to-end latency claim defensible.

This archive is suitable for the repo because its briefs and outputs are synthetic. Real user conversations, student attachments and account credentials must not be copied into GitHub by adopting this export pattern unchanged; production diagnostics need an explicit private retention/access policy.
