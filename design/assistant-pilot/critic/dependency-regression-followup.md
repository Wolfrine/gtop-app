# Dependency security regression follow-up

**Pass for the bounded regression scope; no new visual defect found.** Candidate `3881d76d38b4f9e9ab8b8598c877031fae5e7227eb715a9f1cf92e87595d6623`; observed source commit `9be7fd99b67310fdf40ad385ad5e1dfbc6d6bc28`.

Scope is the frozen dependency upgrade and explicit Angular zone provider only. No design cycle, new inference, paper mutation, code edit, build, deployment or test execution was performed by the critic. The child browser remained unavailable, so the parent operated the browser and the critic independently opened all five resulting PNGs with `view_image`:

| Parent-captured file under `design/assistant-pilot/parent-qa/` | Viewport | Critic judgment |
| --- | --- | --- |
| `patched-angular21-actual-chat-desktop.png` | 1440×1000 | Retained actual Q6 explanation has readable subscripts, time units, percentages and half-life arithmetic; conversation hierarchy and composer remain clear. |
| `patched-angular21-actual-chat-phone.png` | 390×844 | Formula/prose wrapping stays within the visible column; navigation and composer remain usable. |
| `patched-angular21-actual-answers-phone.png` | 390×844 | Actual revision-2 answers cover loads with separate document tabs, print control and accurate custom-80-mark disclaimer; this image checks the shell/cover, not all answer formulas. |
| `patched-angular21-safety-desktop.png` | 1280×720 | Valid arithmetic renders; malformed fraction, unsafe href and image markup remain literal. |
| `patched-angular21-safety-phone.png` | 390×844 | The same literal fallback is contained within the message column; the synthetic preview is labelled. |

The actual conversation captures show **Assistant offline** with a truthful waiting banner. This is not represented as a live worker/inference check. Screenshots establish visual rendering; the prior bounded formatter source review supports the safety assessment without pretending pixels prove inert DOM behavior.

Current production files `main-KWC7FPSD.js`, `styles-PRJABARU.css`, `polyfills-LVNOU2XZ.js` and local font assets are hashed from disk in the current manifest. The v2 candidate fingerprint also includes the 13 UI source/fixture files and four dependency/build configurations, so the frozen dependency source is bound explicitly rather than only through its emitted assets. The nine parent-operated/critic-viewed screenshots are recorded separately from 42 historical critic-operated screenshots. Prior bindings are retained. Package versions and the explicit `provideZoneChangeDetection()` bootstrap were inspected; the parent/builder owns the reported zero audit findings, 12 passing UI tests and passing build.

The prior 8.5/10 critic scores are retained. No claim is made that this child directly loaded the patched build in a browser or reverified all prior paper interactions. Production loading/readback, deployed worker availability, A4 pagination/PDF/physical printing, educational approval and owner release acceptance remain distinct gates.
