# GT Papers Codex worker

New requests admitted under assistantConfig/pilot.nativePapersEnabled use
Codex CLI 0.171.0. The worker sends the original UTF-8 text on stdin. It
resumes the conversation by its exact native UUID, using the existing Windows
ChatGPT authentication. The model and reasoning effort come from the Papers
runtime profile. The initial values are gpt-6.2-sol and xhigh.

Codex decides whether to ask for clarification, do public research, consult an
agent, or prepare a complete paper. Its one Papers MCP server can read the
saved context for the current conversation and stage a complete package.
Firebase retains owner authorization, lease checks, turn receipts, validation
and atomic publication of the student paper and worked answers. Existing work
uses its original lease and delivery path.

## Isolation and release status

The worker uses exec --ignore-user-config and --ignore-rules, an allowlisted
process environment, and a per-attempt read-only permission profile. It
disables host command and image tools, owner integrations and project
instruction discovery. The package tool receives only the current owner's
conversation data and has no Firebase credentials.

The CLI still loads global AGENTS.md or AGENTS.override.md from its Codex
home. The project document budget does not affect these files. Use the prepared,
owner-only Papers Codex directory on H:. Its NTFS file link points to the
existing file-backed Windows ChatGPT credential. Codex reads and refreshes the
original protected target. The worker keeps instructions and new native
conversation state in the Papers directory. The launcher passes that directory
only to the Papers process. The worker checks the active login and rejects a
production home that carries personal global instructions.

- [Codex non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode)
- [Codex CLI options](https://learn.chatgpt.com/docs/developer-commands#codex-exec)
- [Global instructions provider in Codex 0.171.0](https://github.com/openai/codex/blob/rust-v0.171.0/codex-rs/codex-home/src/instructions/mod.rs)

## Cutover after acceptance

Run the existing Windows launcher with Config, Profile and
NativeCodexExecutable and NativeCodexHome. Use the qualified executable and keep the current
pairing in its protected location. The launch profile and worker receipts
belong on H:.

Deploy the verified gateway and Hosting through the main release workflow.
Fence claims with claimsPausedUntil, confirm there is no active lease and both
Papers lanes are idle, and replace only the identified Papers worker. Verify
the new PID, heartbeat, listener and authenticated publication before enabling
native admission. Disabling the flag stops new native admissions. Queued
native work keeps its thread and worker binding.
