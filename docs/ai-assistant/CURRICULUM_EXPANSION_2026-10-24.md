# Conversational capabilities and curriculum expansion — 24 October 2026

## Authorized change

Replace the Class 12 Chemistry-only conversational identity with the complete GTOP assistant. Support Classes 5–12 for the boards configured in GTOP, with programme-specific class ranges: CBSE and Maharashtra 5–12; ICSE 5–10; ISC 11–12; Cambridge Primary/Lower Secondary/IGCSE/AS/A Level as applicable; IB PYP/MYP/DP as applicable. This does not open the private invited-admin pilot to the public.

The local Qwen model handles conversation and proposals; the controller supplies capabilities and validates intent, scope, permissions and state. Codex creates/reviews substantial papers. Every handoff retains original requests and relevant history. No new models, paid API integration, core migration, question-bank writes or old-scheduler restart.

## GTOP MCP evidence

Read-only MCP queries inspected saved `syllabus` records and central release availability. The bounded sample contained 1,253 records across Classes 5–12. Class 5:193;6:197;7:103;8:139;9:111;10:337;11:83;12:90. These are saved documents, often duplicate chapter records, not distinct current official chapters. Class 10 includes only the first 200 CBSE records plus 93 ICSE and44 Cambridge IGCSE; CBSE was truncated, so this is not a total census. Legacy ICSE Class11 and IGCSE Class8 labels are ambiguous and are not silently migrated to another programme.

The live `curriculumReleases` query returned no releases. Separately, the committed catalogue seed has269 subject entries, none complete/approved, six with chapter content. That seed is not a live Firestore completeness measurement. The user's statement that curricula exist is supported by saved records, but universal official completeness is not established.

## Resolution and source checking

1. Resolve the selected conversation's private checked snapshot, then an approved GTOP immutable release, then its saved board/class/subject chapter list. Read only curriculum fields through scoped worker endpoints; no direct database credentials go to either model.
2. Saved lists retain record IDs and a stable chapter/scope hash. Their current academic-year completeness is explicitly unverified. Unqualified legacy rows cannot be relabelled as IB HL/SL, Cambridge code/cohort or a specified textbook edition.
3. Explicit latest/online requests launch a separately leased curriculum job. Codex native live search uses official board/publisher domains. The controller bounds sources to three, enforces HTTPS/redirect domain rules, retrieves at most12MB per source, records content hashes, and validates exact scope/year. A second Codex source review must pass before activation.
4. Missing/private/unreachable/incomplete official material or ambiguous programme/cohort yields clarification or failure, without inventing chapters or overwriting the central syllabus. A successful check creates a private conversation snapshot. Ask to create a paper afterward; a check alone does not authorize paper generation.
5. Papers retain their immutable selected snapshot. New papers and syllabus discussion use the current selection; revisions/explanations retain the relevant existing paper. A check cannot cancel an already running paper. Cancel/retry/stale-lease protections apply independently.

Try: "What all can you do?", "Create a CBSE Class 10 Science 80-mark practice paper using GTOP's saved chapters", or "Check the latest official CBSE Class 10 Science syllabus for 2026-27." For Cambridge include programme, subject code and exam year; for IB specify programme and SL/HL where applicable.

## Verification before release

Synthetic structural tests exercise every configured board/class pair, distinct scope binding, separate student/answer artifacts, existing immutable revisions, variant-bearing revisions, source bounds/redirects/year/hash proofs, missing coverage, impossible mark totals, ownership and separate research leasing. English/Hindi/Hinglish capability and negative/discussion routing cases are tested. These tests establish software behaviour, not academic quality for every subject.

Local TypeScript checks, independent-app production build, production gateway import and isolated Auth/Firestore/Functions/RTDB tests have passed. Required CI gates and representative hosted use are recorded after deployment. Native A4/PDF pagination, physical printing and teacher/classroom acceptance remain separate outstanding gates from the earlier pilot.

Private runtime logs retain exact local prompts, outputs, controller decisions, Codex handoffs/invocations/events, skills/hashes, source proofs and stage timings. Do not copy private production conversations or credentials into this public repository. See the later acceptance addendum for measured runs.


## First hosted use and bounded corrections

Main release `19d5067` passed all protected checks, gateway deployment and independent Hosting deployment in [Actions run40101667519](https://github.com/Wolfrine/gtop-app/actions/runs/40101667519). The existing conversation's exact Class10 capability question now receives a complete-service answer without delegation; local inference was7.098s. A new80-mark Class10 Science request selected16 distinct saved titles from22 live GTOP records, not the old Chemistry curriculum. Its local interpretation took7.908s. This exact subject read goes beyond the bounded MCP sample.

Live use caught a controller parsing defect: “Hindi mein samjhao” selected the Hindi subject while the already pinned Science paper continued correctly. Conversation-language clauses are now excluded from subject selection, while explicit Hindi-subject creation remains supported; a regression covers the actual request. The wrong historical assistant reply is preserved as evidence, not silently rewritten. Codex also put a prose provenance notice into the machine `scope` field; validation caught it. Output schemas now pin board/class/subject/year/scope and verified marks, duration and document languages to avoid spending a repair on copying those values.

These are application-use corrections, not another model benchmark gate. The correction release retains all required checks and updates the gateway without redeploying unchanged Hosting assets. Unknown deployment paths still retain both deployment gates. Exact hosted paper/check results and timings are appended after completion.
