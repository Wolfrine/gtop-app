# AGENTS.md

Scope: entire `gtop-app` repository.

## Mission

This repo owns the GTOP product. Treat it as an independent production application, not a submodule of Hub.

## Project Wiki Rules

- Use `wiki/` as GTOP's business/product memory: intent, user problems, product logic, decisions, open questions, and implementation-independent lessons.
- Keep technical implementation details in `docs/`, app code, and engineering plans. Do not turn `wiki/` into an architecture or code log.
- Before product planning or major feature work, read the relevant `wiki/` pages first.
- After product decisions or major review lessons, add source material to `raw/` first, then curate durable updates into `wiki/` using `skills/wiki-curator/SKILL.md`.
- Commit wiki-related updates directly on `main` so product memory stays in the canonical branch, then push `main` immediately. Wiki updates are allowed to bypass the usual "do not push main" rule because product memory should be visible to all agents.

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
