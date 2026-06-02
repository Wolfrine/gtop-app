# GTOP Wiki Project Rules

## Purpose

The GTOP wiki is the product thinking layer for Growth Tutorials Objective Practice.

It should help humans and LLM agents understand what GTOP is trying to achieve, who it serves, what product problems matter, what decisions are already made, and what open questions remain.

## Scope

Allowed in `wiki/`:

- Product intent
- User problems
- Business and product logic
- User journeys
- Feature rationale
- Product decisions and rationale
- Open questions
- Implementation-independent lessons from reviews or agent outputs

Excluded from `wiki/`:

- Angular component details
- Firebase collection schemas
- API details
- Build and deployment mechanics
- Test implementation details
- Commit-level logs
- Low-level engineering tasks

Use this split:

- `wiki/` = why, what, users, product logic, decisions, open questions.
- `docs/` = how, architecture, APIs, data model, deployment, operations, user manuals.
- `raw/` = source notes before curation.

## Curation Rules

- Read the relevant `wiki/` pages before product planning or major feature work.
- Add new source material to `raw/` before changing durable wiki pages.
- Prefer updating existing wiki pages over creating new ones.
- Create a new page only for a recurring, durable concept.
- Use natural inline wiki links such as `[[Intent]]`, `[[Problems]]`, or `[[Quiz Run]]`.
- Do not add generic related-link dumps to the bottom of every page.
- Preserve uncertainty. Do not rewrite hypotheses as decisions.
- Add source note references when wiki pages are updated.

## Initial Page Set

The minimum GTOP wiki starts with:

- `wiki/Home.md`
- `wiki/Intent.md`
- `wiki/Users.md`
- `wiki/Problems.md`
- `wiki/Features.md`
- `wiki/Decisions.md`
- `wiki/OpenQuestions.md`

Do not expand the taxonomy until real source material makes it useful.
