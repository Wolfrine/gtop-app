# Hosted Question Paper pilot: actual acceptance run

24 October 2026. The live app is [gtop-question-papers.web.app](https://gtop-question-papers.web.app). Hosting release `fd7834536a3802b99cc491fc578197a9e54e656d` passed [protected verification and scoped Hosting deployment](https://github.com/Wolfrine/gtop-app/actions/runs/40095388608). The gateway remains release `d5e5046`; the manual Windows controller includes `a1f5789`. GTOP core, legacy records and the stopped question scheduler were preserved.

This run used the existing invited administrator's real Google/Firebase session and the production gateway. Codex requested the acceptance paper while completing Sachit's authorized pilot. The content is real generated practice material, not a seeded UI fixture, an official board paper or Aparna's academic approval.

## What worked

- Existing Google sign-in returns to the authenticated workspace. Firebase uses same-origin redirect on the independent Hosting domain; its origin/callback were appended to the existing Google client without removing legacy entries. The [official Firebase redirect guidance](https://firebase.google.com/docs/auth/web/redirect-best-practices) explains this configuration.
- Qwen conversation and controller tools remain available while the separate Codex paper process runs. A Hindi/Hinglish syllabus/status request received the pinned ten chapters and actual running state, without changing the paper.
- Generation, independent review, one content correction and final review produced 38 questions, 80 attempted marks, ten chapters and four whole-question OR pairs. Review caught an MCQ whose wording needed “finite, nonzero” for a unique answer; final review passed.
- Delivery timed out after validation. Explicit Retry recovered the retained reviewed result in 11.250 seconds, with **no additional Codex inference**. No partially reviewed paper was published.
- A subsequent request changed only Question 6. Independent review passed. Controller comparison confirms the other 37 questions, all paper metadata and the prior stored revision are unchanged. Both revisions remain accessible through the app.
- Private student/answer documents load separately. The student copy has 38 questions and zero answer blocks. The answer document has 42 worked-answer blocks, including the four OR alternatives, and 20 objective answer keys. Neither document reported KaTeX errors. Numeric spot checks on Questions 6, 31, 32, 36 and 37 agree with the worked answers; this is not exhaustive academic certification.

## Exact acceptance messages

These three messages were authored by Codex for this authorized application check. Earlier private user conversations and identity-bearing handoffs are not copied into the now-public repository.

1. `Create an 80-mark CBSE Class 12 Chemistry Growth Tutorials practice paper covering the full 2026–27 syllabus. Use original questions, internal OR choices, a 180-minute duration, questions in English and separate complete worked answers in English. This is a custom practice paper, not the official 70-mark board format.`
2. `Paper ban raha hai? Kaun se chapters cover honge? Hindi mein batao. Paper ko badalna nahi hai.`
3. `Make only Question 6 a little harder, preserving its chapter, marks and question type. Update its answer and worked solution accordingly. Leave every other question and all paper metadata unchanged, and preserve this earlier revision.`

The local model did **not** generate the paper. Its interpretation remained fallible: it described full-paper creation as outside its own role and incorrectly denied current generation in its raw follow-up. The controller used the explicit original request for delegation and replaced the erroneous status reply with verified syllabus/execution facts. Codex received verbatim original/current requests, relevant history, the local interpretation and independently verified requirements/data/permissions. This is evidence for keeping the three roles separate, not evidence that the small model understands every request reliably.

## Measured times

Qwen: `qwen3.5:4b-q4_K_M`, Ollama loopback, 8K context, resident model. Codex: existing subscription authentication, `gpt-6.1-sol`, medium reasoning. Times below are captured stage durations; they exclude operator inspection, manual retry delay and queue waiting unless explicitly labelled.

| Operation | Model execution | Complete worker handling |
|---|---:|---:|
| Local generation-request interpretation | 8.146 s | 11.331 s |
| Local Hindi/Hinglish syllabus/status turn | 9.767 s | 11.664 s |
| Codex full generation | 205.553 s | Included below |
| Codex independent review | 18.704 s | Included below |
| Codex content correction | 101.428 s | Included below |
| Codex final review | 14.781 s | Included below |
| Original paper attempt, including delivery timeout | 340.466 s total Codex time | 397.747 s; failed safely |
| Explicit retained-result delivery retry | 0 s additional inference | 11.250 s; delivered |
| Local Question 6 revision interpretation | 10.431 s | 15.373 s |
| Codex targeted Question 6 revision | 20.300 s | Included below |
| Codex full-paper review of revision | 18.491 s | Included below |
| Revision job, generation through delivery | 38.791 s total Codex time | 56.613 s; delivered |

The first paper therefore needed about 5 minutes 40 seconds of specialist work, including a substantive correction. Ordinary local turns took roughly 8–10 seconds of inference in this run. Do not quote the earlier synthetic three-second replies as production latency for this context.

## Evidence and safeguards

Exact local prompts/responses, controller decisions, original handoffs, skill hashes, Codex command/schema/events/prompts/results and stage timings remain under the private `H:\GTOP-Local-AI\pilot-runtime\production\jobs` directory. Relevant folders are `turn-db1da4d6e784cd2c7bcc4d2a3e8711c955e28782`, `turn-dbab4b777a9560ea42461d73a0125b8eb8a1060b`, `d0f4e505-b06b-4414-bcdd-aad7f3c5be0f`, recovered job `43b1b66a-750c-43ed-8951-0e8e10442f6d`, revision turn `turn-469dd8580fac8e942b026425677643214346ab3c`, and revision job `2edcfff6-22f5-4340-b4f4-f5100f38c55a`. These paths are operator evidence, not public client endpoints.

Revision containment hashes:

- Original and backend-supplied prior revision: `6aa0fd3553a12fd31479d677412b9dfc110f91b3101747479cef68c37279e2d7`.
- Revised content: `3ed3fcde17cbda391dc3a6f1aeb84ce86b7cbd0cfe8fe901718877aac696cd5f`.
- Changed question numbers: `[6]`; the assertion and result are saved privately as `acceptance-containment.json`.

Live use exposed a separate routing defect: an earlier greeting had been accepted as paper creation because the model proposed it. Controller commit `a1f5789` now requires original-text creation evidence or a supported answer to an actual creation clarification. Regression checks cover greetings, unsolicited offers, explicit English/Hindi/Hinglish creation and clarification. Eighteen Windows controller tests pass; Linux CI skips only the Windows-specific DPAPI test. The [controller-only protected run](https://github.com/Wolfrine/gtop-app/actions/runs/40094043914) skipped both cloud deployments.

The exam-view presentation also removes generated schema/workflow directions from examination instructions and displays the controller revision, while preserving stored HTML, hashes, questions and answers. Thirteen frontend checks and the production build pass. Both frontend fixes deployed Hosting only; no gateway or core redeployment was needed. Required backend, emulator, shared permission, dependency and frontend checks remain enabled.

## Acceptance limits

Authenticated desktop (1440×1000), tablet (900×1100) and phone (390×844) views were inspected with the actual delivered paper and answers, with no outer horizontal overflow. Revised Question 6 and its complete worked answer were also inspected on the phone. Screenshots are private under `H:\GTOP-Local-AI\pilot-runtime\production\release-qa`. The documents specify A4 with 15 mm margins and support browser Print / Save PDF. Native print preview/export could not be inspected through the available automation surface. **Actual A4 pagination, PDF export and physical printing remain unverified.** Clicking Print is not treated as evidence that these passed.

Aparna must review academic correctness and classroom suitability before examination use. The PC must stay awake, online and running the manual controller; no startup service or scheduled job was introduced. Subscription limits/login failures can interrupt specialist work; there is no paid-API fallback. The delivery timeout recovered successfully, but its underlying transient cause was not proven.

The board/class/subject paper-library dashboard remains deferred. No library dashboard, migration, bank writes, attachments or new subjects were added in this completion run.
