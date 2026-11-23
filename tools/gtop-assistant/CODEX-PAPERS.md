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

OpenAI classifies standalone Codex app-server as experimental and does not
support it for production workloads. The pilot flag stays off pending
production approval of that release dependency and commissioning of the
dedicated runtime.

## Runtime and cutover

The model profile stays in the owner-controlled H: runtime directory. Its
default is schema version 1, revision 1, model gpt-6.2-sol and reasoning effort
xhigh. Change the model through that profile and restart the worker after
draining. The native thread must confirm the selected model and effort.

1. Provision a private Codex home named codex-home beside the profile. Sign in
   through the official Codex CLI against that home. Keep the existing Firebase
   pairing file in its protected location.
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
