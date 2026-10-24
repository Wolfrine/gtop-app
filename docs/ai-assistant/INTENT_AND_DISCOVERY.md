# GTOP AI Assistant & Sub-App Ecosystem — Intent and Discovery Handoff

**Status:** The private conversational Question Paper pilot was approved for implementation on 24 October 2026. See [current implementation scope](PILOT_IMPLEMENTATION.md). The discovery-only instructions below describe the earlier stage and do not undo that explicit approval.
**Source:** GTOP ChatGPT Space intent and founder discussions.  
**Space:** https://chatgpt.com/space/page_6adb22349a988191b07dddfd2455e8ef

## Product intent

GTOP remains primarily **Growth Tutorials Objective Practice**: high-quality, curriculum-aligned objective practice and student progress. Do not turn its main navigation into a growing list of unrelated modules.

Introduce a **central app launcher**, following the useful PTI multi-app navigation pattern, with separate GTOP-affiliated sub-apps and clearly scoped experiences. **Question Paper Creation** is the first candidate; answer-sheet checking, solutions, question-bank enrichment, and future needs may become their own sub-apps. Shared sign-in, access control, and context should make the ecosystem feel unified without cluttering the core practice journey.

The existing embedded question-paper workflow is to be **retired/replaced**, not replicated as the target architecture. Its complex admin forms and every-two-hours scheduled agent were unsatisfactory; the scheduled question creator has been stopped. Preserve useful requirements, bank content, and data only after auditing what exists; do not blindly delete production information or restart its schedule.

## Interaction model

The primary interface is **a real conversational AI assistant for GTOP users**. Start with admins (especially Growth Tutorials owner Aparna Tewary), then extend to other authorized roles, including teachers and learners. People should ask naturally in English or Hindi, supply files, clarify requests, receive meaningful progress, and see the completed result in the same conversation. An accessible, mobile-friendly chat should feel like talking to a helpful assistant, not filling a complex form.

The conversational brain is a **small, locally hosted LLM**. It handles dialogue, intent recognition, clarifying questions, structured task briefs, context, status explanations, and personalized help. It need not do heavy content generation or software implementation itself.

A controlled local service should invoke **Codex CLI** on demand for substantial work and report its output/status back to the correct conversation. Potential work includes question papers, worked solutions, scanned answer-sheet checking, question-bank updates, and changes to existing or new sub-apps. Use existing GTOP data and tools where useful. No arbitrary OS commands or untrusted prompts should be passed through as unrestricted execution.

**Authority boundary:** Routine, explicitly permitted personalized tasks may run one-to-one. Development, deployment, destructive database changes, high-impact or otherwise complex work must be escalated for **Sachit Tewary's explicit approval** before execution. Enforce authentication, role-based permissions, isolation between users, attachment safety, auditability, job timeouts, and cost/concurrency limits at the service layer; never trust a local LLM's self-reported authorization.

**Experience goal:** Near-immediate acknowledgment and conversational updates, with asynchronous execution and resumable jobs when Codex work takes longer. Report actual progress rather than pretending a task is finished. Evaluate reliability when the host PC is off or disconnected and when multiple remote GTOP users are active.

## Responsibilities and gates

1. **Chat:** Discuss product intent, journeys, architecture choices, and generate multi-device prototype images.
2. **Work:** Research approaches and prepare objective evaluations and required evidence before implementation.
3. **Codex:** First inspect local reality, propose a feasible architecture and staged plan; **do not develop until reviewed/approved**. Then implement against the agreed requirements, evals, and prototypes.

This division should remain explicit; initial **local-machine feasibility research is assigned to Codex** because only its local environment may expose the relevant hardware, runtimes, and CLI installation.

## Codex discovery — first task, no code changes

Inspect and report, rather than assume:

- Actual Windows hardware (CPU, RAM, GPU and VRAM), OS constraints, uptime/network setup, model runners available or feasible, and quality/latency of plausible small local LLMs for English/Hindi and structured tool handoff.
- Codex CLI installation, authentication/plan constraints, supported non-interactive invocation, streaming/events, session resumption, concurrency and approval control; prove feasibility with safe, non-mutating checks where possible.
- How the GTOP web app can securely reach a local service from remote devices; authentication, outbound connectivity, offline fallback, secrets isolation, and threat boundaries.
- Current GTOP app, legacy paper module and data, Firebase/Firestore integration, existing MCP tools, deployment method, and the PTI hub pattern as reference; identify reusable mechanisms versus migration risks.
- Workflow variants and expected cost, latency, reliability, educational quality checks, privacy, and operational overhead for each.
- An evidence-backed recommendation, unresolved questions, staged architecture/migration proposal, and acceptance criteria for the first vertical slice.

**Do not change app code, delete legacy material, resume old schedulers, deploy, or begin implementation in the discovery phase.** Present the proposed architecture for Sachit's review; Work will define independent evals, and Chat will settle experience/prototypes before Codex builds.
