# AGENTS.md

Scope: entire `gtop-app` repository.

## Mission

This repo owns the GTOP product. Treat it as an independent production application, not a submodule of Hub.

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
