# Experimental evidence and limitations

All tests were conducted on the previously inspected Windows machine with RTX 4060 8 GB, using Ollama `qwen3.5:4b-q4_K_M`. New local calls used 8K context, non-thinking mode, temperature 0.2, seed 73 and ten-minute keep-alive. Model outputs and synthetic data are retained; important failures were not overwritten. [Metrics](metrics.json) are machine-derived; [manual observations](manual-audit.json) are explicitly posthoc inspection, not a blinded language or academic score.

## Primary local conversation: 36 + 36 turns

Six six-turn sessions cover English, Hindi and Roman Hinglish, each with a synthetic learner and teacher. They test personalized practice, a simple 6 V/2 A calculation, analogy, context recall, claimed deployment authority, cross-conversation unavailability, bank policy, full-syllabus 80-mark requirements, actual job progress, a bank-only correction and cancellation/stale artifacts. No Codex call was made by these sessions; delegation was recorded as a shadow proposal only.

Baseline routes matched 12/36 expectations. Thirty-five outputs parsed; `hi-teacher-1` exhausted the 400-token budget and returned truncated JSON. Its partial output is retained. The experiment continued with a controller error placeholder in history, rather than inventing a successful assistant answer. All subsequently recorded attempts use the captured final harness; some failure capture code was strengthened after this first error.

Version 2 added explicit route definitions and grounded bank-first/bank-only descriptions, raised the output limit to 800 tokens and requested shorter internal interpretations/actions. It returned 36 parseable envelopes and matched 31 routes. These are **the same cases used for revision**, so the uplift is a development observation, not an independent accuracy estimate. Script/language sanity passed 36/36; that only checks Devanagari presence or rough Roman Hinglish markers, not fluency.

Manual inspection still found material failures:

- `en-teacher-4`: described the job as queued despite fresh controller facts saying running, phase draft generation, elapsed 45 seconds. `en-teacher-6` similarly repeated queued after cancellation.
- `hi-teacher-6`: acknowledged cancellation but also said Codex was still running without evidence.
- `hi-learner-6`: inferred elapsed study time without a measured clock.
- Bank-first explanations remained incomplete or wrong in multiple languages despite definitions in the prompt. `hi-teacher-2`/`hinglish-teacher-2` denied original-demo permission which was explicitly granted for routine content.
- `en-teacher-2`: imported the profile's 15-minute study preference into the paper task. Some Hindi identity/authority wording confused Sachit with another name.
- Hinglish arithmetic and analogy wording included unnatural phrases. Correct numbers and a valid JSON envelope do not qualify the conversational experience.

The basic 6/2 resistance answers and short recall generally worked. These strengths do not remove the operational and policy defects.

## Context selection: six targeted status turns and nine new dialogue turns

The targeted status test reuses the six known teacher status inputs for running/cancelled jobs. It omits obsolete assistant status history and the irrelevant study-time profile, passing current job facts and a compact task context. It does not replace the local response with a template. All six captured outputs are local-model-generated conversation.

The three running replies correctly said draft generation was in progress and did not fabricate an ETA. Of the cancellation replies, English and Hinglish retained the old revision's cancellation/unusability. **Hindi incorrectly said the new revision had been cancelled**, rather than old revision 1. Narrow selection helped but was insufficient; deterministic operational fields and checked wording remain necessary. These are known-case repairs, not a heldout success rate.

Nine fresh dialogue turns were authored after v2 was fixed, with no further prompt tuning: calculate 12/1.5 = 8 ohms, then retain 12 V while replacing the resistor with 12 ohms to obtain 1 A, then discuss planning an 80-mark full-syllabus paper without starting it. All nine selected `local_answer`; all six numeric replies used the correct latest values. The three planning replies exposed over-personalization/scope drift: English introduced weak-topic worked examples, Hindi pivoted toward a short Electricity set and proposed five questions, and Hinglish asked for topic emphasis despite the full-syllabus request. No job was started. This small holdout supports basic continuity, not general task faithfulness.

## Handoff comparison: deliberate information corruption

Eight cases inject these problems: marks/duration corruption, a lost latest subject correction, ignored bank-only correction with zero eligible questions, claimed deployment approval, invented board/class, a latest planning-only instruction, a contradiction between original 80 marks and controller-verified 60, and reference text trying to narrow the paper to a 10-mark Cells quiz.

Both arms use the same Codex analysis instruction and result schema. The brief-only arm supplies a deliberately wrong accepted brief, permissions and data availability. The rich arm additionally supplies original text, relevant history, local proposal, verified requirements/evidence IDs and revision context. All cases are in [handoff-cases.json](handoff-cases.json). They are manually injected faults rather than eight naturally observed local mistakes. Because the rich arm has more information, this is an information-boundary test, not a model-versus-model benchmark or proof that every earlier controller would accept these corruptions.

| Codex batch | Strict cases | Wall seconds |
|---|---:|---:|
| Brief-only eight-case batch | 1/8 | 19.906 |
| Rich eight-case batch | 7/8 | 26.797 |
| Rich reversed-order repeat of two cases | 2/2 | 10.188 |
| Brief-only reversed-order repeat of the same two | 0/2 | 9.547 |

Codex in the rich arm independently recovered the original intent, latest correction and allowed next action for all eight on manual inspection. Strict scoring remains **7/8**: the reference-injection case returned scope `full_syllabus; 2026-27; internal choices` rather than exact enum `full_syllabus`. Do not rewrite that failed check as a strict pass. The schema should keep those fields separate. In the intentionally wrong controller-requirement case, Codex identified the original 80 marks and returned `needs_reconciliation`, demonstrating the desired independent check.

The repeats cover only two cases, and batched cases share one cloud context. Four calls yielding 20 case decisions do not establish a statistical production error rate. No paper was generated and no tool was executed in these four calls.

## Actual educational-review execution and return conversation

Original Hinglish request: review a wrong worked solution for a 24 V ideal source, a 6-ohm series resistor and parallel 12/6-ohm resistors; calculate resistance, total current, branch currents and 300-second energy. Prior user context established CBSE 10 Electricity and a preference for worked corrections.

1. Local interpretation/answer: **4.4512 seconds**, first streamed content 0.6883 s. It selected `local_answer`, correctly found 10 ohms, 2.4 A and 17,280 J, **but assigned 1.6 A to the 12-ohm branch and 0.8 A to the 6-ohm branch**, reversing the correct values.
2. The operator's authorized experimental workflow explicitly sent the full rich packet to Codex despite that route. Controller preflight and transcript integrity checks passed. The actual local answer, including its error, was provided as supplementary context.
3. While the CLI process was running, the local model answered an actual status question in **2.8414 seconds** using measured `running` facts and unknown ETA. It distinguished its own earlier calculation from the pending independent review. This shows one local turn overlapping a cloud job, not a load test.
4. Codex completed in **14.250 seconds** with zero tools. It corrected both the supplied series-only solution and the local answer's swapped branch currents.
5. Python `Fraction` independently recomputed total resistance **10 ohms**, total current **2.4 A**, 12-ohm current **0.8 A**, 6-ohm current **1.6 A**, energy **17,280 J**. All numeric and event-ID checks passed. This validates these numbers, not every possible explanation.
6. The local model explained the validated result naturally in Hinglish in **3.9393 seconds**, now with the correct branch assignments.

These are stage measurements, not an end-to-end SLA. The progress call overlapped the Codex run; do not add it as a serial stage. No new paper PDF or GTOP artifact was published. The older full-paper generation remains documented in the [first qualification](../local-qualification-2026-10-23/README.md).

## Timing definitions

Local wall time measures HTTP request through complete output parsing; first content is the first non-empty streamed content fragment, possibly the opening JSON character, **not necessarily readable prose displayed to the user**. Model load is included. Warm means saved `load_s < 1` for this experiment, which differs from the stricter load threshold in the older benchmark. p95 uses nearest rank. Failed baseline output has a saved elapsed time but is excluded from successful-output latency aggregates.

| Suite | Warm successes | Complete JSON p50 / p95 | First content p50 |
|---|---:|---:|---:|
| Baseline primary conversation | 34 | 3.32355 / 6.4202 s | 0.2812 s |
| Revised primary conversation | 36 | 2.98245 / 5.0389 s | 0.3035 s |

One baseline request after the Ollama runner had no model loaded took **47.7476 s**, first content 43.263 s, load 42.7225 s. This is an observed idle-load request, not a measured Windows reboot. Earlier cached runner reloads around seven seconds do not establish this cold-path latency.

Codex wall time includes subprocess startup, cloud inference, event reading and process completion; local parsing follows. CLI usage includes implicit context beyond saved stdin. All five calls completed with exit 0 and `turn.completed`; expected Code Mode unavailable diagnostic events are retained, not treated as a failed final turn. The runner disables relevant tools and rejects unexpected tool events. The account-wide weekly-used snapshot moved from 11% near the start to 12% near the end, but shared concurrent usage and rounded counters prevent attributing that delta to these calls. No monetary savings or request allowance is inferred.

## Controller tests and remaining acceptance

Four offline tests passed after strengthening the prototype's authentication-first check. They check that local proposals do not confer authority; approval binds operation/request hash; unauthenticated approval claims fail; arbitrary shell is unsupported; bank-only zero-data is blocked; stale/unvalidated results are blocked; transcript alteration is detected; corrupted numeric results are rejected; a refused loopback connection leaves a local SQLite job queued across reopening; and another owner cannot retrieve it.

This is local prototype evidence. The approval dictionary represents already verified controller facts; no remote approval identity, revocation service or Firebase rules were implemented. The unavailable-port test did not power off the PC or stop Ollama. It proves neither a remote always-available inbox nor mobile reconnection. General free-text truth, real user memory, attachment parsing, cloud cancellation, process-crash recovery, isolation and teacher acceptance remain separate gates.

## Reproduction and capture

Every local request message/options object was saved before invocation. `captured-local-turns.jsonl` preserves parsed JSON values, original-file byte hashes and canonical JSON hashes for requests/responses/failures. These are captured request objects, not the reconstructed payloads of the older archive and not a packet trace. Codex `input.txt`, schema, events, result and execution summaries are verbatim retained files. Implicit system/developer CLI context was not captured. No credentials or live user data are archived.

The final harness snapshots under `harness/` document local conversation, selected-context testing, rich-packet assembly, explicit Codex execution and prototype control tests. They are inspection copies ending in `.py.txt`, not a GTOP runtime. Some error-handling and the authentication guard were repaired during the experiment; these snapshots are not asserted to be a version history captured before every call. The two offline SQLite test files are intentionally excluded.

On the original PC, the actual commands were:

```text
python H:/GTOP-Local-AI/scripts/evaluate_roles.py local
python H:/GTOP-Local-AI/scripts/evaluate_roles.py local v2
python H:/GTOP-Local-AI/scripts/evaluate_roles.py handoff
python H:/GTOP-Local-AI/scripts/evaluate_roles.py execution v2
python H:/GTOP-Local-AI/scripts/evaluate_context.py
python H:/GTOP-Local-AI/scripts/test_role_controls.py
```

These commands may invoke models/Codex and consume subscription allowance on a fresh evidence root. Existing captured requests/results are reused only when the request matches; failed attempts are retained rather than automatically overwritten. Do not treat a cached replay as a new timing or a fresh concurrent-progress test. To inspect the archive, use the read-only verifier in the README instead.
