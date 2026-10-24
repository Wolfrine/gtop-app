# Final independent critic verdict

**Critic pass: 8.5/10.** No current visual blocker remains in the independently inspected pilot. This is agent review, not Aparna's academic acceptance, Sachit's approval or a deployment decision.

Current candidate after the Library follow-up: `0d9c9d4a3a7bf4733b8a03c0eedf2262c3cdc9d63643c047c471f87b7d38ed22`, observed checkout HEAD `cf7b78ab78b7cd44784b1f40e0ff44c48e9a8c25`. The adjacent `../candidate-manifest.json` binds 13 actual working-tree UI source/fixture files, four dependency/build configuration files, 65 production build files (including local KaTeX font assets), 52 retained critic-operated screenshots and nine separately attributed parent-captured screenshots independently viewed by the critic. Its v2 candidate hash includes source and dependency/build configuration as well as build output. Current production bundle files are `main-NLUVOD6G.js`, `styles-7HFPSV73.css` and `polyfills-LVNOU2XZ.js`. These current files were hashed from disk; their browser loading is parent-owned release evidence. Previous Library, dependency/chat-math and pre-chat-math bindings are preserved in `../candidate-manifest-pre-library.json`, `../candidate-manifest-pre-angular21.json` and `../candidate-manifest-pre-chat-math.json`; the initial candidate manifest is also preserved. The earlier independent production sign-in inspection belongs to the pre-chat-math candidate.

| Critical dimension | Score | Evidence and judgment |
| --- | ---: | --- |
| Layout clarity | 8.5 | Desktop recent-conversation rail, dominant conversation and optional document pane follow the approved prototype. Phone has a dedicated document view and clear return action. The paper is visually distinct from workspace controls. |
| Conversation and actual progress hierarchy | 8.5 | Ready paper is the primary action; worked answers and revisions remain separate. Only the active job has recovery controls. Historical failed attempts cannot compete with the current request. Synthetic cancel/retry transitions and the real generated/revised result were inspected. |
| Responsive actions and documents | 8.5 | Desktop, tablet, 390px and narrow 320px layouts were inspected across the retained cycles. Corrected controls have usable hit areas. Actual answer equations now scroll locally with keyboard access, keeping the page within its viewport. |

Five substantive builder/critic cycles are retained under `cycle-1` through `cycle-5`. Later focused checks cover a duplicate-retry defect, real educational content and its equation overflow, safe assistant formatting and the final production authentication gate. These are concrete state/fix checks, not five repetitions of an unchanged screen.

## Real evidence and synthetic boundaries

- Synthetic fixtures are visibly labelled and used for empty, working, offline, error, long-content, revision, retry-chain and hostile-formatting states. The production `?fixture=ready` request remained at real sign-in; the fixture transport was not exposed there.
- The actual Auth/Firestore emulator conversation was also inspected read-only, using the seeded synthetic administrator identity and a paper genuinely produced by the parent's Codex workflow. Its student document contained 38 questions, four whole-question alternatives, displayed primary marks summing to 80 and no answer elements. The answers document contained 42 worked answers. Revision 2 appeared in that same conversation; the parent independently verified only question 6 changed.
- The actual wide equations revealed a defect that short fixtures had missed. After correction, phone document width/scroll width was 374/374 and tablet was 594/594. Short chemistry formulas no longer had tiny scroll tracks. A long question-34 equation could be focused and scrolled to its final terms with ArrowRight while the document stayed within the viewport. See `../actual-emulator-paper/review.md` and its retained before/after screenshots.
- Assistant formatting was independently checked: emphasis and lists render, while hostile script/image/link samples remain inert literal text; user wording stays verbatim. This fixture is layout/security evidence, not a model accuracy test.

## Static safety review closure

The parent corrected the concrete controller/domain findings reported in `../controller-static-review.md`. The critic reread those corrections; the closure and remaining bounded limitations are recorded in `../controller-static-followup.md`. No reported concrete P1 contract defect remains open in the inspected corrected source. The critic did not run additional inference or claim ownership of the parent's test suite.

## Remaining gates

- A4 CSS and the browser Print action exist, but this browser could not export or inspect paginated output. Actual A4 pagination, PDF output and physical printing remain unaccepted.
- Aparna must review academic correctness, answer quality and practical classroom suitability. DOM counts, marks validation and Codex review do not certify these.
- Production Firebase access, deployed worker availability and subscription use constraints belong to the parent's release review. This review took place on local development/static servers and emulators.
- The parent subsequently reported personally accepting final 1440px desktop and 390px phone answers/question-34 screens, with screenshots under `design/assistant-pilot/parent-qa/`. That separate checkpoint is parent-reported evidence; this critic's verdict uses the independently inspected screens above. Owner approval and the release decision remain distinct. Natural-language requirements and memory use remain bounded pilot heuristics.

Only critic evidence and review notes were written by this reviewer. No application code, stored paper, authentication data, scheduler, deployment or inference state was changed by the critic.

## Bounded chat-math follow-up

The added assistant-only KaTeX presentation was reviewed after the prior verdict, without repeating the accepted paper journey. The critic's browser surface was unavailable on this follow-up. The parent therefore operated the browser to capture the actual retained local-model Q6 explanation on desktop and 390px phone, and the labelled hostile/malformed math fixture at 1280px and 390px. The critic independently opened and visually judged all four PNGs; this is independent visual judgment of parent-captured rendered evidence, not a claim of new critic-operated browser interaction.

**Focused pass; no visual blocker identified.** Valid temperature subscripts, percentages, time units, half-life notation and arithmetic are readable within the conversation hierarchy. Phone line wrapping stays inside the visible message column and the composer remains reachable. Malformed TeX, a JavaScript `href` command and literal image markup appear as literal fallback text. Images alone do not establish inert DOM behavior; the inspected formatter escapes prose first, rejects unsafe TeX commands, uses `trust:false`, bounded expansion/output, strict parsing and escaped fallback. User messages remain interpolation-based and do not receive the assistant math directive. The parent/builder reported 12 passing UI tests and a passing production build; the critic did not rerun them.

See `../chat-math-followup.md` for exact evidence attribution and remaining limits. Prior score 8.5/10 is retained; no additional inference or app edits occurred. The A4/academic/owner gates above remain unchanged.

## Dependency security regression follow-up

**Regression pass; no new visual defect identified.** The parent supplied five fresh `parent-qa/patched-angular21-*.png` browser captures, independently opened and judged by the critic: actual retained chat at 1440×1000 and 390×844, actual worked-answers cover at 390×844, and the labelled math safety fixture at 1280×720 and 390×844. Readable valid equations, literal malformed/unsafe fallback, mobile composer, navigation and answers document presentation persist. The actual chat correctly displays an offline banner in these captures; this review does not assert worker availability or rerun an explanation. The answers cover capture is a shell/document regression check, not a repeat of the earlier long-equation interaction test.

Inspected package versions and the explicit `provideZoneChangeDetection()` bootstrap addition. The parent/builder reported Angular 21.2.25, modern CLI/build 21.2.28, KaTeX 0.19.1, TypeScript 5.9.3, zone.js 0.16.3, zero findings in both full and production audits, 12 passing UI tests and a passing build. Audit/test results remain parent-owned; the critic did not run them. Parent browser operation and critic PNG visual judgment remain separately attributed. See `../dependency-regression-followup.md`. The finite-sample, A4, academic and owner-approval limits remain unchanged.

## Invited-administrator Library follow-up

**Independent direct-browser pass, 8.5/10 across the three critical dimensions.** The critic operated its own Chrome tab on labelled development fixtures at desktop 1440×1000 and phone 390×844. Checked populated Papers/Conversations, loaded-only filters and preserved-filter paging, exhausted no-match copy, empty/error/loading, cross-admin read-only transcript/document and owner continuation. Original Class select clipping and exhausted-page hint were fixed and rechecked. Ten new critic screenshots are retained under `../library/`; viewport override and only the critic's own tab were cleaned up. No live authorization, inference or print acceptance is inferred from the fixtures.

The separate backend review found a cross-owner retry side effect before ownership checking. The parent scoped expiration by caller UID inside the transaction and added unchanged-store assertions; the critic reread the correction. No blocker remains in the inspected backend diff. See `../library/review.md` and `../library/backend-review.md` for precise boundaries and file/line evidence. Print v3 controls are retained; this follow-up adds no new print/PDF/pagination claim and does not replace the parent's separate print evidence.
