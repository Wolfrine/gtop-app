# GT Papers compact workspace pass · 25 October 2026

Status: **agent-reviewed**. Owner rejected the prior UI as cluttered, with oversized chat text and unnecessary whitespace. Designer, independent critic and parent completed the five-cycle process below; this record does not claim renewed owner acceptance.

Source: main `f736109`. Central plugin 0.1.0, pinned source `ba1235fe`; designer and critic loaded the matching role guides. Separate roles: `ui_designer` builds; `ui_density_critic` judges; parent `/root` owns QA, release and final judgment. Model capability is inherited; the builder cannot select or claim a stronger model pass.

## Brief and pass conditions

Aparna should follow a paper conversation, understand the real current state, open separate questions/answers, and request revisions. Preserve all permission checks, admin library access, math rendering, revision history, failure/retry controls and document printing. No changes to controller, data, model, core GTOP or the stopped scheduler.

The intended eye path is current conversation → latest response/status → paper action → composer. First-glance hypotheses (not measured attention): a conversation is the dominant object at 100 ms; topic and state are clear at 1 second; opening the paper or replying is apparent at 5 seconds.

Critical dimensions, declared before scoring:

1. **Task hierarchy:** conversation, actual state and one primary paper action dominate. Repeated guidance and secondary feedback/history are quiet or disclosed. No decorative hero in a working conversation.
2. **Readable density:** desktop chat 14–15 px, phone 15 px, line-height about 1.6; metadata 12–13 px. Shell and rows are compact without hiding controls. Typography carries meaning rather than shrinking everything.
3. **Responsive usability:** 320/390 phone, 820 tablet, 1440 desktop; no viewport horizontal overflow, 44 px interactive targets, usable drawer and documents, long messages and formula overflow contained.

Required states: ready paper, working, offline/queued, failed/retry, empty, clarification, long/Hindi/math, revision history, library, cross-owner read-only, document and sign-in. Desktop/mobile are required; parent checks cycle 3, cycle 5 and final evidence.

## References actually viewed

- Current `?fixture=ready`, baseline desktop 1440×900 and phone 390×844 retained here. The baseline uses a 76 px app header plus 102 px conversation header, 16 px/1.85 chat text, repeated status/review captions, large result box and an oversized empty state.
- Official Linear redesign screenshot (`pilot-runtime/.../references/linear-inbox.png`): quiet navigation, aligned compact rows and a clear active content plane. Do not copy the dark/angled marketing crop.
- Actual Claude document split (`pilot-runtime/.../references/claude-document-split.png`): chat and printable document are separate working surfaces, with a compact context bar and a single composer. Do not copy oversized serif typography or verbose content.
- Committed `docs/ai-assistant/prototypes/gtop-question-papers-multidevice.webp`: distinguish questions and answers, direct paper workflow. Do not treat concept status checks as real execution or copy decorative room imagery.

M3 prereview from critic: separate body/title roles; no display typography in chat. Keep familiar navigation, meaningful state colors and practical tap targets. Remove duplicate shell/guidance. A passing build does not establish visual quality.

## Direction studies

Local-only HTML/image artifacts under `candidates/`; not a production selector. Same explicitly synthetic working-paper content at desktop 1440×900 and phone 390×844. Temporary mark is labelled provisional.

- **A, focused thread:** quiet left navigation; compact context; conversational thread with inline paper artifact and composer. Current workflow familiarity with substantially reduced chrome.
- **B, document studio:** top navigation replaces sidebar; equal conversation/document areas show output continuously. Strong document work, less space for long chat and different navigation model.
- **C, task desk:** dark compact index; conversation in the middle; persistent task brief and artifact inspector on the right. Strong scope visibility, more competing information planes.

Independent selection and implementation cycle evidence follow below. Candidate HTML and screenshots are design references, not functional acceptance or educational papers.

Critic selected A as the composition foundation, with C's 16 px phone gutters. A preserves the chat-first purpose without a permanent third inspector; B is useful only after explicitly opening a document. Provisional direction scores (hierarchy/density/responsive): A 8/7.5/7.5; B 7/8/7.5; C 7.5/8/8. These are direction selection, not final acceptance.

Capture provenance: initial builder baseline and direction-study PNGs were produced through Playwright/installed Chrome after CUA inventory timed out. Parent instructed CUA-only thereafter; direct `cua.createBrowserTab` worked. Subsequent actual-app visual reviews use CUA and state their method. The critic independently captured the baseline in CUA. No external Playwright browser control is used after this correction.

## Implementation cycles

### Round 1 · Working conversation foundation

Implemented A with 60 px shared header, 64 px desktop context bar, 14.5 px/1.6 desktop and 15 px/1.6 phone conversation text, quiet navigation, smaller paper artifact, disclosed feedback, compact composer, and the real generated app mark. The existing verbose synthetic ready reply was preserved, so the density comparison is not achieved by replacing content with shorter copy.

Builder inspected actual desktop 1440×900 and phone 390×844 in CUA. Evidence in `cycle-1/`; critic independently captured ready 1440/390/320, working phone, document 320 and revision return in `critic/round-1/`.

Critic: hierarchy 8, density 7.5, responsive 8; not accepted. Main defect was a roughly 247 px phone result card: long revision label wrapped into another 44 px row and duplicated review/printing instructions consumed space. Desktop prose also needed a reading measure limit. Practical document/header actions were 44 px and no viewport horizontal overflow was seen. Parent's initial QA view agreed the shell and hierarchy improved; QA does not change visual scores.

### Round 2 · Result action economy

Replaced visible long action labels with **Answers** and **Revise**, retaining descriptive accessible labels. Removed the result divider and repeated printing directions, with one concise review helper. Desktop prose is capped at 80 ch while artifact and composer share their wider alignment. Added a clearly synthetic Hindi/Hinglish fixture, and made dev fixtures consistently represent an administrator with library access. Production dev-transport replacement remains intact.

Builder CUA phone check confirms paper questions/answers/revision fit one action row at 390 px, above the composer. Critic CUA measured the phone artifact at 169.8 px, down from approximately 247 px; all three actions fit one 44 px row at 320 and 390. Empty 320/1440 states remained clear. Chat hierarchy/density reached 8.2/8.2, but library responsive score remained 7.5 because the three phone selects visibly clipped their values and consumed too much initial scan space. Parent viewed the compact working conversation at 1280×720 and agreed the shell/action hierarchy improved. Presentation unit tests: 18 passed, no failures (Node 24).

### Round 3 · Useful phone library

Replaced the cramped three-select phone row with search plus a Filters disclosure. Expanded filters use two equal columns for board/class and full width for subject. The active count and full selected scope remain visible after closing it. Desktop controls stay visible. Loaded-result guidance is concise and still distinguishes loaded results from the whole library.

Critic CUA checked expanded selects at 320, applied ICSE/Class 5/Mathematics, collapsed with all three selections visible in the summary, and cleared back to three loaded results. First result moved from approximately y=463 to y=395 at 320. Phone 390 action layout fits. Provisional library hierarchy/density/responsive: 8.2 each. Contrast remained a blocker in small secondary text (pilot note 3.51:1 and composer caption 3.77:1), to address in round 4. Parent checkpoint 3 is tracked separately by the lead; this record does not invent it.

Parent checkpoint 3 completed: lead personally inspected actual CUA phone images at 320 (active/expanded scopes) and 390 (cleared filters), plus own desktop library interaction at 1280. Provisional parent scores: hierarchy 8.2, density 8.0, responsive 8.2. Selected scope remained visible and controls legible. Parent requested contrast repair without shrinking type.

### Round 4 · Quiet readable text and truthful waiting

Darkened low-contrast secondary text and placeholders to a consistent quiet `#5d7059`, with a computed 4.72:1 ratio on the tinted user surface `#edf2ed` and higher contrast on the main surface. No font enlargement, new information panel or emphasis was added. Borders and meaningful state colors remain separate.

Corrected pending local-reply wording: the user can draft a next message while the send button waits for the current reply. A paper job still correctly says conversation may continue. The controller's states and permissions are unchanged. New `?fixture=replying` is explicitly synthetic and exercises the existing pending-turn state.

Production Angular build passed (Node 24): initial 776.04 kB, estimated transfer 187.34 kB. Independent actual contrast/state review and parent QA follow; computed colors alone do not establish acceptance.

Critic round 4 inspected actual CUA surfaces: pilot/caption 5.196:1, user byline 4.717:1, ready-card metadata/helper 4.866:1, Your paper badge 4.730:1 and library scope/metadata 5.196:1. Compact type was preserved. At 320, the pending-reply state allowed drafting while send stayed disabled after typing, and the copy explained it. PWA help remained contained at 320/390 with a 44 px close target. Provisional hierarchy/density/responsive: 8.3 each, no new visual blocker.

### Round 5 · App integration and final working states

Made the header avatar a signed-in identity indicator rather than a surprising one-click sign-out action. Explicit **Sign out** remains in the rail/drawer. Parent agreed this correction. Reduced-motion preference now makes the decorative loader static; status text remains available. Hindi/Hinglish fixture header now matches its synthetic Class 10 Mathematics conversation.

Parent owns the generated raster mark, manifest, service worker/cache policy, installation/update component, PWA tests, release and QA. Builder integrated the standalone component and service-worker provider. No controller, Firebase permissions, live conversations, generated papers or scheduled jobs were changed in this UI lane.

Final source freeze declared after these changes. Node 24 presentation tests passed 18/18. Production Angular build passed: initial 776.33 kB, estimated transfer 187.33 kB. Critic and parent final state verdicts follow separately; tests do not self-approve the design.

Round 5 target correction: critic measured the brand anchor at 33.19 px high and the phone textarea at 43 px. Both now have a 44 px minimum target while the artwork size stays unchanged. Removed the repeated Growth Tutorials footer stamp after the actual desktop document-split image showed it and Sign out wrapping in the narrower rail; the explicit Sign out control now stays on one line. Final renders must include this patch.

Builder personally inspected critic CUA images of the 1440 document split, 390 feedback form and drawer. They show distinct document/chat surfaces, reachable paper/answer controls and disclosed secondary actions. These are synthetic UI fixtures, not newly generated or educationally validated papers.

Final recovery check found one contradictory library error state: a failed-load panel still displayed the “Loading saved items…” helper. The helper is now hidden on error, and unloaded text uses the actual loading flag. Critic is rechecking the affected 320 px error state. Brand link is confirmed 44 px high and textarea at least 44 px; math at 320 has no document/body overflow. PWA help Escape now returns focus to Install after the parent's focused correction.

The final 320×760 email sign-in check exposed an overflow defect: vertical flex centering positioned the tall card above the scroll container, clipping its top behind the header. Corrected cross-axis alignment to start with automatic block margins on the card. Short cards keep centered positive margins; tall cards start at normal padding and can scroll through their complete content. This is an observed state repair, not a new visual direction. Critic rechecks tall phone and short desktop states before acceptance.

## Final independent gate and handoff

Critic final verdict: hierarchy **8.4**, readable density **8.4**, responsive usability **8.5**, overall **8.4**. No unresolved visual blocker. Final source/evidence binding is `critic/round-5/candidate-manifest.json`; do not change the bound app files without rechecking the affected state.

The corrected 320 px email card begins at y=82 inside the container beginning at y=58, and its bottom is reachable at scrollTop 117. Short desktop sign-in remains centered. Failed library loading no longer claims an operation is still running. Final ready evidence is at 1440×900 and 390×844. Brand and composer targets are at least 44 px. Critic verified drawer focus wrap/inert/Escape, feedback, immutable earlier-revision navigation, student/answer document split, failure/retry/cancel/offline, and 320 px math containment. Hindi/Hinglish and long tablet content were inspected in round 3.

Parent checkpoint 5/final: lead personally interacted with actual Chrome-rendered ready states at 1440×900 and 390×844, opened phone student → answers → back, and reached every paper action. Parent scores: hierarchy **8.4**, density **8.3**, responsive **8.3**. No aesthetic blocker; phone chat is 15 px, paper actions fit one 44 px row, and there is no viewport overflow. Separate parent QA also covers production PWA runtime and release; those operational claims belong in the parent's QA record.

The builder leaves the dev server running at `http://127.0.0.1:4317/` for release QA. Its fixtures are localhost-only and replaced from production. No builder commit, push or deployment was performed. Parent owns final exact-source checks, deployment and live validation. Real-device installation, keyboard behavior and owner approval remain distinct from browser-size checks and agent review.
