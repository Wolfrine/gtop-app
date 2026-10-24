# Focused chat-math review

Scope: only the frozen assistant math presentation at source commit `29ddddbb558a1f12b6369f92f135105ed2eb155a`. No inference, message submission, paper mutation, application edits, build, deployment or full repetition of prior visual cycles.

**Result: focused visual/static pass, no blocker identified.** Final candidate SHA: `15efd8cdb260aedf830c35ff252e5df6bf22a388f30323ff71e4ff5c3decfa0a`.

## Rendered evidence

The child browser inventory was empty and documented fresh-tab/current-ID recovery attempts failed. The parent captured the following actual rendered browser images; the critic independently opened all four using `view_image` and judged them visually:

- `design/assistant-pilot/parent-qa/actual-local-explanation-math-desktop.png`: retained real local-model explanation from the isolated emulator conversation. Temperature subscripts, percentages, half-life and time units render legibly alongside prose and bullets.
- `design/assistant-pilot/parent-qa/actual-local-explanation-math-phone.png`: same actual explanation at 390px. Equation segments wrap with the prose without visible page overflow; composer and navigation remain accessible.
- `design/assistant-pilot/parent-qa/chat-math-safety-fixture-desktop.png`: labelled fixture with retained actual explanation and additional synthetic hostile/malformed cases. Valid arithmetic renders; malformed fraction, unsafe href and image markup remain visibly literal.
- `design/assistant-pilot/parent-qa/chat-math-safety-fixture-phone.png`: same fallback cases at 390px. Literal fallback wraps within the message column and the footer/composer remain usable. Synthetic preview banner remains explicit.

Capture attribution is parent-operated browser, critic visual judgment. No claim is made that this child directly interacted with the new math UI. The manifest separately records the four parent-captured image hashes rather than presenting them as critic-operated screenshots. The previous actual-paper desktop/tablet/phone checks remain preserved and were not rerun.

## Source verification

Inspected `question-papers/src/chat-math.mjs`, `chat-math.directive.ts`, `presentation.mjs`, `workspace.html`, `styles.css`, the actual-Q6 fixture provenance JSON and relevant UI test definitions. Valid assistant formulas are isolated before basic prose formatting, parsed by KaTeX with `trust:false`, `strict:'error'`, bounded expansion/size/output and escaped literal fallback. Known URL/HTML insertion commands are rejected. Only assistant messages receive the directive; user messages retain verbatim interpolation. Local KaTeX CSS is listed in Angular styles. No concrete unsafe insertion path was found in this bounded review; screenshot appearance is not substituted for DOM safety proof.

The fixture embeds an exact retained local-model reply, message `6c62f1a9-55b9-44df-91b8-5228e9914160`, responding to a synthetic request in isolated emulators. It is not a replayed inference or production user conversation. Extra malformed/hostile samples are synthetic. The fixture transport remains replaced in production configuration.

The parent/builder reported 12 passing UI tests and a passing production build. The critic inspected the relevant test definitions but did not run that suite or a new inference. Current on-disk assets `main-AVNND7VN.js`, `styles-HDCIKMMS.css` and bundled font files are hashed in the manifest.

Residual limits: this is a finite sample of chat formulas, not proof of all future TeX/layout behavior. New production browser loading/readback is parent-owned. A4 pagination/PDF/physical printing, academic approval and owner release acceptance remain separate gates.
