# Sourced task briefs and conversational harness — 25 October 2026

Sachit approved improvements following online research and the recorded IB clarification loop. This changes the existing private pilot, not the local model installation or its weights. GTOP core, existing papers/data, legacy access and the stopped legacy scheduler remain outside scope.

## Evidence and intended behavior

The actual prior exchange supplied Class11 IB Mathematics, Geometry and Coordinate Geometry,60marks and all topics, but repeated the topic question and never delegated. Current input/response/schema inspection found no durable chapter-selection field, a single JSON user-message wrapper for history and a large mandatory proposal for every conversational reply.

The harness now persists a conversation-local task brief before paper creation. Established requirements carry saved user-message references and quoted evidence. Chapter selection means every topic within the named chapters, not the entire subject syllabus. Original user messages and corrections remain independently available in Codex handoffs. IB programme and level are separate genuine prerequisites; saved unqualified chapters are not relabelled as a verified DP/SL/HL syllabus.

The local model receives bounded recent turns with their original roles and the current request last. Controller facts, explicit preferences and sourced requirements are separate. Only reply/action are required; optional chapter extraction must quote a saved user message containing those names. The gateway rebuilds the brief and rejects fabricated, assistant-sourced, excluded or stale selections. Ordinary conversation remains local. No new arbitrary shell/tool surface or paid API is introduced.

The controller prevents a fulfilled chapter/topic question from reopening, distinguishes scope discussion from selection, preserves the first unfulfilled request across follow-ups, and retains a hold until a new creation request. Current job facts override fabricated starts as well as fabricated completion. The snapshot and paper validator enforce selected chapters, marks, OR handling and revision containment. Altered chapter coverage requires a new paper.

The installed Qwen3.5:4b-q4_K_M supports tools and thinking. Conversation remains non-thinking, with the documented general non-thinking sampler (temperature0.7, top-p0.8, top-k20), a700-token output ceiling and the existing8K context. This is a configuration choice, not a claim that sampling repairs missing state. Thinking-mode escalation and a general autonomous tool loop are not added without application evidence that they help.

## Research used

- [Qwen3.5-4B model card](https://huggingface.co/Qwen/Qwen3.5-4B#best-practices): supported modes, native conversation conventions, sampling and excluding thinking traces from history.
- [Qwen-Agent](https://github.com/QwenLM/Qwen-Agent): conversational history, selected tools, retrieval and local-compatible providers.
- [Agent Mini task evaluations](https://github.com/mohsinkaleem/agent-mini/blob/main/evals/README.md): author-reported36tasks×3 runs;4B improved88.0%→97.2% after harness fixes. Different hardware and a narrow task set; not GTOP acceptance.
- [Mingbird research](https://arxiv.org/html/2610.02001v1): bounded context/tool surfaces, chat/task separation, completion checks and loop detection. Single-machine and partly author-developed evaluation; no general reliability guarantee.

## Verification

Independent read-only review and local checks pass44controller regressions and40backend/domain/release regressions, plus TypeScript and backend runtime loading. Cases include the recorded IB sequence; programme then SL/HL; exact original root; exclusions; chapter titles containing “and”; chapter-bound publication; Hindi document languages and duration across clarification; questions about CBSE; pauses; and fabricated English/Hindi/Hinglish progress claims. Synthetic structural fixtures are not educational accuracy evidence.

Real inference acceptance uses a synthetic administrator and isolated in-memory gateway/storage with the installed Qwen and unchanged subscription-authenticated Codex. No acceptance records are written to production. The exact recorded IB request is replayed locally; four short English/Hindi/Hinglish/capability turns run without paper delegation. A selected-chapter paper runs generation, structural validation, independent content review and bounded correction. Private prompts, outputs, decisions and stage timings remain under `H:/GTOP-Local-AI/pilot-runtime/production/release-qa/harness-2026-10-25*/`.

The first20-mark attempt was withheld: generation returned fewer than10questions, its one repair fixed structure, and review then found incomplete topic coverage. The fixed minimum question count is now explicit before generation; this failed run is retained as fail-closed evidence. It is not counted as successful paper delivery.

### Real inference acceptance

The final synthetic-admin run delivered35questions,80attempted marks and exactly the two selected chapters, Chemical Kinetics and Amines. Generation passed structure immediately. Independent content review identified omitted topics; one content correction and a final independent review then passed, with no unresolved issues. The local model interpreted the request; **Codex generated and corrected the paper and worked answers**. The controller checked marks, chapter restriction, artifacts and publication. Teacher academic acceptance remains separate.

| Observed stage | Seconds |
| --- | ---: |
| Local interpretation of the paper request | 2.253 |
| Codex generation | 172.685 |
| Codex independent review | 31.246 |
| Codex content correction | 140.693 |
| Codex final review | 14.900 |
| Complete paper job | 360.134 |

Four warm conversational turns completed in1.574s (English greeting),1.075s (Hindi greeting),1.544s (Hinglish greeting) and2.059s (Class10 capability question). None created a paper or invoked Codex. The exact recorded IB replay took2.026s,1988prompt tokens and54output tokens; the raw model claimed delegation, while the controller correctly displayed the missing-programme question. These few observations demonstrate working guards and compact output, not universal model accuracy or a general speed benchmark.

Private final evidence: `harness-2026-10-25-final/summary.json`, per-job local input/raw response/decision/brief, Codex prompts/events/output/reviews/execution metrics, and separate `student.html`/`answers.html`. The failed first run remains in the sibling directory. No production paper or conversation was generated by these acceptance runs.

The delivered student HTML has35question blocks and zero answer blocks; the separate answer HTML has35worked-answer blocks. Both artifact SHA256 hashes are retained in `artifact-checks.json`. This verifies content separation, not native A4 pagination or physical printing.

### Protected release and live readiness

Application commit `5bf6f9ad266167b9369fec17fb0d28a985d6388c` passed [protected run40126307409](https://github.com/Wolfrine/gtop-app/actions/runs/40126307409), including Node22 checks, actual Firebase Auth/Firestore/function integration, shared permission regressions, frontend build/tests and the existing dependency/runtime gates. Backend deployment and live invited-admin/anonymous-access verification passed. Hosting was skipped because no frontend source changed. One scoped backend release was used; no GTOP core deployment or legacy scheduler operation occurred.

Before reloading the manual controller, the bounded authoritative query for queued/running/validating assistant jobs returned empty and the exact old process/config identity was checked. New process187768 loads the verified source and existing encrypted pairing, reports `harness-3`, `ready`, `modelReady:true`, and has no startup error. Readback heartbeat:24October2026,19:45:01.916UTC. Source hashes, process identity and release reference are retained privately in the production `process.json`. Scheduled jobs were not restarted or reconfigured.

The hosted entry remains [Question Papers](https://gtop-question-papers.web.app). The frontend version remains its earlier deployed commit by design; this release changes its gateway and local worker. Existing conversations can continue without rewriting historical replies or generating papers automatically. A precise IB programme/level or missing source check can still be required. Broad natural-language reliability, classroom academic acceptance and physical printing remain outside the demonstrated result; daily review continues to propose evidence-based corrections for Sachit's approval.

No UI layout is changed. This work does not establish physical printing, complete academic accuracy, Aparna acceptance or general latency. Source-backed programme availability and exact official examination patterns remain real constraints.
