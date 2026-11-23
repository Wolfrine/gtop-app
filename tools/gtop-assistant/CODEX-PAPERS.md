# GT Papers Codex worker

The Windows Papers worker runs the Firestore dispatch listener and claims one conversation turn and one paper or curriculum task independently. Exact greetings, task status and saved proposal responses can complete without inference. Substantive conversation, curriculum, paper planning, drafting, review and correction use the configured ChatGPT-authenticated Codex CLI.

## Runtime profile

Keep the profile in the owner-controlled GT Papers runtime directory on H:. The paired Firebase worker configuration continues to supply its protected pairing and gateway. The profile contains only model settings and stays outside Hosting and user writes.

~~~json
{
  "schemaVersion": 1,
  "revision": 1,
  "model": "gpt-6.2-sol",
  "reasoningEffort": "xhigh"
}
~~~

The worker reads this file once at startup, passes its model and effort explicitly, and requires the native turn context to agree before using structured output. The output records the native thread ID and observed settings. A failed model, login, quota or profile check leaves the saved request available for retry. Checkpoint reuse requires the same profile revision, model and effort. Already reviewed retained output keeps its original provenance during a delivery retry.

Start from the pinned F: release checkout, with dependencies installed and the existing Firebase pairing configuration available. Use the GT Papers launcher as the Windows owner who is signed into Codex through ChatGPT. The profile's sibling runtime directory holds private execution and health logs.

~~~powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\gtop-assistant\start-worker.ps1 -Config "<private worker config.json>" -Profile "<H-drive paper-runtime.json>"
~~~

With the production pairing in Codex mode, the site reports a host-side start when offline. The legacy remote starter and its Ollama-coupled recovery cannot start a Papers worker for that pairing. A host operator restarts Papers explicitly.

## Change a model or roll back

1. Save the current profile beside the proposed revision. Set a new revision and the intended model ID and reasoning effort. Keep xhigh for high-effort production use.
2. Use the installed desktop Codex CLI with the intended settings and ChatGPT login to run one bounded, harmless request. Check the matching native turn context for both fields.
3. Use the pairing's existing claimsPausedUntil drain and check that no Papers worker lease is active. Stop the identified Papers worker, restore the prior claims fence, and start the pinned release with the new profile. Verify the Firestore listener and fresh worker heartbeat.
4. For model rollback, drain again and restart with the previous profile. For release rollback, also restore the previous gateway and Hosting through the existing main release path. Restore the old pairing mode and launcher only if reverting the entire Codex migration.

The configured effort is a CLI setting. Native invocation evidence establishes the setting the CLI used.
