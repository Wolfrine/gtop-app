# Raw Note - 2026-10-04 - Returning Admin Paper Journey

## Source

Founder correction in ChatGPT Work on 2026-10-04, captured from the orchestrator's bounded product-memory evidence packet. This note records the correction and the design-review position at the time of curation preparation. The curator did not inspect the application, design candidates, or release evidence.

## Context

The existing conversational paper workflow did not settle the complete admin journey. The founder rejected an ever-growing dropdown and vague discovery of paper requirements. A usable first request is insufficient if returning admins cannot find, understand and continue the work later. The expected experience is simple on phones and remains useful after years and thousands of papers.

## Key Points

- Review the whole admin lifecycle: requirements, request submission, scheduled waiting, generation, clarification, completed output, revision, cancellation and later retrieval. A small recent-history demonstration does not establish that the experience will work at realistic volume.
- Stable paper identity should connect requirements, progress, clarification and outputs. Submitting a request must leave a discoverable record and status, including when generation will wait for a scheduled run.
- Revision must preserve access to the last completed paper and answer key while new work is pending. A changed request must not make a previously useful result disappear.
- Mobile-first simplicity includes clear requirement discovery and a comprehensible next action. Shorter labels or moving complexity into a conversation alone do not establish simplicity.
- The founder explicitly expects effective Angular and Firestore persistent-cache reads and writes. This is an engineering requirement for implementation and validation outside the wiki; its product purpose is dependable saved work and responsive return visits.
- Service wording must describe current facts: every admin has access; creator attribution is immutable and is not an assignable owner; notifications are in-app with opt-in push; outputs are HTML with browser Print / Save as PDF. Do not imply private ownership, guaranteed push delivery, or a native PDF-generation capability.

## Decisions And Review Boundaries

- The founder required a fresh independent design agent with no existing UI, code, screenshots or parent design proposals. The parent remains the orchestrator. This is an explicit requirement for this design exercise, not evidence that any proposed screen is accepted.
- Independent work produced three materially different neutral candidates. A fresh isolated comparison selected a stable paper register as a credible direction. The original independent proposal is frozen as the comparison reference.
- At this snapshot, separate implementation, independent visual criticism and functional QA are ongoing. No final design acceptance or production release has been established by this source.
- The established chat-paper policy remains: reuse suitable bank questions before generating gaps, no manual question-approval gate for chat papers, and preserve independent curriculum and learner-bank trust.

## Open Questions

- Does the delivered experience let a returning admin find the intended old paper, understand what is happening and continue correctly on a phone at realistic history volume?
- Does the revised journey reduce admin effort in actual use? Candidate selection and technical checks alone cannot establish this outcome.

## Suggested Wiki Integration

Strengthen the existing One Admin Journey section in Question Bank Quality; preserve the returning-admin problem in Problems and the complete-journey quality rule in Decisions. No new concept page is needed. Keep independent-agent choreography, cache implementation, review evidence and release state outside the product wiki.

## Execution Handoff

Action Plan `yqPTIZkZPfkCQn3507cc` is the active execution record. The orchestrator owns implementation coordination, independent review, functional and cross-device validation, final factual updates and release. This raw note does not duplicate that plan or claim its completion.

## 2026-10-05 Addendum - Backend Delivery Verified; Interface Release Pending

Source: the orchestrator's verified release packet and `real-paper-recovery-verified.json`, observed at 10:40 UTC. This addendum preserves the earlier snapshot above. The curator checked the supplied evidence packet; it is not a separate live application audit.

- The original independent design work remained isolated. The implemented journey completed five actual design-review cycles and separate visual and functional review. Agent review does not establish founder acceptance or reduced admin effort.
- The redesign and subsequent release corrections reached main through [PR 59](https://github.com/Wolfrine/gtop-app/pull/59), [PR 60](https://github.com/Wolfrine/gtop-app/pull/60) and [PR 61](https://github.com/Wolfrine/gtop-app/pull/61), at commit `7ba53cadf3c4b04841bae6e3a31cbbc85333b533`. The protected backend job in [run 37297155103](https://github.com/Wolfrine/gtop-app/actions/runs/37297155103) succeeded, including index, function, historical-register readiness and live access checks.
- The existing Class 12 CBSE Physics request `becfb9b1-a699-4ba7-992d-511bae2750c8` and its conversation were verified completed; paper `chat-becfb9b1-r1` was ready. Its original requirement, 33 questions, 70 marks and first revision were preserved. The paper and separate answer-key artifact bytes were unchanged.
- The service created the delivery reply and requesting-admin notification, and the paper register reflected completion. No manual completed-status write or question edit was used to manufacture delivery; earlier failure history remained available.
- Interface hosting was still pending at this observation. Successful backend delivery does not establish that the redesigned interface is live. Production hosting verification remains with the orchestrator in Action Plan `yqPTIZkZPfkCQn3507cc`; detailed engineering evidence remains outside the product wiki.

The durable product requirement remains a complete, discoverable returning-admin journey. Actual admin feedback and observed use are still needed to establish ease of use and workload reduction.

## 2026-10-05 Addendum - Production Interface Available; Investigation Continues

The orchestrator reported that release `7ba53cadf3c4b04841bae6e3a31cbbc85333b533` reached production hosting at 10:46:18 UTC and was verified at the live origin at 10:46:24 UTC. All four jobs in [run 37297155103](https://github.com/Wolfrine/gtop-app/actions/runs/37297155103) completed successfully, including the final shared-backend checks. This supersedes the hosting-pending state only from that observation onward; the earlier dated observations remain intact.

The browser run recorded 89 first-pass tests, one retry-pass and six intentional skips. A repeated archive initial-search race remains under independent QA and implementation investigation. Successful deployment therefore does not close that investigation. The previously verified real Physics-paper delivery and unchanged paper/answer-key content remain established facts.

The redesigned interface is deployed, not founder-accepted. No measured reduction in admin workload is established. Remaining investigation and release closeout stay with the orchestrator in Action Plan `yqPTIZkZPfkCQn3507cc`, outside the durable product wiki.

## 2026-10-05 Addendum - Archive Diagnosis Resolved; Test Correction Published

The orchestrator's code review and controlled local-Firestore reproduction resolved the archive-search diagnosis. Saved requirements remain immediately accessible through their canonical record, and the unsearched register remains live. Search is a one-shot, eventually consistent view: a just-written record can be absent before its searchable projection is ready and appear after a new search. Clearing search restores the live view. The controlled reproduction returned zero results before projection and one afterward with the same canonical data; attributing the exact CI failure to that timing remains an inference because its logs omit record IDs.

Independent QA recommended a fixture-readiness correction without a production-behavior change. The seven-line correction waits for the exact searchable record and ready paper family, retains the original UI assertion and performs no derived-data writes. It was published in [PR 62](https://github.com/Wolfrine/gtop-app/pull/62), commit `9800b650038282cb55ede1d5498b8aa85515b289`. At this observation, [CI run 37299833468](https://github.com/Wolfrine/gtop-app/actions/runs/37299833468) had passed the mandatory production build, backend, module and rules checks; its browser first-attempt result was still pending.

The fully verified production interface and real Physics-paper delivery at release `7ba53cadf3c4b04841bae6e3a31cbbc85333b533` remain established. The fixture correction does not change application or runtime behavior. Subsequent CI and merge execution state remains in Action Plan `yqPTIZkZPfkCQn3507cc`, rather than requiring repeated product-memory updates. Founder acceptance and reduced admin effort remain unmeasured.
