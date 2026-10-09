# Motion and scroll study

9 October 2026. Review combines preserved recordings sampled at explicit timestamps, viewport screenshots, action logs and direct control interactions. This establishes sequences and changed states. It does not establish exact easing, animation duration, frame rate, physical-device smoothness or measured comfort. The capture process itself can stall; elapsed action time is not load-time or animation-performance evidence.

[Sampling provenance](motion-frames.json) · [Control-specific results](interactions.md) · [Gallery and original recordings](gallery.md)

## Mechanisms and their relevance

| Reference | Trigger → observed change | Attention and feeling hypothesis | GTOP transfer rule | Evidence boundary |
|---|---|---|---|---|
| DES | Entrance → scattered/falling letters → ordered identity; scrolling → successive course compositions | A transition from disorder to structure can suggest discovery and organization | Express an educational idea in a brief entrance or lab introduction, with a direct route to the task | Desktop video samples at 1/3/6 seconds show the sequence, not its exact duration. Mobile touch reached content after wheel input failed to do so |
| twks | Hero media changes in live view; Services → Digital → changed project set and an active chip | The imagery draws attention; the filter feedback conveys control over the collection | Let content supply expression, and make every active filter visible and reversible | Incomplete CI hero video prevents a defensible timing/smoothness judgment; desktop filter states were inspected separately |
| Linear | Product click → grouped menu; Escape → closed menu | Expansion reveals options without replacing the whole page; restraint may support a sense of precision | Use local, interruptible navigation and stable hierarchy | Menu state verified; authenticated product transitions and repeat-use tasks not inspected |
| Bicycle | Animated rider is paired with a control; slider manipulation receives a targeted capture | A visible response close to a control may make a mechanism tangible | Motion should explain a variable, with labels and a stable explanation nearby | Source drawings render in isolated Chromium; software rendering is not a performance benchmark. See interaction register for verified manipulation versus failed attempts |
| Trust | Cooperate choice → explanation and highlighted -1/+3 consequence alongside the alternative | Stable surroundings keep attention on what changed and why; a playful treatment may lower intimidation | Connect question, chosen action and explanation instead of sending feedback elsewhere | First choice only; before/after states were inspected live. Exact transition timing and the full game were not tested |
| Primer | Repository click → sort arrow and row order change; second click reverses order | Small, localized feedback makes the action's consequence traceable | Status and sort feedback should be visible without cinematic transitions | Verified public example, not a complete admin journey; no separate animation rating |
| Brilliant | Autoplay demonstration changes math scenes; Pause activation remains unresolved after the targeted checks | Demonstration can spark curiosity; playback control can preserve agency | Keep demonstrations optional and essential content independently readable | Embedded demonstration cursor is media content, not reviewer input. Public page only; no verified pause/resume result |

## Scroll and interruption observations

The common capture sequence requests three slow scroll advances, one fast advance, reversal, then return to the start. Logs record the request and the following screenshot. Names such as `08-return` express an **attempt**, not a guarantee of the achieved position. Inspect the pixels and scroll state before making a conclusion.

- DES desktop reached its course/footer compositions, but the Home/scrollTo attempt did not reliably restore its entry. Mobile wheel input stayed at the entry; the later touch-swiping capture reached the introduction and sculptural course card. The generic mobile sequence is not proof of a broken site.
- Linear, twks, Bicycle, Primer and Brilliant yielded distinct down-page/reversal content. This supports the inspected navigation sequence, not every possible interruption or scroll speed.
- Trust is a fixed game stage. Its unchanged wheel snapshots do not indicate a scrolling failure; Play is the relevant progression control.
- Lando and Igloo have partial mobile scene sequences but incomplete desktop captures. Their original videos remain available as diagnostics; neither is a complete motion benchmark.

## Reduced-motion preference check

The generic pass enabled `prefers-reduced-motion: reduce`, reloaded, and preserved the resulting video segment and entry screenshot. The JSON confirms the preference was enabled for the seven core references. **That flag is not a compliance result.**

| Reference | What the captured evidence permits |
|---|---|
| DES | A moving-letter entrance appears again in the reload segment after the preference request. Do not assume the entrance is suppressed; no full accessibility verdict is made |
| twks | Media delivery is inconsistent in this capture. Reduced-motion behavior is unresolved |
| Linear | The sampled reload frames retain readable content. Still frames do not prove that all transitions stop or shorten |
| Bicycle | The simulation remains present; this study does not establish how all simulation/interaction motion responds to the preference |
| Trust | Opening character arrangements change in the sampled post-preference sequence. A static alternative or preference response has not been established |
| Primer | Readable table content remains available. A largely static example does not establish whole-system motion conformance |
| Brilliant | The demonstration shows different math scenes in post-preference frames. Do not assume autoplay is disabled by the preference; examine the explicit media control separately |

For GTOP, any proposed nonessential motion needs a defined reduced-motion alternative and a direct interaction check at implementation. Essential conceptual information must survive without relying solely on animation. This is a design requirement for later work, not an assertion that any reference has passed or failed a formal accessibility audit.
