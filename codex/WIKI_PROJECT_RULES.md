# GTOP Wiki Project Rules

## Purpose

The GTOP wiki is the product thinking layer for Growth Tutorials Objective Practice.

It should help humans and LLM agents understand what GTOP is trying to achieve, who it serves, what product problems matter, what decisions are already made, and what open questions remain.

The wiki is only meaningful if a new agent can understand GTOP's direction, tone, and current strategic bets from the wiki itself. Raw notes are source material, not a required second brain for everyday product context.

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
- `codex/WIKI_CURATION_LEDGER.md` = operational record of raw notes processed, wiki pages changed, and PM handoffs surfaced.

## Curation Rules

- Read the relevant `wiki/` pages before product planning or major feature work.
- Add new source material to `raw/` before changing durable wiki pages.
- Check `codex/WIKI_CURATION_LEDGER.md` before curation so raw notes are not missed or repeatedly processed without reason.
- Re-curate already processed raw notes when the wiki failed to preserve the product meaning, tone, or strategic weight.
- Prefer updating existing wiki pages over creating new ones.
- Create a new page only for a recurring, durable concept.
- Use natural inline wiki links such as `[[Intent]]`, `[[Problems]]`, or `[[Quiz Run]]`.
- Do not add generic related-link dumps to the bottom of every page.
- Preserve uncertainty. Do not rewrite hypotheses as decisions.
- Preserve founder intent and urgency when they are part of the product direction.
- Capture why a product concept matters, not only what it is.
- Keep the wiki strong enough that future agents do not need to read raw transcripts just to understand GTOP's direction.
- Add source note references when wiki pages are updated.
- Record each curator run in `codex/WIKI_CURATION_LEDGER.md`, including skipped raw notes and project-manager handoff items.
- Keep execution tasks out of the wiki. Actionable items belong in a PM handoff or external tracker, not in durable product pages.

## Wiki Quality Bar

A good GTOP wiki page should teach future agents how to think about the product. It should preserve strategic anchors such as question-bank quality, ongoing enrichment, student usage, learning diagnosis, AI-assisted feedback, and future-ready education direction when source material supports them.

A weak GTOP wiki page may be clean and concise but still fail if it sounds generic, hides urgency, or forces the reader to open raw notes to understand why the topic matters.

## Completion Gate

Wiki-memory changes are not complete while they are only in the working tree. If a change touches `wiki/`, `raw/`, this file, `codex/WIKI_CURATION_LEDGER.md`, `skills/wiki-curator/`, or repo instructions governing product memory, the agent must commit on `main` and push `main` before claiming completion.

If `origin/main` has advanced, rebase the local wiki-memory commit onto the latest `origin/main` and push again. If that cannot be done cleanly, report the blocker instead of leaving the user to notice the missing push.

Run `python .codex/hooks/gtop_stop_check.py` before the final response. A failing hook means the wiki-memory work is not complete.

## Agent Operating Context

GTOP participates in a broader CEO dashboard and internal Codex-agent operating model. The dashboard may track requirements, agent branches, previews, review notes, selected outputs, merge status, and lessons learned.

Within this repo:

- Treat CEO dashboard references as coordination context unless the user explicitly asks for dashboard implementation.
- Preserve durable GTOP product lessons in `wiki/`.
- Preserve raw source material in `raw/`.
- Preserve raw-to-wiki processing state in `codex/WIKI_CURATION_LEDGER.md`.
- Frame meaningful work with IAC, ADS, and ODD: impact area, autonomous discovery scope, and output delivery direction.

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
