# Question Paper pilot release record — 24 October 2026

Implementation: `main`, patched application candidate `9be7fd99b67310fdf40ad385ad5e1dfbc6d6bc28`. [Blocked protected release run](https://github.com/Wolfrine/gtop-app/actions/runs/40084938604). The site currently serves the earlier `a6cbc839d66afa78d5dbda9cb82fe17f0382a0a4` candidate. **Production conversation/generation is not ready: worker authentication is blocked.** This record distinguishes real integration, deployed infrastructure and remaining human acceptance.

## Delivery scope

Independent Angular Question Papers site; existing Firebase sign-in and admin role plus a two-person private allowlist; authenticated gateway; one outbound Windows controller; loopback Qwen3.5 4B; unchanged ChatGPT-authenticated Codex CLI. Controller-owned jobs, original intent/history, bounded context and explicit memory, versioned skills, reviewed generation, private separate artifacts, immutable revisions, cancellation, explicit retry and stale-result rejection are implemented.

GTOP core, existing user/bank data and legacy access are preserved. The old paper scheduler was not restarted or reconfigured. No migration, bank writes, attachments, general development tools or automatic IAM grants are included. No API-key or paid-API fallback was introduced. The existing personal subscription's successful CLI execution establishes technical feasibility; it does not establish entitlement or capacity for a public multi-user service. Keep the initial operation private and operator-controlled.

## Evidence and checks

- Actual synthetic-emulator administrator used the UI → gateway → local Qwen → controller → Codex → reviewed paper flow. Codex generated38 questions,80 attempted marks, ten chapters and four whole-question OR choices. A later revision changed onlyQ6;37 questions and all other settings remained equal. The local model did not generate the paper content.
- Generation327.586s; separate review24.536s; targeted revision33.466s; separate revision review16.998s. Local request25.183s, continued conversation11.405s, revision interpretation17.429s. A later local-only explanation took48.917s with one JSON repair; language/verbosity limitations are retained honestly.
- Exact prompts, raw outputs, controller decisions, skill hashes, invocation/events/results, containment check and ten selected numeric recomputations are retained in [72-file integration evidence](pilot-evidence-2026-10-24/README.md), with verified SHA256 manifest. These are real model outputs with a synthetic identity, distinct from labelled UI fixtures.
- Latest local checks:25 backend/domain/release tests,15 controller tests plus TypeScript compilation,12 UI tests plus production build. Two real isolated Auth/Firestore/Functions/RTDB endpoint/rule tests also passed after the dependency update, preserving the existing synthetic pilot configuration. Expected permission-denied probes passed. Prior CI passed the existing shared-rule regressions; the patched candidate's required Node22 CI job was not started because of the account block below.
- Security audit updated only the independent app to Angular21.2.25, modern build/CLI21.2.28 and KaTeX0.19.1; server uses Firebase Admin14.5.0/Functions7.4.0 and KaTeX0.19.1. Compatible gRPC/Undici patches remove transitive advisories. Complete and production audits report zero findings for the independent app and server; controller audit is also zero. [Frontend audit evidence](../../question-papers/security/README.md), [backend audit](../../assistant-service/security/dependency-audit.json). These are point-in-time registry results. GTOP core dependencies were preserved.
- Parent and independent critic inspected desktop/tablet/phone rendering with actual paper/answer content, immutable revisions, status/retry states, safe formatting and formula overflow. KaTeX chat math was checked against the retained actual explanation without another inference run. Build and HTTP checks do not replace these visual checks.

## Release status

The worker-only Firestore/Realtime Database restrictions deployed successfully in run40081958939. Actual live RTDB collection-level presence permissions were preserved; the pilot does not introduce the canonical core file's unrelated child-validation migration. Existing server-only Storage policies were inspected and preserved. Earlier release helper failures involved commented JSON, live-policy drift and path-qualified Firestore filenames; each failed closed and was corrected with regression coverage.

The [a6cbc83 release](https://github.com/Wolfrine/gtop-app/actions/runs/40083535974) passed verification and backend deployment: gateway ACTIVE, Node22, one CPU,512MiB,concurrency40, expected existing runtime account and release label. Its live check verified anonymous denial and an existing invited admin session without creating production chat/paper fixtures. Hosting and additive Auth domains were provisioned; direct readback confirms the served commit, expected `<gtop-paper-app>` root,200 response,`no-store`, and401 anonymous gateway response. The job then failed a stale `<app-root>` assertion, corrected in9be7fd9. The site was personally viewed at [gtop-question-papers.web.app](https://gtop-question-papers.web.app); its screenshot is in parent QA. Earlier Cloud Run CPU/concurrency incompatibility was corrected explicitly using [documented CPU configuration](https://docs.cloud.google.com/sdk/gcloud/reference/functions/deploy#--cpu).

Two external release blockers remain:

1. GitHub refused the9be7fd9 verification runner before any step ran. Check-run120845832005 annotation: "The job was not started because recent account payments have failed or your spending limit needs to be increased. Please check the 'Billing & plans' section in your settings". This does not identify which billing condition applies. No payment or spending limit was changed. Restore Actions availability, then rerun the failed job on the same candidate; protected checks and the existing deployment identity must remain in use.
2. Production worker pairing reaches the gateway but custom token creation returns500,`auth/insufficient-permission`. The controller is offline; no production paper/chat inference was attempted. A Windows PowerShell7→5 module inheritance defect was first repaired and covered by an actual Windows DPAPI regression test; pairing material remains encrypted locally. Runtime signing still requires diagnosis/permission resolution. [Firebase documents `iam.serviceAccounts.signBlob`](https://firebase.google.com/docs/auth/admin/create-custom-tokens#service_account_does_not_have_required_permissions) for this operation. The next release includes a read-only, service-filtered error-log diagnostic. Verify that exact denial before applying any IAM change; no key copying or automatic privilege grant is permitted.

The [existing core workflow](https://github.com/Wolfrine/gtop-app/actions/runs/40080788690) passed with core promotion skipped for the assistant-only change. Code changes are complete for this candidate; release and live worker acceptance remain blocked rather than marked complete.

### Proposed signer action — approval required, not executed

If the runtime log confirms missing signing permission, grant the existing runtime account the standard Service Account Token Creator role **on itself only**. This expands credential-signing authority, so it is a separate security decision. The proposed command below is review material, not an executed action; it is not a project-wide role grant:

```powershell
gcloud iam service-accounts add-iam-policy-binding 78765581239-compute@developer.gserviceaccount.com --member=serviceAccount:78765581239-compute@developer.gserviceaccount.com --role=roles/iam.serviceAccountTokenCreator --project=gtop-app
```

After Actions is restored and any confirmed signer change is approved: rerun the protected release, verify the patched served SHA, start the manual controller, verify a current ready heartbeat, then accept the first real admin conversation and paper. Existing real inference evidence remains in the isolated emulator archive; it must not be described as production or Aparna acceptance.

## Remaining acceptance

Actual A4 pagination/PDF and physical printing remain unaccepted: the available browser automation opened Print but could not inspect/export the native dialog. Aparna must review academic correctness, wording, workload and practical classroom suitability. Ten numeric spot checks and a separate Codex review are supporting checks, not complete teacher approval.

The PC must remain awake, online and running the manual controller. Firebase retains requests while it is unavailable, but local conversation waits too. Quota/login failure is recoverable and never silently changes to API billing. Shorter explanation prompts and Devanagari-preserving repair instructions are code/test verified; no post-fix latency or language-quality improvement is claimed without application feedback. No new startup service or scheduled task was installed.

Operational details: [controller runbook](../../tools/gtop-assistant/README.md), [implementation](PILOT_IMPLEMENTATION.md), [API contract](../../assistant-service/CONTRACT.md), [parent QA](../../design/assistant-pilot/parent-qa/README.md), [independent critic](../../design/assistant-pilot/critic/final-candidate/review.md).
