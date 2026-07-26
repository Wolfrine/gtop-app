# Deployment and Environments

## Applications

- `gtop-app/`: retained v1 application and production rollback source.
- `gtop-v2/`: Angular 21 application promoted through UAT before production.
- `tools/gtop-mcp/`: audited agent and release interface for Firestore.

Both applications use the Firebase project `gtop-app`. UAT uses the live backend,
so application testing must respect the visible live-data warning.

## Local development

From `gtop-v2/`:

```text
npm ci
npm start
```

Primary validation commands are:

```text
npm run parity:check
npm test
npm run test:rules
npm run test:database-rules
npm run build:uat
npm run build:production
npm run e2e
```

The rule tests and browser journeys use Firebase emulators.

## UAT

Non-main changes under `gtop-v2/` or `tools/gtop-mcp/` run
`firebase-v2-uat.yml`. Successful builds deploy to:

<https://gtop-app-v2-uat.web.app>

The workflow writes UAT build metadata to `/version.json`, but it does not update
the production `Meta/version` document.

## Production

`firebase-v2-production.yml` is manual and restricted to `main`. It:

1. verifies the requested SemVer;
2. runs parity, unit, rule, database-rule, and Playwright checks;
3. builds the production Angular environment;
4. deploys the v2 build to the `prod-gtop-app` target;
5. verifies the deployed `/version.json`;
6. publishes `Meta/version` through the audited MCP release tool.

Production URLs:

- <https://gtop-app.web.app>
- <https://gtop.growthtutorials.in>

The production workflow deploys Hosting only. Backend rules and indexes remain
behind the separately protected backend workflow.

## Rollback

The existing v1 workflow supports two manual modes:

- `rehearsal`: builds v1 and deploys it to `dev-gtop-app`;
- `production`: builds v1 and restores it to `prod-gtop-app` after explicit
  confirmation.

See `GTOP_V2_VERSIONING_AND_ROLLBACK.md` for tags, version rules, and the
MCP publishing contract.
