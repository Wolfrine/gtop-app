# Raw Notes

This folder stores source material for GTOP wiki updates.

Raw notes are append-only by default. They can come from ChatGPT discussions, Codex sessions, product reviews, user observations, agent outputs, or documentation baselines. A raw note is not the final wiki; it is source material that the wiki curator uses to update durable product pages.

Processing status lives in `codex/WIKI_CURATION_LEDGER.md`. Do not mark notes as processed only by adding source links to wiki pages; every curator run should update the ledger with processed, skipped, or follow-up status.

Use lowercase date-prefixed filenames:

```txt
YYYY-MM-DD-short-topic.md
```

Use this shape for new notes:

```md
# Raw Note - YYYY-MM-DD - Short Topic

## Source

Where this came from.

## Context

Why the discussion or review happened.

## Key Points

- Point 1
- Point 2

## Decisions

- Decision, if any.

## Open Questions

- Question, if any.

## Suggested Wiki Integration

- Existing pages to update.
- New pages only if the concept is durable.
```
