# GTOP Wiki Curator

Use this skill when turning GTOP raw notes, product reviews, user discussions, or agent outputs into project wiki updates.

## Workflow

1. Read `codex/WIKI_PROJECT_RULES.md`.
2. Read the new raw source note fully.
3. Identify durable product concepts, decisions, open questions, and implementation-independent lessons.
4. Search existing `wiki/` pages for matching concepts.
5. Update existing pages first.
6. Create a new page only if the concept is durable and likely to be referenced again.
7. Use natural inline wiki links inside sentences.
8. Keep implementation details in `docs/` or engineering plans, not `wiki/`.
9. Add the raw note path under `Source Notes` on changed pages.
10. Update `wiki/Home.md` only when the product map materially changes.

## Quality Bar

A good GTOP wiki update:

- Improves future product reasoning.
- Keeps pages concise and navigable.
- Separates observations, decisions, and open questions.
- Preserves user intent and uncertainty.
- Links durable concepts naturally.
- Points back to raw source material.

A weak GTOP wiki update:

- Creates many tiny pages.
- Duplicates existing pages.
- Adds technical implementation details.
- Converts guesses into facts.
- Adds link dumps instead of useful inline links.
- Makes the wiki harder to navigate.

## GTOP Boundaries

GTOP is an independent production application. Do not frame it as a Hub submodule. Hub integration can be referenced as an ecosystem boundary or product decision, but technical URL mechanics belong in `docs/` unless they materially affect product direction.
