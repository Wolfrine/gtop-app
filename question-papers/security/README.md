# Dependency security check — 24 October 2026

Scope: only the independent Question Papers application. No legacy GTOP core, scheduler, application data or service credentials were changed.

Registry metadata verified Angular core/compiler **21.2.25**, CLI/modern build **21.2.28**, TypeScript **5.9.3**, Zone.js **0.16.3**, KaTeX **0.19.1** and compatible Node engines. Verification ran on bundled **Node 24.19.0**. The project supports Node `^22.12.0 || ^24.0.0`; the host's PATH Node 20.13 is too old. See [Angular's supported-version matrix](https://angular.dev/reference/versions).

The original production audit had ten dependency findings (seven high, two moderate, one low), including unsupported Angular 17 and [KaTeX trust restrictions under existing prototype pollution](https://github.com/advisories/GHSA-238p-pmpm-9mq7). The pinned KaTeX version exceeds the advisory's patched minimum 0.18.2.

- Upgraded Angular packages and added explicit zone-based change detection to preserve behavior under Angular 21's defaults.
- Replaced the legacy build wrapper with equivalent official `@angular/build` application/dev-server builders. This removed 416 unused packages, including the Webpack/SockJS/UUID advisory chain.
- Kept Firebase 11.4 rather than accepting npm's suggested Firebase 9 downgrade. The compatible `@grpc/grpc-js` **1.13.7** override fixes its installed Node dependency. Browser build inputs contain no gRPC or Firestore implementation.
- Applied same-major **Undici 7.30.1** to the build tool's 7.29.1 dependency, fixing the EventSource memory, integrity-token and content-encoding advisories. It is absent from browser build inputs.

Final `npm audit --omit=dev --json` and complete `npm audit --json` both report **zero findings**. Full outputs and exact installed versions are in this folder. Twelve behavior/security tests and the production build pass. Build stats additionally verify no gRPC, Firestore, Undici, Webpack-dev-server or development reply fixture entered the production bundle. This is a point-in-time dependency check, not a guarantee against future advisories.

Installation used official npm **12.2.1** process-locally after the older system npm crashed resolving modern optional peers. No global runtime or npm installation changed. npm 12 left six third-party install scripts blocked; registry-provided native binaries nevertheless passed the actual tests/build/dev startup. The original generated dependency tree and lock are preserved in ignored rollback backups. Final desktop/phone browser regression is performed by the parent because this sub-agent's browser inventory currently reports no enabled surfaces; build/audit success alone does not replace rendered acceptance.
