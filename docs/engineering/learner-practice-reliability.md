# Learner practice reliability — bounded increment

Impact: solo learner practice, result acknowledgement and canonical answer identity.
Discovery: hosted current Angular app, role flows, source tests, local emulators; v2 is reference only.
Delivery: isolated branch `fix/learner-practice-reliability`, draft PR for owner review. No merge/deployment or production data/rule changes.

Base: latest remote main `d363ef408efc2ce19a5df31b12e5ff96cd5f9fe0` (initial inspection `0d570b2`; subsequent paper-backend changes do not overlap). Hosted `/version.json` independently read 2026-10-04: current `gtop-app`, `f8ebf5eae1c27daa65ef11ceb2bb9d22cbf8fc98`, built 2026-09-29.
Action Plan context: V2 learner/quiz parity activities are in review; this change repairs the deployed legacy flow. Existing production execution records remain untouched as instructed.

## Implementation and acceptance

- Learner bare/direct Quick Quiz uses own board/class; custom selection stays locked. Admin selection remains flexible. Missing profiles and empty/error results are visible. Scalar query filters become arrays; Cambridge IGCSE/IGCSE aliases query existing records.
- Tab session retains attempt ID, answers, option order and cursor across reload/history. New launches after acknowledged completion create new attempts. Report retries use the solo path; live/run paths preserve canonical answer submission and Hub returns.
- Results await server acknowledgement, surface failure/retry, and reuse one immutable user/attempt ID. New records retain board and actual quick/custom/retry type. Historical records remain unchanged.
- Fisher-Yates option presentation stores display-to-canonical order. Scoring, saving, review, retries, flags and live submissions use canonical indices. All explanation paragraphs remain visible; explicit “Option A” references are relabelled. Positional/ambiguous answer references keep original order pending editorial review; no bank migration.

## Validation ledger

Implementation, independent code review and QA roles are separate. Independent source review found no remaining P1 after fixing report retries, history selection, pending-result overwrite and mutable saved answers. Precommit: aggregate module suite 18 files / 138 tests passed; production build passed with existing budget warnings; isolated emulator/browser practice suite 14/14 passed on desktop and 320px phone. QA covers missing/profile-removal/empty states, aliases, scope, reload, offline failure, acknowledged retry, simulated lost acknowledgement, duplicate ID, new retry ID/type and historical review without re-save.

Final-commit module/build, rules and combined browser checks are repeated before PR handoff; exact commands/results and Library screenshot references are in the draft PR and handoff. Screenshots are retained in workspace `qa-practice-evidence/`, not generated-source files. Central mechanical-repair guidance snapshot: plugin 0.1.0, base `ba1235fe7b220842778414f3f70fca38e7df4c53`. This is focused repair QA, not new design acceptance.

Evidence uses synthetic fixtures/emulator data and does not establish increased production usage. Remaining bounds: ambiguous positional content keeps canonical order; no editorial bank migration. Live mapping has module coverage; full timed live browser flow is outside this increment. Admin concurrent initial same-ID timestamp immutability is not established by current update-permitting rules.

Branch publication must skip push workflows because this repo auto-deploys non-main branches. PR is draft only; parent review is the next gate.
