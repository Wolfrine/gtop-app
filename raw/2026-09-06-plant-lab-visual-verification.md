# Raw Note - 2026-09-06 - Plant Lab Visual Verification

## Source

Founder correction after the source-only design assessment, followed by an actual browser walkthrough of the existing Plant Reproduction lesson.

## Context

The founder rejected concrete design direction offered without visual inspection and explicitly required a visual check before further assessment. The reviewer subsequently opened the rendered lesson in an isolated local browser preview, inspected all five explorations and the assessment screen on desktop, and inspected and interacted with the opening and anatomy activity at 390 by 844 CSS pixels.

## Key Points

- Founder instruction: do not offer concrete visual direction without checking the rendered experience first. Source inspection alone did not satisfy the requested review.
- Visually observed desktop entry: the header and question panel occupy the first viewport; the start controls are below it. The large specimen panel does not offer direct interaction.
- Visually observed desktop activities: controls, predictions and navigation surround a relatively small specimen. The same distant flower view remains during the microscopic journey; the fusion event is small within it.
- Visually observed development activity: the fruit is a small simplified shape within a large garden panel; the adjacent dispersal question refers to a dandelion that is not pictured.
- Browser interaction confirmed: a compatible stigma transfer can show success while Record observation remains disabled until the separate petal trial. Closing the explored Bryophyllum example disables completion again.
- Visually observed phone entry: at 390 by 844, the opening screen contains the heading, navigation and first question, with no visible flower.
- Visually observed phone anatomy: the diagram, controls and completion action occupy successive vertical regions. Using the part controls leaves the upper flower outside the visible area. One anatomy page measured approximately 2231 CSS pixels tall within the 844-pixel viewport.
- Review boundary: this used the current lesson components and styles with isolated simulated services, not a signed-in live account. The complete production shell and live account persistence were not verified by this visual check.
- Revised agent proposal: prioritize a compact working area that keeps the active subject, current instruction and relevant controls together, then refine art, magnification, motion and alternative experiments. This is a proposal, not approved implementation.

## Decisions

- Rendered visual inspection is a prerequisite for concrete visual assessment of GTOP's interface.
- The present turn completes review; no lesson redesign was implemented or deployed.

## Open Questions

- Does the proposed compact working area solve independent-use problems for the intended children?
- How does it behave within the complete production shell and on physical phones?

## Suggested Wiki Integration

- Features: record the visual-review prerequisite and distinguish observed layout from unverified live account behavior.
