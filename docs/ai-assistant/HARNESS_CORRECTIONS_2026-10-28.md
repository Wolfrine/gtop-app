# Earlier Codex delegation and learning — 28 October 2026

Sachit approved correcting the harness, immediate handoff for clear paper requirements, fallback after one or two unresolved turns, and learning from use. GTOP core, existing papers/data and the stopped legacy scheduler are preserved.

## Behavior

- A requested paper with board/class/subject reaches Codex planning immediately, preserving chapters, marks and corrections. A complete chapter packet need not repeat “create.” After one local clarification, the next requirement turn uses Codex. Unresolved interpretation/local failure also falls back. Discussion, holds and an explicit prohibition on Codex remain effective.
- Codex sees verbatim current/task-root requests, history, the sourced brief, local interpretation, verified permissions and available data. A conversation-opening greeting is separate from the paper request. Existing subscription authentication is retained; there is no API billing integration.
- Trusted application `tools/gtop-assistant/AGENTS.md` is loaded and hashed. Skills: conversation v5, explanation v2, creation v4, revision v1, planning v1. Developer instructions are not indiscriminately injected into teacher conversations.
- Qwen has native tools for selected curriculum, actual status, owned questions, arithmetic and skill loading. Results return to the model. Bounds: two tool rounds, three calls per round, one malformed-JSON repair and a 150-second local deadline. Natural final text is accepted without granting action authority.
- Thinking is enabled for explanations/reasoning and current-paper help, with a 2,048-token generation budget; routine replies use 800. The 8,192-token runtime window is budgeted with the pinned Qwen tokenizer and generation/template reserves. The former 8.2 KB packaging limit is removed. Missing tokenizer files use a conservative byte upper bound and can trigger specialist fallback. Upstream dependency declaration-resolution issues require `skipLibCheck`; the controller's strict TypeScript checks remain enabled.
- Model reuse is confined to an active tool loop, with a 30-second crash fallback; `finally` immediately unloads after completion, errors or cancellation. No startup warmup/permanent GPU residency. Cold loading remains a material delay.

## Learning and authority

Private evidence records original prompts, raw responses, model/skill hashes, tool calls, per-call token/load/elapsed metrics and escalation decisions. Controller-accepted Codex interpretations can become owner-scoped retrieval examples, including the original request and clarification. Retain at most 40; retrieve at most two relevant scope-matched examples. Unsafe instruction-like entries are not promoted. Examples remain quoted data, never permission, curriculum evidence or academic approval.

This is **retrieval-based learning, not model-weight fine-tuning**. Every turn can add context/evidence; a measurable intelligence gain on every turn is not guaranteed. Prompts, skills and weights are not automatically rewritten. Daily reviews retain Sachit's correction approval. Feedback is available before a paper exists and can reference the assistant message.

The controller independently verifies ownership, permissions, original integrity, quoted evidence, leases, cancellation, schemas, revisions and publication. Development, deployment, destructive work and bank writes remain unavailable to the pilot.

## Curriculum and papers

A missing prerequisite curriculum can start an official-source check for an explicitly requested paper. A successful check queues exactly one continuation. Newer messages, holds, cancellation, supersession and already completed original papers prevent unintended resumption. Check-only requests do not create papers.

Selected-chapter checks cover the requested chapters; their saved provenance cannot masquerade as full-subject proof. IB DP Mathematics distinguishes AA/AI using the existing course identifier, alongside programme and SL/HL.

Sections support attempted question counts. Optional questions carry equal marks, so every permitted path totals correctly; OR pairs count once. Numbered groups support up to 20 marks; smaller valid papers need not contain ten questions. An exact board format requires an applicable official blueprint, independently validating sections, choices, marks and duration. Older specimens/saved chapter lists do not establish it.

Printed section rules derive from validated counts; student and answer copies remain separate. The current renderer supports text/LaTeX, not visual assets. Generation avoids missing figures and ASCII-diagram questions; explicitly required diagrams need capability clarification.

## Verification

Local checks pass: **71 controller, 56 backend/domain and 24 frontend tests**, strict controller typecheck, backend syntax checks and Angular production build. Cases cover delegation limits, holds, native/unknown tools, private learning, originals, section choices, blueprint requirements and check continuation/cancellation.

Actual inference used installed Qwen3.5 4B Q4_K_M and subscription-authenticated `gpt-6.1-sol`, with a **synthetic administrator, isolated in-memory gateway/storage and a controlled chapter-list fixture**. No production conversation, paper or curriculum fixture was written.

| Observed stage | Seconds |
| --- | ---: |
| Local Hinglish requirements, including cold load/tool/JSON handling | 54.991 |
| Codex generation | 194.016 |
| Independent review | 29.797 |
| One marking-scheme correction | 66.951 |
| Final review | 16.133 |
| Question 2 revision generation / review | 19.571 / 12.661 |
| Real local calculator tool loop, including cold load | 47.620 |
| Real thinking-enabled explanation after natural-text handling change | 47.958 |

The successful paper contains **17 questions, 40 attempted marks, Digestive system only**, separate answers and a question-specific revision. The original paper hash stayed unchanged. A real native calculator call succeeded. A later thinking check returned a short final explanation, actual nonempty provider thinking and no JSON repair; model loading took 44.209 seconds. These are observed cases, not a general accuracy/speed benchmark.

The first paper was withheld because a requested drawing lacked a usable worked diagram. Its evidence is retained. The successful run used the corrected visual-capability contract and repaired an overly narrow marking allowance. This controlled chapter test does not establish current official-topic completeness or teacher academic approval.

Private prompts, schemas, CLI events, timings, learning records and printable artifacts: `F:/Workspace/Support/GTOP/assistant-runtime/release-qa/harness-2026-10-28/` and `harness-2026-10-28-final/`. Private logs are not committed. Tokenizer files are on F, pinned to Qwen revision `851bf6e806efd8d0a36b00ddf55e13ccb7b8cd0a`; model storage stays on H by the owner's existing exception.

Browser interaction checks verified feedback before generation and a 390-pixel layout without document overflow. Pixel capture repeatedly timed out, including the visible path. Desktop/mobile visual acceptance, native A4/physical printing, teacher use and long-term availability remain open. No visual-design acceptance is claimed.

Protected release and installed-worker readback will be recorded below; source tests alone do not establish deployment.
