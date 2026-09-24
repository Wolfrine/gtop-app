# AGENTS.md

Scope: entire `gtop-app` repository.

## Mission

This repo owns the GTOP product. Treat it as an independent production application, not a submodule of Hub.

## Agent Start Rules

- First identify the impact area, discovery scope, and expected delivery before making changes. Use the IAC + ADS + ODD framing below for meaningful work.
- Confirm the owning repo is this `gtop-app` repository before editing. Other repos may be read for ecosystem context only unless the user explicitly authorizes cross-repo changes.
- Check branch and dirty worktree state before mutating files. Preserve unrelated user or agent changes.
- Use the CEO dashboard operating model as coordination context: GTOP work may be tracked or reviewed from a central command surface, but implementation remains inside this repo unless a cross-repo change is explicitly requested.

## UI / UX Execution

For UI, UX, layout, styling, motion, responsive behavior, landing-page, dashboard, or visual-quality work:

- Read `Wolfrine/Central/design/README.md`, `UI_AGENT_PROTOCOL.md`, and `EXECUTION_ROUTING.md`.
- Read `design/README.md` and the relevant local design note before changing visuals.
- Route by evidence needed, not task size: deterministic edits may use Chat + GitHub; visually judged implementation should use Codex with the running app/browser; Work is for larger design research/audit before implementation.
- Any change whose correctness depends on appearance is incomplete until the actual rendered surface has been checked on desktop and mobile and known material defects have been corrected.
- A passing build, tests, or code diff does not establish visual quality.
- Keep local design memory concise; retrieve only relevant Central knowledge instead of reading/copying the full design corpus.

## Project Wiki Rules

- Use `wiki/` as GTOP's business/product memory: intent, user problems, product logic, decisions, open questions, and implementation-independent lessons.
- Keep technical implementation details in `docs/`, app code, and engineering plans. Do not turn `wiki/` into an architecture or code log.
- Before product planning or major feature work, read the relevant `wiki/` pages first.
- After product decisions or major review lessons, add source material to `raw/` first, then curate durable updates into `wiki/` using `skills/wiki-curator/SKILL.md`.
- Maintain `codex/WIKI_CURATION_LEDGER.md` as the raw-to-wiki processing ledger. Every curator run should record which raw notes were processed or skipped, which wiki pages changed, and which action items were handed off instead of being stored as wiki todos.

## Wiki Memory Completion Gate

Before ending any turn that changes `wiki/`, `raw/`, `codex/WIKI_*`, `skills/wiki-curator/`, or repo instructions that affect product memory:

- Stage only the intended product-memory files.
- Commit directly on `main` with a clear wiki/curator message.
- Push `main` immediately.
- If push is rejected because `origin/main` advanced, fetch and rebase, then push again.
- If a conflict blocks the rebase, stop and report the exact conflict.
- Run `python .codex/hooks/gtop_stop_check.py` before the final response and do not claim completion unless it passes.

This wiki-memory gate is an explicit exception to the usual "do not push main" deployment caution because product memory must stay canonical for future agents.

## CEO Dashboard Awareness

- Treat the CEO dashboard as the ecosystem coordination layer for requirements, agent workstreams, previews, reviews, merge decisions, and lessons learned.
- Do not implement CEO dashboard features or write to external dashboard state from this repo unless explicitly requested.
- When GTOP work produces reusable product lessons, rejected approaches, review findings, or PM follow-ups, capture durable product knowledge in `wiki/` and execution follow-ups in the curation ledger or the requested PM handoff.
- Random discovery is allowed when scoped by ADS; random implementation is not. Agents should work from a clear requirement packet or user request.

## Action Plan Coordination

- Use the admin Action Plan at `/admin/action-plan` as the execution coordination surface for meaningful GTOP work.
- Before starting non-trivial implementation, identify the matching action-plan activity. If none exists and an authenticated admin session is available, create it before implementation.
- Set active work to `In progress`, name the responsible person, team, or agent, and add the branch, PR, task, or other source reference.
- Update the latest-progress field when reaching a material milestone, entering review, encountering a blocker, or completing validation.
- Move work to `Ready for review` only when the stated acceptance criteria are met and relevant checks have run. Move it to `Done` only after the requested delivery is complete.
- If the Action Plan cannot be reached or updated, do not invent success. Report the exact access blocker and backfill the activity at the first available opportunity.
- The Action Plan is execution state, not product memory. Durable product decisions and lessons still belong in `raw/` and `wiki/` under the Project Wiki Rules.

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
