# GTOP v2 Versioning and Rollback

## Release identity

GTOP v2 uses semantic versions. The source version is stored in
`gtop-v2/package.json`; the first production release is `2.0.0`.

Every deployed build also contains `/version.json` with:

- `version`: semantic application version;
- `commit`: full Git commit SHA;
- `branch`: source branch;
- `channel`: `uat` or `production`;
- `builtAt`: UTC build timestamp.

UAT builds use `2.0.0-uat.<commit>` and never update the shared production
version requirement.

## Canonical production version

`Meta/version` is the canonical required production release. It is updated only
after the production Hosting deployment and smoke check succeed.

Agents and workflows must:

1. Read the current value with the MCP `app_version_get` tool.
2. Publish the new production version with `app_version_publish`.
3. Supply the read document's full-precision opaque update token, full commit,
   semantic version, release run reference, and actor.

The publish tool enforces optimistic concurrency, writes an immutable release
record under `Meta/version/releases`, and creates an `mcpAuditLog` entry.
Generic Firestore tools must not be used to publish an application version.

Version increments follow SemVer:

- patch: compatible fixes and small experience improvements;
- minor: compatible product capability;
- major: incompatible contracts or a product-generation cutover.

## Production promotion

The `GTOP v2 Production` workflow is manual, runs from `main`, and requires the
`firebase-production` environment confirmation. It validates the requested
version against `package.json`, runs tests, builds the production configuration,
deploys Hosting, verifies `/version.json`, and only then publishes `Meta/version`
through MCP.

Rules, indexes, and database rules are not deployed by this workflow.

## v1 backup and rollback

The v1 application remains unchanged under `gtop-app/`. The production revision
immediately before the v2 cutover is preserved by the annotated Git tag
`v1-prod-backup-2026-07-26`.

Firebase Hosting also retains the prior live release. To restore the source-built
v1 backup, run `Deploy to Firebase Hosting` manually with:

- target: `production`;
- confirmation: enabled.

The same workflow with target `rehearsal` deploys v1 to the development Hosting
target and is the required rollback rehearsal before v2 promotion.

After a rollback, do not delete the v2 tag, release record, or audit trail.
