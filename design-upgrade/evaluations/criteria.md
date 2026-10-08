# Evaluation criteria v1.0

**Step 1 output · 8 October 2026 · Defined, awaiting benchmark calibration in Step 3.** No GTOP screen ratings have been assigned. These are project review criteria, not official Awwwards scores or measured user-research results.

## What a good GTOP screen should achieve

| Context | Intended experience | Evidence to inspect |
|---|---|---|
| Public entry | A credible, appealing invitation; immediately understandable purpose and next action | First viewport, full page, responsive transitions and entry flow |
| Learner practice and labs | Focus, curiosity, readable learning content, confidence about the next step and useful feedback | First visit, active task, answers/feedback, return visit and recovery |
| Learner history and progress | Understand previous work and select a useful next action | Empty and populated history, meaningful labels, drill-down and return paths |
| Admin and paper work | Know what needs attention, create work, track it and retrieve older results efficiently | Create, pending, needs-reply, failure, completed, search, dense register and repeat visits |

These purposes come from the current product intent and requested review scope. Step 2 must verify the actual screen inventory and discover any additional contexts.

## Two independent scores

Each screen receives a **visual craft score** for desktop and mobile. Its associated task receives a **journey quality score** after live interaction has been observed. Also report responsive, accessibility and functional findings separately. Do not collapse everything into a single headline number.

### A. Visual craft

| Dimension | Weight | Observable questions |
|---|---:|---|
| Composition and hierarchy | 25% | Is there a clear focal point and reading order? Are primary and secondary actions distinct? Does the first viewport explain the screen? |
| Typography | 20% | Do size, weight, line length and wrapping create readable hierarchy? Are labels and dense content composed deliberately? |
| Spacing, alignment and rhythm | 15% | Are groups, gutters, edges and section transitions coherent? Is the density appropriate for the task and viewport? |
| Color and tonal relationships | 10% | Do surfaces, emphasis and contrast guide attention consistently? Do status colors have clear meaning? |
| Art direction and identity | 20% | Does the screen feel intentionally made for GTOP? Are imagery, illustration, iconography or deliberate restraint coherent and appropriate? |
| Component finish and consistency | 10% | Are controls, borders, states and repeated patterns precise? Does the screen fit neighboring screens without flattening meaningful differences? |

Score each dimension on 1–10. Calculate the weighted mean only when every dimension has sufficient evidence; display one decimal place. A plain, well-composed admin interface can score highly on identity without adding decorative imagery. Cross-screen consistency remains unscored until neighboring views are available.

### B. Journey quality

| Dimension | Weight | Observable questions |
|---|---:|---|
| Next-action clarity | 25% | Can the intended user identify what to do and the consequence of doing it? |
| State and feedback clarity | 25% | Are saved, waiting, active, needs-input, failed and completed states understandable? Is progress truthful? |
| Information load and navigation | 20% | Can the user focus on the current task, locate related work and return without reconstructing context? |
| Repeated use and growth | 20% | Does the flow remain practical on later visits and as records accumulate? Are retrieval, filtering and pagination usable? |
| Recovery and continuity | 10% | Can the user recover from mistakes, missing data, reloads or interruption without losing the thread? |

Use the same calculation rule. Screenshots alone cannot earn a journey score. An observed test demonstrates its specific behavior; it does not establish how easily real students understand it. Label evaluator observations and real-user evidence separately.

## Scoring anchors

| Score | Meaning | Evidence needed |
|---|---|---|
| 1–2 | Broken or incoherent | The task or composition is repeatedly obstructed |
| 3–4 | Rough | Major hierarchy, readability, consistency or navigation problems dominate |
| 5–6 | Functional, ordinary | Usable basics; visible generic treatment or unresolved polish issues |
| 7 | Coherent and competent | Clear and consistent, with identifiable limitations against strong peers |
| 8 | Convincingly premium | Deliberate craft holds across the relevant states and mobile/desktop views; supported by benchmark comparisons |
| 9 | Exceptional | Distinctive, highly resolved work that stands beside the strongest suitable references, with few meaningful weaknesses |
| 10 | Rare exemplar | An unusually complete result for the agreed purpose; requires explicit justification and user agreement, never a claim of universal perfection |

These anchors are provisional until Step 3 supplies visible examples. An 8+ claim needs named benchmark evidence and state coverage. Smooth operation, a successful build, expensive animation or the presence of a design system does not itself establish premium visual quality.

## How each review is performed

1. Identify the user, task, first/returning visit, route, state, viewport and source commit. Verify that the capture is complete and representative.
2. Record a short unaided first impression before reading an external award rating or prior GTOP evaluation. This is an evaluator impression, not a timed user study.
3. Inspect the first viewport, full content and key details. Observe the actual task when judging behavior. Include empty, ordinary and dense states as applicable.
4. Select relevant benchmark examples. Compare the same quality at comparable viewport sizes and content density. A public agency homepage can inform art direction; an admin retrieval task also needs a relevant product reference.
5. Record observable strengths and weaknesses before assigning numbers. Cite screenshot paths and locations or exact interaction steps. Explain the effect on attention, comprehension or effort.
6. Score desktop and mobile separately; score the journey only when observed. Keep missing evidence as `not observed`, never zero or an assumed average.
7. Record confidence, high-impact issues, what should be retained and the improvement objective. Separate facts, design judgments and hypotheses requiring validation.

## Evidence and severity rules

Every finding contains: **observation → evidence → consequence → priority → improvement objective**. Prefer an objective such as “make pending work distinguishable at a glance” over prematurely prescribing a new layout.

- **Critical:** the core task is inaccessible, loses data or creates a serious correctness risk. Record it immediately; it blocks acceptance of the affected journey.
- **Major:** substantial confusion, unreadability, navigation or responsive failure. It must be addressed before accepting the affected screen.
- **Moderate:** recurring friction or visual inconsistency with a meaningful effect on quality.
- **Minor:** localized polish with limited task impact.

High severity remains visible even when an average score is high. Accessibility observations include text contrast, focus visibility, keyboard operation, meaningful labels, touch targets and motion preferences. Static inspection produces a flag to verify; it does not establish formal conformance.

Confidence is **high** when the relevant views, states and live behavior support the claim; **medium** when partial evidence supports a bounded claim; **low** when important states or behavioral evidence are missing. Unknowns block the corresponding score, not unrelated observations.

## Comparison and acceptance

- Preserve separate baseline and proposed-design records with the same rubric version and equivalent content/state conditions.
- Show before/after evidence and explain whether the intended improvement occurred. Keep useful baseline qualities visible.
- Treat motion as observable behavior; a still image cannot receive a motion-quality rating. Document its purpose, timing, interruption and reduced-motion behavior when present.
- An 8+ visual target is a review aid. User acceptance of the proposed direction and required screen coverage is the design gate.
- Step 5 begins after the baseline/reference analysis is on the agreed track. Step 6 begins only after the user accepts the proposed designs. A score never authorizes development or deployment.

## Versioning

Record `rubricVersion: 1.0` on every future scorecard. Step 3 will append benchmark anchors and, if necessary, publish v1.1 before scoring starts. Do not quietly move the scoring threshold to make a design pass. Preserve older versions and explain any rescoring.
