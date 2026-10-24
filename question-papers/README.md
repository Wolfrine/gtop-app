# Growth Tutorials Question Papers

Independent Angular 21 LTS private teaching workspace. Public Firebase client configuration is reused from the GTOP project; authority is enforced by the gateway, never inferred from the UI. No API keys for model inference or worker credentials are stored here. Use Node 22.12+ in the 22 line, or Node 24; the system's older Node 20.13 is unsupported. CI's current Node 22 meets the requirement.

```
npm ci
npm test
npm run build
npm start
```

Development: http://127.0.0.1:4317. Runtime public configuration is `public/assistant-config.json`: `apiBase` plus Firebase browser configuration. Firebase Google sign-in requires this independent Hosting domain in the project's authorized domains. Existing email sign-in is also available. Local-only `?emulator=1` selects project `demo-gtop-assistant`, Auth port 9299 and gateway port 5201 from the isolated Firebase config. Sign in using a seeded emulator identity; no authentication bypass is provided. Hosted origins ignore that query and always use production identity.

## Visual QA

Development-only localhost routes `?fixture=empty`, `working`, `ready`, `offline`, `error`, `long`, `clarify`, `revisions`, and `retry-chain` show explicitly labelled synthetic data. They make no backend or model calls. The production build replaces the entire fixture module with a null implementation: query parameters cannot bypass sign-in in a hosted build. These fixtures establish UI behavior only, not educational or gateway acceptance.

The UI sends ID bearer tokens through headers, never links. Private paper HTML is fetched through the gateway, shown through `srcdoc` in a sandboxed iframe with no script permission, and printed through browser Print/Save PDF. Only the gateway's escaped, validated renderer output enters this frame; model HTML is never accepted directly. Document content is cleared on close. The paper and answers remain separate. Original documents are immutable; revisions return to the same conversation.

Pending jobs poll every two seconds, idle conversations every fifteen. Displayed stages come from gateway state; no progress percentages or estimated completion time are invented. Request IDs are retained through network failures to permit idempotent resubmission. A paper job does not block ordinary conversation. No attachment capability or scheduler control is present.

Only the controller-designated `conversation.activePaperJobId` supplies paper progress and recovery actions. Failed earlier attempts in a retry chain are not actionable; completed paper jobs are represented by the document result rather than duplicate progress cards. Earlier immutable document revisions remain available through the revision disclosure.

Assistant replies support only bold text, simple bullets, paragraphs and line breaks. All source HTML is escaped before formatting, then passed through Angular's normal HTML sanitizer (no trust bypass). Links, images, scripts, arbitrary HTML and attributes are never parsed. User messages remain literal text. The development-only `?fixture=formatting` includes hostile markup for rendered regression checks.

Delimited assistant math (`$…$`, `$$…$$`, `\(…\)`, `\[…\]`) uses pinned KaTeX 0.19.1 with locally bundled CSS/fonts and chemistry notation. Only generated math markup enters controlled formula spans after prose sanitization. Rendering uses `trust:false`, `strict:'error'`, `maxExpand:200`, `maxSize:12`, fresh macros, and source/output size bounds. Malformed or untrusted commands remain escaped literal text. User TeX stays verbatim. `?fixture=math` replays the exact retained local Q6 explanation from the isolated emulator, plus clearly synthetic safety cases; it never invokes a model. Twelve tests cover these paths, including expansion-loop and code-injection payloads.

Dependency security verification is retained in `security/`. Angular core/compiler 21.2.25 and CLI/build 21.2.28 are pinned with compatible TypeScript 5.9.3 and Zone.js 0.16.3. Explicit zone-based change detection preserves existing asynchronous UI behavior. The modern application builder removes unused Webpack tooling. Compatible overrides patch the Firebase SDK's Node-only gRPC dependency and the build tool's Undici dependency; neither enters the browser bundle. Both production and complete dependency audits report zero findings at the recorded check. The legacy GTOP core application's dependencies are outside this sub-app's scope.

`artifact-presentation.mjs` supplies trusted **presentation version 1** to the verified artifact's view copy. It contains long formulas within horizontally scrollable individual math regions on screen and restores unrestricted, original-size formulas for printing. The same frame feeds Print/Save PDF. A parent-page load/resize hook marks only overflowing formulas keyboard-focusable after fonts load; the frame still permits no scripts. Source paper, stored HTML and integrity hashes remain unchanged. This covers immutable older revisions as well as newly rendered papers.
