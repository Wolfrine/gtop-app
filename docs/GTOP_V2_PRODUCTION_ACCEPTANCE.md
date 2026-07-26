# GTOP v2 Production Acceptance

## Owner acceptance

On 2026-07-26, after the device-specific layout and mobile reliability pass was
deployed to the dedicated UAT site, the owner confirmed that the application was
working, looking good, and approved moving it to production.

UAT URL: <https://gtop-app-v2-uat.web.app>

## Accepted release candidate

- UAT source commit: `be7a754114f5f4d645092ed6b42738f3efcbadd3`
- Successful UAT validation run:
  <https://github.com/Wolfrine/gtop-app/actions/runs/30197448969>
- Automated browser matrix: 69 passed, with three intentional desktop-only
  skips for mobile-navigation assertions.
- Production initial bundle: below the 900 kB release budget.
- Production backend: unchanged Firebase Authentication, Firestore, and Realtime
  Database contracts.
- Backend rules and indexes: not part of this Hosting cutover.

The owner acceptance is the signed UAT evidence for functioning parity rows that
cannot be safely exercised against live data in an automated production run.
Automated and emulator evidence remains linked in the parity ledger where
available.

## Release protections

- v1 source remains in `gtop-app/`.
- Pre-cutover v1 is preserved by an annotated Git tag.
- The source-built v1 rollback is rehearsed against the development Hosting
  target before production deployment.
- v2 production is deployed only by the protected manual workflow.
- `Meta/version` is updated through the audited MCP tool only after Hosting and
  release metadata verification succeed.
