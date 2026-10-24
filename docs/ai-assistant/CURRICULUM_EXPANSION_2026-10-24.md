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


## Representative hosted acceptance

The Class10 Science paper published privately after generation160.885s, one machine-scope correction121.988s and independent content review17.485s; total job318.394s. It has39 numbered questions,80 attempted marks,16 saved chapter titles and four whole-question OR choices. Review returned pass with no material issues. In the actual rendered student copy,39 questions/0 answer blocks; separate worked answers39 questions/43 solutions/20 objective keys; no KaTeX errors. Desktop1440×900 and phone390×844 were visually inspected. The renderer supplies the real revision even where model prose invents a version label. Teacher acceptance and native print pagination are still unverified.

The first online check safely returned unavailable because the adapter disabled Codex's Code Mode dispatcher. Research now enables that dispatcher only for live research; shell, apps, plugins, browser/computer and hooks remain disabled, with the read-only sandbox and filtered child environment preserved. The CLI's native web-search allowed-domain configuration is explicitly set to the selected board's official domains. See [official Codex web-search guidance](https://learn.chatgpt.com/docs/web-search) and the inspected [Codex tool plan](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/core/src/tools/spec_plan.rs).

The repaired real check took71.022s and emitted six completed web-search events, reading current CBSE and NCERT sources. It returned an incomplete result because detailed units and the Note for Teachers conflict over assessable Heredity/current-effects coverage. Independent inspection confirmed the conflicting passages in the [official2026–27Science PDF](https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart1/Science_SecP1_2026-27.pdf), PDF pages5–6. This is a source ambiguity, not a verified complete replacement syllabus. **No conversation curriculum was activated and the existing paper was preserved.** Positive activation/ownership/hash guards are covered by synthetic service tests; this live case does not establish successful complete activation.

Incomplete-result replies now include bounded provisional chapters, allowlisted official source URLs and limitations, clearly saying the selection and papers are unchanged. This prevents “chapters below” prose with no actual findings displayed. No extra research inference is needed to unit-test that presentation.

The parser correction release [ba306c6](https://github.com/Wolfrine/gtop-app/commit/ba306c660ad3dde064e69b2508f9518481ae91f8) passed all required gates and deployed the gateway only in [run40102638820](https://github.com/Wolfrine/gtop-app/actions/runs/40102638820); Hosting was explicitly skipped. The dispatcher/feedback change is controller-only and requires verification, without another cloud deployment.


## Class5, revision and closeout evidence

A real CBSE Class5 **Science New NCERT** saved-subject request selected10 chapters,40 marks,60 minutes, English questions/answers and no internal choices. Codex delivered20 age-appropriate questions, all10 chapters and40 attempted marks. Generation124.051s; one source-title-length repair61.817s; independent review12.370s; total215.799s. The controller rejected a reference title over300 characters; the output contract now supplies the short pinned source title exactly, avoiding this copy-only repair. The source identifier/URL and validation remain enforced.

A subsequent Class10 targeted revision took20.293s for generation and15.428s for review,52.027s total including gateway steps. The published result changed onlyQ6:38 other questions, question count and all paper metadata remained identical. The existing student and answer documents are retained as Revision1; the new documents are Revision2. The repeated actual Hinglish request now preserves Science in both controller scope and the displayed chapter list; local inference12.266s, no new Codex task.

All papers were generated by Codex, following the local model's interpretation plus verbatim originals/history and controller-verified requirements. The local model provided conversation and clarification. The controller selected/pinned curriculum, validated structure and containment, tracked real state and delivered private artifacts. These are actual production-identity application runs, not mocked model responses. The general board/class matrix and positive checked-curriculum activation tests remain explicitly synthetic structural evidence.

Final verification:34 backend/domain/release tests,26 controller tests and TypeScript,14 UI tests/production build, isolated Firebase integration and shared-rule regression checks. [Controller release05e3d3f](https://github.com/Wolfrine/gtop-app/actions/runs/40103379403) passed every required gate and skipped both backend and Hosting. The source-title contract follow-up receives the same checks and no cloud deployment.

Cloud deployment count for this expansion: one initial gateway+independent-Hosting release, then one gateway-only correction. Later controller changes skip both cloud targets. GTOP core, legacy data/access, invitation boundaries and the stopped old scheduler were not changed. No credentials/API billing or startup service was added. The manual controller retains prompts/events/results and source hashes privately on H:.

Remaining acceptance: teacher/classroom correctness for each requested curriculum, complete coverage for missing/ambiguous programmes and editions, complete official snapshot activation in a real unambiguous source case, native A4/PDF pagination and physical printing. Intermittent gateway connection timeouts were observed; Reconnect restored the durable conversation without repeating inference or losing the published papers. These observations remain release limitations, not successful latency/print/coverage acceptance. The board/class/subject paper-library dashboard remains deferred until the base pilot is accepted.


## Final verified state

[Run40104068389](https://github.com/Wolfrine/gtop-app/actions/runs/40104068389) passed the complete required checks for controller/source-contract commit `dcb6f960a5b78794c9cb76d1d2b20f7c69d70575`; backend and Hosting were both skipped. Manual controller process156540 loaded that clean source. Live worker readback at14:53:26UTC was `ready`, `modelReady:true`; private process/source-hash records are in `H:/GTOP-Local-AI/pilot-runtime/production/`.

Final rendered Class5 checks: student20 questions/0 answers; answer copy20 questions/20 solutions/10 objective keys; no KaTeX errors. Both desktop and phone were inspected and the phone document had no horizontal overflow. Class5 local interpretation8.927s; Class10 revision interpretation7.500s. Class10's earlier Revision1 remains accessible from the published Revision2 conversation. Screenshots and the explicit38-question containment comparison are retained in the private `release-qa/` folder. The temporary loopback preview from this turn was stopped; the existing local tools, manual production controller and stopped legacy scheduler were preserved.

These facts close the requested software expansion and representative application checks. The broader pilot remains in progress for the listed native-print and teacher acceptance gates; source conflicts and missing coverage remain visible, not approved by a model claim.
