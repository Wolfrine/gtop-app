# GTOP v2 Architecture and Release

## Product boundary

GTOP v2 is a standalone Angular application under `gtop-v2/`. It preserves the current production Firestore collections and the `returnTo` and `hubReturnPath` URL contracts while replacing the learner and administrator experiences.

## Runtime architecture

- Angular 21 standalone routes with learner and administrator shells.
- Modular Firebase Web SDK behind typed repositories; pages do not own collection paths.
- Auth readiness is explicit. Guards wait for Firebase and the user profile before deciding whether to allow or redirect a deep link.
- The UAT build displays a permanent `UAT - LIVE PRODUCTION DATA` warning and uses the production Firebase project by product decision.
- Destructive administrative actions require an additional live-data confirmation.

## Agent coordination

`tools/gtop-mcp/` is a local STDIO MCP server configured through `.codex/config.toml`. It uses Application Default Credentials or `GOOGLE_APPLICATION_CREDENTIALS`; credentials are never committed. Action-plan tools are the preferred work interface. Generic Firestore tools provide full database access with bounded reads, update-time preconditions, explicit delete confirmations, write annotations, and `mcpAuditLog` records.

Build and register the server:

```powershell
cd tools/gtop-mcp
npm.cmd ci
npm.cmd run build
```

Set `GTOP_MCP_ACTOR` and `GTOP_MCP_TASK_REF` before restarting Codex so audit records identify the agent and workstream.

## Environments and rollout

- V1 production remains deployed from `gtop-app/` on `main`.
- Non-main v2 changes validate and deploy to the stable `uat-gtop-v2` hosting target.
- The workflow creates the stable `gtop-app-v2-uat` Hosting site when needed and idempotently merges both Hosting origins into Firebase Authentication authorized domains without removing existing entries.
- After a successful deployment, the workflow idempotently seeds the six GTOP v2 workstreams into the live `actionPlans` board and records audit evidence.
- Firestore rules are versioned in v2 but are not automatically deployed by the UAT workflow because they affect the shared production backend.
- Production cutover requires an owner-approved workflow change that builds `gtop-v2/` for the existing production Hosting target. Retain the last v1 Hosting release for rollback.

## Verification

Run `npm.cmd run check` in `gtop-v2/`, `npm.cmd test && npm.cmd run build` in `tools/gtop-mcp/`, and Playwright smoke/accessibility tests before requesting owner approval.
