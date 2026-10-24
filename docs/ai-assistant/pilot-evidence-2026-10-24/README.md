# Actual pilot integration evidence

This is an application integration run with a **synthetic emulator administrator**, real local Qwen inference and real subscription-authenticated Codex CLI. It is not Aparna's conversation or academic acceptance. Static UI fixtures live separately under `design/assistant-pilot/`.

| Stage | Model / responsibility | Measured time |
|---|---|---:|
| Initial Hinglish paper request | Qwen3.5 4B, local interpretation |25.183s (10.562s model load)|
| Conversation during generation | Qwen3.5 4B, local reply |11.405s (warm)|
| Complete paper | Codex gpt-6.1-sol, actual content generation |327.586s|
| Independent paper review | New Codex invocation, separate review prompt |24.536s|
| Explicit recovery | Controller reused the reviewed retained result |0.696s worker processing|
| Q6 revision request | Qwen3.5 4B, local interpretation |17.429s (7.554s context reload)|
| Q6 replacement | Codex gpt-6.1-sol, actual revised content |33.466s|
| Independent revision review | New Codex invocation |16.998s|

Times include model calls/CLI startup as recorded, not the entire user wait or later engineering repair. The warm conversation was slower than earlier small synthetic replies; this is the measured application result. Matching model warm-up to8K context avoids the observed4K→8K reload in subsequent startup code; that improvement is not represented as an already measured speedup here.

Read each numbered directory's `local-input.json` or `generation/prompt.txt` for the actual prompt. Local raw output and `controller-decision.json` distinguish model interpretation from the controller's decision. `handoff.json` preserves verbatim originals/history and verified facts; CLI `schema.json`, `events.json`, `execution.json` and `result.json` show invocation, real completion, model/token accounting and output. `skill.json`, where present, hashes the versioned instruction used. The first generation preceded separate skill-file extraction; its exact prompt remains retained. No API keys, worker pairing secret or live authentication tokens are included.

Codex generated the paper and revised question; **the local model did not generate these papers**. It proposed/clarified actions, and the controller delegated using original intent and verified requirements. The completed paper contains38 numbered questions,80 attempted marks, all ten pinned chapters and four OR alternatives (21,28,33,35). OR alternatives are counted once. Paper and answer documents are separate. Independent model review passed; all outputs remain teacher-review drafts.

Observed failures and fixes:

- The local continuity reply offered to start a paper that was already running. Its historical raw reply is retained. Controller grounding/current-state tools now prevent that contradiction; a model reply alone never changes a job state.
- For the explicit Q6 revision, the local model proposed clarification. The controller recognized the explicit authorized edit and delegated, preserving original text. This demonstrates the harness's role and the model's remaining limitation; it is not an accuracy benchmark.
- Math-heavy rendered answers exceeded the initial850KB raw artifact allowance. Publication failed. Artifacts now use private gzip storage with raw-size/SHA verification. The reviewed result was recovered rather than regenerated.
- During development, a worker replacement interrupted the first retry before a retained result was delivered. The lease expired and UI exposed retry. Earlier failure-report shape and duplicate retry-card defects were fixed. Only the current task is actionable.
- Actual chemical equations overflowed phone/tablet answers although synthetic fixtures fit. Versioned presentation CSS contains each wide formula; short formulas remain normal. Source questions, stored HTML and integrity hashes are preserved.

The subsequent Q6 paper passed controller containment: every other question, section and paper setting stayed equal to the base. The first version's content hash is `2c2cd9a1db0475a91a4832e4eb2309619c62fa3279bfd5e24f2da228228879bb`; the revised hash is `b4a516f4a34a9db96029ac6ee30c31bd7017714ab4112c936ad1fb8ad4246cd9`. A separate deterministic comparison is retained in `independent-containment-check.json`.

Files were copied from private runtime evidence using an explicit allowlist. Incomplete interrupted retry input is not counted as another completed generation. Hash manifest accompanies the retained files. Production deployment, actual account login and printing acceptance are reported in the release record, independently of these emulator results.
