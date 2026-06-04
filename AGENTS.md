# AGENTS.md

Scope: entire `gtop-app` repository.

## Mission

This repo owns the GTOP product. Treat it as an independent production application, not a submodule of Hub.

## Agent Start Rules

- First identify the impact area, discovery scope, and expected delivery before making changes. Use the IAC + ADS + ODD framing below for meaningful work.
- Confirm the owning repo is this `gtop-app` repository before editing. Other repos may be read for ecosystem context only unless the user explicitly authorizes cross-repo changes.
- Check branch and dirty worktree state before mutating files. Preserve unrelated user or agent changes.
- Use the CEO dashboard operating model as coordination context: GTOP work may be tracked or reviewed from a central command surface, but implementation remains inside this repo unless a cross-repo change is explicitly requested.

## Project Wiki Rules

- Use `wiki/` as GTOP's business/product memory: intent, user problems, product logic, decisions, open questions, and implementation-independent lessons.
- Keep technical implementation details in `docs/`, app code, and engineering plans. Do not turn `wiki/` into an architecture or code log.
- Before product planning or major feature work, read the relevant `wiki/` pages first.
- After product decisions or major review lessons, add source material to `raw/` first, then curate durable updates into `wiki/` using `skills/wiki-curator/SKILL.md`.
- Maintain `codex/WIKI_CURATION_LEDGER.md` as the raw-to-wiki processing ledger. Every curator run should record which raw notes were processed or skipped, which wiki pages changed, and which action items were handed off instead of being stored as wiki todos.
- Commit wiki-related updates directly on `main` so product memory stays in the canonical branch, then push `main` immediately. Wiki updates are allowed to bypass the usual "do not push main" rule because product memory should be visible to all agents.

## CEO Dashboard Awareness

- Treat the CEO dashboard as the ecosystem coordination layer for requirements, agent workstreams, previews, reviews, merge decisions, and lessons learned.
- Do not implement CEO dashboard features or write to external dashboard state from this repo unless explicitly requested.
- When GTOP work produces reusable product lessons, rejected approaches, review findings, or PM follow-ups, capture durable product knowledge in `wiki/` and execution follow-ups in the curation ledger or the requested PM handoff.
- Random discovery is allowed when scoped by ADS; random implementation is not. Agents should work from a clear requirement packet or user request.

## IAC + ADS + ODD Framing

Use this framing for meaningful implementation, planning, review, wiki, dashboard, or agent-coordination work:

- IAC, Impact Area Context: state the affected GTOP product area, user, workflow, business problem, or dashboard surface.
- ADS, Autonomous Discovery Scope: state what the agent may inspect or infer on its own, including whether other repos are read-only context.
- ODD, Output Delivery Direction: state the expected output shape and where it should land, such as code changes, wiki updates, PM handoff, review notes, branch, PR, or preview.

If the user does not provide these explicitly, infer conservative defaults from repo instructions and state them before substantial work.

## Deployment Rules

- GitHub Actions deploy on every push.
- `main` deploys `prod-gtop-app`.
- any non-`main` branch deploys `dev-gtop-app`.
- Use a non-`main` branch for dev deployment work whenever available.
- Do not push `main` unless you intend to promote GTOP to production.

## Worktree Rules

- Do not commit `.firebase/` cache files.
- Do not modify generated content such as syllabus indexes unless the change is intentional.
- The actual Angular app lives under `gtop-app/`; follow the more specific instructions there when touching app code.
