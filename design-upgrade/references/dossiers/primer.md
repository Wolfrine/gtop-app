# GitHub Primer DataTable

[Live source](https://primer.style/product/components/data-table/) · Inspected 9 October 2026 · Public interactive component reference

**Aesthetic description:** Orderly, legible, utilitarian. This is evaluator interpretation, not a measured human response.

## First impression

A quiet table uses alignment, row spacing and restrained rules to make many values comparable. The sort control changes both its arrow and the row order.

## Aesthetic profile

| Aspect | Observed treatment |
|---|---|
| Composition | The documentation shell separates navigation, examples and in-page contents. Within the table, repeated column alignment does most of the organizing work. |
| Typography | Row names carry more emphasis than supplementary values. Labels remain compact without competing with the page title. |
| Colour and material | White and light neutral surfaces, thin borders and restrained links provide separation without a colourful card around every value. |
| Rhythm and density | Consistent rows support scanning. The public documentation shows several density and alignment examples; that is not proof of a whole application’s consistency. |
| Motion | Repository sorting causes local order and arrow changes; feedback is proportional to the action. |
| Identity | Precision and consistency supply character. Decorative illustration is unnecessary for this job. |

## What makes it useful

Sorting has visible, localized feedback. Consistent alignment and row structure make comparison easier to inspect than freely arranged cards.

## Behavior actually inspected

In the sort example, clicked Repository for ascending order, then again for descending order. The settled screenshots show both the arrow and corresponding row sequence changing.

## Limits and what not to transfer

This is a component demo, not a tested end-to-end admin system. Mobile tables overflow horizontally; the documentation does not establish a complete GTOP small-screen workflow. No broad accessibility or keyboard-conformance claim is made from this limited inspection.

## GTOP application hypothesis

Use this as an anchor for question-bank, paper, user and log tables: clear column priority, predictable spacing, explicit sorting and status. Decide which columns/actions remain essential on mobile during the GTOP evaluation; do not simply shrink desktop rows.

## Evidence and sources

![GitHub Primer DataTable: desktop and mobile evidence](../boards/primer-pair.jpg)

- 1440px capture: [action log](../evidence/2026-10-09/run-37894026455/gtop-reference-primer/run-37894026455/primer/primer/1440/record.json), [recorded sequence](../evidence/2026-10-09/run-37894026455/gtop-reference-primer/run-37894026455/primer/primer/1440/sequence.webm), [sampled motion frames](../boards/primer-1440-motion.jpg).
- 390px capture: [action log](../evidence/2026-10-09/run-37894026455/gtop-reference-primer/run-37894026455/primer/primer/390/record.json), [recorded sequence](../evidence/2026-10-09/run-37894026455/gtop-reference-primer/run-37894026455/primer/primer/390/sequence.webm), [sampled motion frames](../boards/primer-390-motion.jpg).

[Selected evidence and controls](../gallery.md#primer) · [interaction results](../interactions.md) · [motion analysis](../motion.md)

Primary source is the live Primer DataTable documentation and its public examples. No Awwwards status is asserted.

Evidence supports the named qualities and bounded interactions. No whole-site score, GTOP score or claim of perfection is assigned.
