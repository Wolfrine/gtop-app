# Classroom copies and assistant follow-up — 24 October 2026

## Ordered approval

Sachit requested three stages, with the printable-copy correction deployed before conversation analysis: (1) final classroom papers without GTOP/source/official-format/process disclaimers; (2) concise friendly local conversation informed by actual MCP history and daily approval-based improvement review; (3) an admin library of papers and conversations, with summary titles after generation.

## Stage 1: final classroom documents

`6a3d40d` removes provenance notices and source footers from newly rendered student and answer copies, filters administrative sentences from examination instructions, and removes invented version/custom labels. The same shared presentation policy cleans views of existing immutable artifacts. Questions, options, attempted marks, OR alternatives, solutions and marking points are preserved. Original stored papers, curriculum snapshots and their integrity checks remain unchanged. No new educational inference was required.

Codex's versioned creation instructions now require final classroom copy and retain provenance exclusively in structured metadata. This does not label a custom paper as an official board-issued examination. Curriculum trust remains an administrator/controller concern, outside the printable document.

Local checks: 35 backend/domain tests; 26 controller tests and TypeScript; 15 presentation tests and production Angular build. Actual retained Class 5 paper: 20 questions / zero student answer blocks / 20 worked solutions. Actual Class 10 paper: 39 questions / zero student answer blocks / 43 worked solutions including OR choices. Input hashes unchanged. Rendered desktop 1440×900 and phone 390×844 checked; no phone overflow, no KaTeX errors, no provenance/process notices in either copy. Native browser A4/PDF pagination and teacher academic acceptance remain separate unverified gates.

Private actual-paper QA: `H:/GTOP-Local-AI/pilot-runtime/production/release-qa/print-ready/`. No student/admin conversation content or credentials are committed here.

Release: existing protected assistant pipeline [40112467429](https://github.com/Wolfrine/gtop-app/actions/runs/40112467429). All required verification, gateway and independent Hosting jobs passed. Hosting version readback confirms `6a3d40d4aaf320815ca71cfcac30218fb4869d95`. Manual controller process 166996 loaded this source and reports ready/modelReady; no active jobs were interrupted. GTOP core and the stopped legacy scheduler are outside this change.


## Stage 2: actual conversation review

GTOP MCP bounded reads on 24 October found seven conversations, 45 messages (22 assistant), 34 jobs (31 completed, two failed, one cancelled) and no saved feedback documents. This includes earlier synthetic acceptance requests and real admin dialogue; it is not an organic-use cohort. Median assistant length was 40 whitespace-delimited words, nine replies exceeded 40, and the longest was 202. Length alone does not judge a requested chapter list or explanation.

Observed defects included a capabilities pitch in response to “How are you doing?”, failure to answer a Class 7 subjects question, repeated requests for marks already supplied, and failure to recognize spaced ordinals such as “10 th”. A request mentioning an ICSE exam pattern and “Check online” produced a saved-curriculum paper without that online check. The existing schema cannot reproduce section-level selective-attempt patterns, so the assistant must disclose that limitation and clarify rather than claim exact board-pattern compliance.

Corrections are scoped to local dialogue and controller primitives: concise versioned conversation instructions, specific catalogue-backed capability answers, short friendly social replies, one missing-detail question, preserved explicit marks/grades and explicit online-check routing. Detailed educational explanations and expressly requested lists are not blindly truncated. Original messages and controller permission/status guarantees are preserved. This is harness/prompt improvement, not model-weight training.

A thread heartbeat, `gtop-assistant-daily-review`, runs daily at 21:00 IST. It reads bounded new MCP evidence, distinguishes acceptance runs from real admin usage, reports a concise summary and correction proposal, and asks Sachit to confirm. It is explicitly read-only and cannot grant itself code/prompt changes, data writes, inference experiments, deployment or scheduler changes.

## Stage 3: saved work and titles

The invited-admin library reads this assistant's paper/conversation collections across creators, with creator attribution, board/class/subject filters and text search. It does not migrate legacy paper-module data. Reads are paged by document ID (50 items), and filters apply to loaded pages with an explicit Load more disclosure. Papers and separate answer copies are retrieved from verified saved artifacts; opening a saved item never regenerates it. This supports reuse; it is not a global automatic duplicate-content detector.

Cross-creator conversation views are read-only. Existing owner mutation routes retain ownership checks. Anonymous, learner, worker and non-invited access remain denied. The worker receives no new cross-admin transcript tool, and no browser direct Firestore access is granted. Summary projections exclude question content, leases, prompts, memory and credentials.

On successful paper publication, the controller records a compact title from the validated Codex-generated paper scope and marks, such as “ICSE Class 10 Mathematics · 80 marks”. No extra cloud inference is used solely to name a conversation. Existing conversation/library views derive the same kind of title from saved paper metadata, without rewriting transcripts or migrating stored papers.

Final local verification: 38 backend/domain tests; 35 controller tests and TypeScript; 18 frontend tests and production build; two actual Firebase Auth/Firestore/function emulator tests, including real 53-item paging and expired-job cross-owner mutation containment. The independent reviewer found that an owner check originally followed job expiration in retry handling; expiration now checks ownership inside its transaction before any write. Snapshot assertions prove that cross-admin retry/admin reads leave an expired job unchanged, while owner retry succeeds.

The accepted chat shell was extended without a redesign. Independent direct-browser desktop 1440×1000/phone 390×844 review passed populated, search/no-match, pagination, exhausted, loading/error/empty, cross-admin transcript/artifact and owner continuation states using explicitly synthetic fixtures. Two minor findings (clipped Class default and a no-more-pages hint) were corrected and rechecked. The parent inspected the running desktop view and actual phone captures. This is agent-reviewed UI evidence, not Aparna acceptance. See `design/assistant-pilot/critic/library/review.md` and its bound source manifest; no new native-print or academic acceptance is implied.

Live delivery/readback of this combined conversation/library candidate follows its required protected release checks. The first print correction was already deployed independently as requested. Neither release promotes GTOP core or restarts the legacy creator.
