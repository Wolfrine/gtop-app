# Clean independent direction selection

- Reviewer: `/root/blind_direction_selector`, independent visual critic.
- Model capability: inherited parent model and reasoning configuration; exact model identifier was not exposed to this reviewer. Visual inspection used the image-viewing tool directly.
- Guidance: Central 0.1.0 Visual Design Director and critic guide; release base `ba1235fe7b220842778414f3f70fca38e7df4c53`.
- Scope: neutral brief and the ten images below only. No existing app/repository, proposal, HTML source, other agent recommendation, non-neutral render or detail image inspected.
- Decision: **C > B > A. Choose C as a credible exploratory foundation.**
- Implementation status: **unverified**. This selects a direction; it is not production, functional, agent-reviewed or owner acceptance. Every below-8 critical dimension remains an acceptance blocker. No new review was performed when retaining this record.

## Personally viewed evidence

All paths are relative to `/workspace/scratch/0a41fddf9e8a/independent-paper-design/`. SHA256 values were recorded after the completed visual review.

| Image | SHA256 |
|---|---|
| renders/neutral-A-desktop.png | 98ecf70258c2a6a358b8cba65f689495da5277409f44e05daa416f8cfb5ecd1a |
| renders/neutral-A-mobile.png | be219a580bd4bed84efe72fdcaa129747c8f4a32d1c606fb87df4b7f432759d1 |
| renders/neutral-B-desktop.png | 9561a6ad83bc62ee7e0a10b6db6b39c1ff676d4085c1c01e581a284e841b1665 |
| renders/neutral-B-mobile.png | 2b039d3842aef4cdaf921f3de4882ee3b8e00a773684417651e4efaf9c6b3b72 |
| renders/neutral-C-desktop.png | b0cdba55da941e3d41c98da5f0fb16178d7ed3b5dad8086014c70d4f8738b3e5 |
| renders/neutral-C-mobile.png | 8437ba723ef6d4229948c77e16f9995542dd139da9e94c7d0ad1efe38bb726ba |
| references/linear-inbox.png | 2af0ef9c8493bef7b3b34fb285de31c259f9cca4bf0f6fa0f56319b6f4a955bf |
| references/intercom-inbox.webp | 43e054f258f90f1cd35d651e6529575a18822c8c971c8f681a68f47d10d63398 |
| references/intercom-shared-ticket.webp | 30980572dd79358302f1608b335d490c92c0d5eed012d900c2261de48d38c224 |
| references/google-drive-filters.png | cb92193c08b8981c94f47c0580b05b469899c2fed63baefd39e19e4b4fc4fd7f |

## Predeclared critical dimensions and original scores

Pass conditions were declared before viewing candidates. Scores judge direction evidence, not implementation behavior.

| Dimension | Observable pass condition | A | B | C |
|---|---|---:|---:|---:|
| Urgent phone action | Clarification and next action legible without hunting | 6 | 7 | 6 |
| Asynchronous truth | Queued/running/needs-input/completed and next run understandable | 7 | 7 | 8 |
| Durable identity/retrieval | Distinct paper identity and credible search/filter route at scale | 4 | 6 | 8 |
| Requirements/conversation/output relationship | Clear context and separate paper/key access | 7 | 6 | 6 |
| Mobile hierarchy/density | Useful scanning and actionable controls preserved | 6 | 6 | 7 |
| Revision continuity | Completed output identity stays stable and revision relationship is visible | 5 | 5 | 6 |
| Overall direction judgment | Holistic judgment, not an arithmetic acceptance gate | 6 | 6.5 | 7.5 |

## Evidence-based findings

**C:** Persistent register, IDs, chapter search, filters, owner, deadline and state columns best support both immediate work and years of retrieval. Explicit next-run banner and deadline-at-risk label expose consequences. “Revision 2 queued / Version 1 ready” expresses the appropriate relationship. Desktop clarification is prominent without making every record a workflow lane. Mobile omits the actual question, leaving “Reply →”; Ready disappears without visible overflow navigation. Tall mobile cards weaken scanning. Retain register composition and restrained status colors; refine mobile action content, density and navigation.

**B:** Needs-action priority and owner/deadline metadata support shared operations. Four large lanes consume excessive space for six records and push desktop clarification below the queue. Mobile shows “Needs action 2” but one visible record and no obvious route to the second. Completed work is a separate tab; its connection to active revisions is unexplored. Retain responsibility and status cues; replace the board as the primary long-term structure.

**A:** Best visible connection between original natural-language requirement and clarification. Recent conversations do not provide a credible primary structure for years of similarly named papers. Original-message height delays the phone action, and cross-record awareness disappears behind a back link. Retain conversation treatment for record detail; replace recent-chat primary navigation.

## Reference comparison

Linear contributes compact actionable updates; Intercom contributes stable identity/properties beside conversation; Drive contributes prominent retrieval controls. C combines the most relevant mechanisms. None establishes Intercom-like continuity between structured record and conversation. Linear's dark palette and Drive's thumbnail emphasis are not requirements to copy.

## Generic-risk assessments

| Candidate | Containers | Typography/hierarchy | Decoration/material |
|---|---|---|---|
| A | Chat bubbles justified; record blocks lack scalable structure | Excess vertical gaps are defective for urgent mobile use | Restrained state tinting justified |
| B | Workflow grouping justified locally; excessive empty lane area defective | Readable repeated cards inhibit cross-record comparison | Selected-card highlight meaningful |
| C | Desktop rows resolved; mobile card height needs refinement | Strong titles justified; secondary metadata needs tighter organization | Action tint and text-backed statuses meaningful |

## Required refinement and missing-state evidence

1. Expose C's actual clarification question on phones and make responding unmistakable.
2. Preserve every status route, including Ready, and show multiple simultaneous action items.
3. Show record detail connecting requirements, attachments, conversation, progress and separately labeled paper/key downloads.
4. Show completed version 1 remaining downloadable while revision 2 is queued, running or failed.
5. Demonstrate multi-year search/filter results, duplicate titles, long chapters and realistic record volume.
6. Demonstrate overnight scheduling, urgent deadlines, failure/retry, notification deep links and two admins replying concurrently.
7. Separately verify responsive interaction, keyboard access, contrast, loading/empty/error states and print/download behavior.

C is credible enough for further development and review. Screenshots do not establish functional correctness, completed review cycles, production acceptance or owner approval.
