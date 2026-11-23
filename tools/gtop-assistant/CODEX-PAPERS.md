# GT Papers Codex worker

## Native conversations

The pilot flag is assistantConfig/pilot.nativePapersEnabled. New messages sent
with it enabled go to an owner-scoped native Codex thread. The gateway stores
the original text, its UTF-8 SHA-256 and the Firebase request identity. A paired
worker binds one Codex thread to the conversation before forwarding the text.
The turn may produce a conversational reply or stage a complete paper. The
gateway validates, renders and publishes the student paper and worked answers
together. Existing queued work keeps its original lease and delivery path.

The worker runs one Codex app-server over stdio. On later turns it resumes the
recorded thread. Turn IDs and exact input proofs go to H:. The live lease fences
delivery, and the receipt includes hashes of both documents. A cancellation
revokes delivery immediately and requests native interruption when the worker
observes the lease change.

The native turn has no local execution environment on this Windows host.
It can use public web research and native collaboration, and it can submit a
complete paper through its application tool. The worker exposes neither the
Firebase pairing nor operator integrations to the turn. The Codex home is
dedicated to Papers. The worker rejects unexpected MCP connectors at startup.

## Authentication and isolation

Run the standard worker as the Windows owner who is already signed in through
the Codex CLI. Omit `NativeCodexExecutable` in this mode. Codex manages
authentication through the owner's existing `CODEX_HOME`. The standard
worker's `codex exec --ignore-user-config` invocation skips the user
configuration. [Codex authentication](https://learn.chatgpt.com/docs/auth)

Windows Codex CLI 0.171.0 completed two turns with `exec` and
`exec resume <thread-id> -` using this login. The second process recovered the
first turn's context. Both native input hashes matched the original UTF-8
text, including whitespace, CRLF and Unicode. The native records confirmed
read-only permissions and an approval policy of never. This was a native CLI
run. End-to-end Papers delivery through that thread remains unverified.
[Non-interactive Codex](https://learn.chatgpt.com/docs/non-interactive-mode)

The 0.171 standalone app-server rejects `--ignore-user-config`. It loads
owner settings from the same Codex home as the authentication and local
thread records. The empty `mcp_servers` override retains inherited entries,
and the startup MCP inventory can initialize configured connectors. Keep
shared-home pilot admission off until a supported configuration can exclude
owner integrations before starting a thread. An already provisioned pilot
uses its isolated home and saved thread IDs.
[App Server](https://learn.chatgpt.com/docs/app-server)
[Configuration merge in Codex 0.171](https://github.com/openai/codex/blob/rust-v0.171.0/codex-rs/config/src/merge.rs)
[MCP discovery in Codex 0.171](https://github.com/openai/codex/blob/rust-v0.171.0/codex-rs/codex-mcp/src/mcp/mod.rs#L572)

For a single-login cutover, keep the redesign's Firebase owner, conversation and
worker binding, original input hash and delivery lease. Qualify a native
runtime that preserves the thread, input and tool scope before enabling new
admissions. Native thread IDs already bound to an isolated Codex home must
continue to resolve there.

## Runtime and cutover

The model profile stays in the owner-controlled H: runtime directory. Its
default is schema version 1, revision 1, model gpt-6.2-sol and reasoning effort
xhigh. Change the model through that profile and restart the worker after
draining. The native thread must confirm the selected model and effort.

For an already provisioned, explicitly approved isolated pilot:

1. Verify the existing private codex-home beside the worker data directory and
   the existing Firebase pairing. The worker requires an active managed ChatGPT
   session in that isolated home.
2. Verify the exact Windows Codex executable, authenticated native execution,
   thread continuity and isolation, interruption, and authenticated publication.
   Keep commissioning receipts on H:.
3. Deploy the gateway and Hosting through the existing main release workflow.
   Confirm the active gateway revision and served Hosting commit.
4. Drain the existing Papers worker with its claimsPausedUntil fence. Confirm
   there is no active lease and both lanes are idle. Stop the identified Papers
   process. Start the pinned release with the existing pairing, new profile and
   native executable. Restore the prior fence and confirm the new PID, heartbeat
   and Firestore listener.
5. Enable the pilot flag, exercise the authenticated production route and
   retrieve both artifacts. Disabling the flag stops new native admissions.
   Queued native work keeps its thread and worker binding.

Invoke the existing Windows launcher with Config, Profile and
NativeCodexExecutable. Its legacy mode remains available for saved work when no
native executable is supplied.
