# Local LLM -> Codex qualification: prompts, timings and findings

**Experiment date:** 23 October 2026. **Documentation scope:** retrospective technical analysis of saved evidence. No new inference, GTOP feature, backend data write, deployment or scheduled-job change was needed to produce this documentation.

The **local LLM did not generate the examination papers**. It interpreted a synthetic teacher request and returned a small JSON handoff. Python validated/canonicalized that handoff and assembled a much larger, human-authored controller prompt with official reference content and an output schema. **Codex CLI's cloud model (`gpt-6.1-sol`) generated the actual questions, answers and marking schemes**, using the existing ChatGPT subscription login. Python then validated and rendered the returned content. Review, correction and PDF delivery were explicitly orchestrated during the qualification; this was not an autonomous GTOP web workflow.

## Start here

- [Prompt flow with the actual three requests and handoffs](PROMPT_FLOW.md)
- [Stage timings, measurement definitions and failure analysis](TIMINGS_AND_FINDINGS.md)
- [Catalogue of all 36 standard test cases](PROMPT_CATALOG.md)
- [All 180 retained local request/response pairs](local-requests.jsonl), including reconstructed request payloads, saved outputs and timings
- [Local timings as CSV](local-timings.csv), [Codex run index](codex-runs.json), [stage totals](stage-timings.json)
- [Capture gaps](local-request-coverage.json), [source references and hashes](source-references.json), [artifact integrity manifest](evidence-manifest.json)

## Main workflow timings

All values below come from saved timing fields, in seconds. These particular local calls included partial/full runner loads; they are not the warm benchmark medians.

| Workflow | Local model | Local first streamed content | Complete local JSON | Local load, included in JSON time | Codex generation | Codex review | Codex correction |
|---|---|---:|---:|---:|---:|---:|---:|
| Science, 39 questions / 80 marks | Qwen 3.5 2B Q4_K_M | 3.4387 | 5.1476 | 3.1132 | 340.375 | 64.125 | 39.672 |
| Mathematics Standard, 38 / 80 | Qwen 3.5 4B Q4_K_M | 6.9233 | 8.8186 | 6.5123 | 432.109 | 50.375 | No Codex correction; local refinements |
| Science Q6 revision | Qwen 3.5 4B Q4_K_M | 0.5794 | 1.2752 | 0.0045 | 15.141 | No separate review run | None |

The main Science JSON used `Class 10`; the controller changed it to `10`. Maths used `Mathematics`; the controller mapped it to `Mathematics Standard`. The original user request already explicitly specified Standard, and the harness checked against a known supported test brief. This normalization is not evidence that an ambiguous future Maths request can safely be interpreted as Standard.

## Model comparison

| Exact Ollama tag | Strict factual/action cases | Limited alias normalization | Warm full-response p50 / p95 | Warm decode median |
|---|---:|---:|---:|---:|
| `qwen3.5:2b-q4_K_M` | 6/36 | 15/36 | 1.5941 / 2.1059 s | 100.78 tokens/s |
| `qwen3.5:4b-q4_K_M` | **28/36** | **28/36** | 2.2660 / 2.5917 s | 62.76 tokens/s |
| `gemma4:e2b-it-qat` | 19/36 | 19/36 | 1.2396 / 5.5088 s | 106.21 tokens/s |

Each model completed 54 retained runs: 36 standard cases, six longer-reference cases, nine warm repeats and three runner reloads. The additional archive has six larger context tests, nine free-conversation turns and three paper-workflow handoffs: **180 retained pairs** in total. Preliminary overwritten/retried calls and the final duplicate check are disclosed separately; 180 is not a claim to count every inference during setup.

The strict score checks expected facts and action, **not truthfulness of the model's reply, fluency, production permission enforcement or paper quality**. Both main paper runs falsely replied that a paper had already been created. Therefore 28/36 is not a safe-execution rate. Qwen 4B is the best supervised-pilot candidate among these three, not qualified for unattended deployment.

## Evidence boundaries

- Saved `dialogue.json` contains the actual request, actual returned JSON and actual timing for each main handoff. Local HTTP payloads are **reconstructed** from these records and archived harness constants; packet-level payloads were not recorded.
- Codex prompt files came from the actual saved `input.txt`. The two generation copies retain the controller instructions but explicitly omit the large third-party curriculum/sample bodies. Original whole-input SHA-256 values, reference URLs and PDF/text hashes are retained. Other review/correction/revision/resume prompt copies are verbatim saved bytes. Full original generation inputs remain at the local evidence root described in the manifest.
- CLI-generated implicit system/developer context was not captured in these input files. The input-token counter covers more than the visible controller prompt. These documents do not claim to reconstruct the entire wire-level Codex conversation.
- Harness snapshots are the final observed source, archived as `.py.txt` for inspection. Some code was repaired during the experiment; a final snapshot is not represented as a version captured before every run. No archived harness is wired into GTOP runtime or CI.
- Paper JSON is original **synthetic demonstration content**, with no live-bank IDs or claimed bank reuse. Academic approval remains pending. The Science syllabus ambiguity and review defects are described in the findings.

## Verify the archive

Run from any checkout, with Python 3:

```text
python docs/ai-assistant/local-qualification-2026-10-23/verify_evidence.py
```

On the original PC, also verify against the original saved artifacts:

```text
python docs/ai-assistant/local-qualification-2026-10-23/verify_evidence.py --local-root H:/GTOP-Local-AI
```

The verifier checks checksums, JSON/JSONL parsing, record coverage, per-run associations, timing arithmetic and benchmark aggregates. It makes no model, network, Firebase or deployment call. Runtime/educational acceptance is outside the scope of this documentation check.
