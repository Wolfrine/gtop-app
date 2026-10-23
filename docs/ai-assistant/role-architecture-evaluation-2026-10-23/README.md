# Conversational intelligence and independent execution: role experiment

**23 October 2026. Provisional architecture for Sachit's review.** This extends the [earlier local qualification](../local-qualification-2026-10-23/README.md); it does not replace or reinterpret its historical results. New inference was performed for this experiment. No GTOP application, production data, deployment, or legacy schedule was changed.

The recommended role split is **local LLM as the primary conversational intelligence; Codex as an independently reasoning specialist; controller as the authority and evidence boundary**. The experiment supports preserving original intent through a rich handoff. It does **not** qualify the current 4B model for unattended multilingual conversation.

- [Refined architecture, authority boundaries and phased approval gates](ARCHITECTURE.md)
- [Experiments, timings, failures and interpretation](EXPERIMENTS.md)
- [All 90 captured local attempts](captured-local-turns.jsonl): 89 valid responses and one retained truncated failure
- [Derived metrics](metrics.json), [manual audit](manual-audit.json), [integrity manifest](evidence-manifest.json)
- [Eight handoff cases](handoff-cases.json), [20 case decisions across four Codex batches](handoff-results.json)
- [Actual educational-review handoff](execution-handoff.json), [Codex result](codex/real-worked-review/result.json), [independent numeric validation](execution-validation.json)

## What was demonstrated

| Experiment | Observed result | What it establishes |
|---|---|---|
| Local primary conversation, six English/Hindi/Hinglish sessions | Baseline 12/36 correct routes; revised prompt 31/36 | Prompt/response-format changes improve routing on the same cases; semantic and language defects remain |
| Narrow context selection for six known status cases | All three running replies grounded; one Hindi cancellation reply still names the wrong revision | Current job facts need explicit context selection and independent presentation checks |
| Nine fresh local-only dialogue turns | 9/9 routes; six arithmetic/updated-value answers correct on manual inspection | Basic local help and short continuity work without Codex; paper-planning drift persists |
| Fault-injected handoffs | Brief-only 1/8 strict; rich 7/8 strict, with all eight intended actions/intents preserved on manual inspection | Original request/history let Codex detect misleading summaries and even contradictory controller requirements |
| Actual local -> controller -> Codex -> local explanation | 4.4512 s local interpretation; 14.250 s Codex; 3.9393 s local result explanation | Codex corrected an actual error in the local answer; independent arithmetic validation passed |
| Independent controller tests | Four tests passed | Offline prototype gates cover auth, operation/approval binding, empty bank-only, request hashes, stale results and durable local queue ownership |

The real review was explicitly directed by the experiment operator: the local model incorrectly selected `local_answer` and swapped the parallel-branch currents. Codex independently corrected them using the original request. This is evidence of successful independent review **after an explicit handoff**, not successful autonomous difficulty detection.

## Latency and availability

For the revised 36-turn conversation suite, warm complete JSON p50/p95 was **2.98245 / 5.0389 seconds**, with first streamed content p50 **0.3035 seconds**. The first request after the runner had become idle took **47.7476 seconds**, including **42.7225 seconds loading**. A primary conversational experience therefore needs measured warm-residency/readiness behavior; an immediate controller acknowledgment alone does not make a cold model responsive.

The other Codex runs took 9.547-26.797 seconds for batched intent analysis. These are not paper-generation timings. The earlier full 80-mark Science/Maths generation took 340.375/432.109 seconds before review. No new full paper was generated here.

## Evidence and scope

Profiles, teacher/learner identities, requests, bank counts and injected corruptions are synthetic fixtures. Inference timings, captured prompts, outputs, CLI events, connection-refusal observation and arithmetic results are real measurements. No live GTOP bank/student records were used. The locally generated conversational answers and Codex-generated review are distinct in the archive.

The 36-turn local comparison was tuned on the same cases, the six context-repair cases are known cases, and the nine fresh turns are a small holdout authored after the prompt was fixed. Handoff errors were deliberately injected by the harness; they were not all observed errors of this local model. Four cloud batches produced 20 decisions; these are not 20 independent cloud trials. The brief-only arm intentionally withholds information. It does not faithfully reproduce every validation guard of the earlier prototype.

The prototype does not establish remote Firebase authorization, public multi-user subscription suitability, attachment safety, physical host-off behavior, long-session memory, native Hindi/Hinglish fluency, full-syllabus academic approval or production uptime. Five content-only CLI calls used the existing ChatGPT login and zero tools. No API credential or API fallback was introduced.

## Verify without inference

```text
python docs/ai-assistant/role-architecture-evaluation-2026-10-23/verify_evidence.py
python docs/ai-assistant/role-architecture-evaluation-2026-10-23/verify_evidence.py --local-root H:/GTOP-Local-AI
```

These commands inspect saved bytes, transcript hashes, associations, recorded metrics, job events and arithmetic; they make no network/model/app call. Harness snapshots are for inspection and are not wired into GTOP or CI. See [experiment reproduction boundaries](EXPERIMENTS.md#reproduction-and-capture).
