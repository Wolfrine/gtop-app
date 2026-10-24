# Density and PWA identity pass: independent prereview

Current owner verdict: **rejected**. The user reports clutter, oversized chat typography and wasted whitespace. Historical agent acceptance does not override this verdict. Source baseline `f736109`; synthetic local ready, working and empty states inspected through CUA at 1440×900 and 390×844. Screenshots: `baseline/`.

Independent critic `/root/ui_density_critic`; read-only application lane. Designer `/root/ui_designer`; parent `/root` owns PWA/assets, QA, release and final judgment. Loaded repo AGENTS, local design contract, installed Central release 0.1.0 (`ba1235fe7b220842778414f3f70fca38e7df4c53`) and critic guide; compatible Central README/protocol/routing at the same revision; GT M3 Reviewer and GT UI Checker. No owner acceptance is claimed.

## Target and pass conditions

- **Task hierarchy/clutter:** current conversation, current truthful progress and primary finished-paper action dominate; administrative shell, metadata and advice remain secondary. No equal-weight pile of duplicate explanations/actions.
- **Readable compact typography/density:** working chat 14–15px desktop and 15px phone, appropriate ~1.55–1.65 line height; compact metadata and spacing. No oversized hero in the working task. Density must not be achieved with tiny primary content.
- **Responsive usability:** 320/390px phone, 820px tablet, 1440px desktop preserve meaning and practical 44px action targets, with no page overflow. Document viewing remains a distinct useful state.

Intended eye path: current request/reply → execution/result → composer. Initial-glance prompts are hypotheses, not measured attention or comprehension.

## Actual matched references inspected

1. `linear-inbox.png` (parent's private reference folder): quiet navigation and aligned compact content rows. Retain the mechanism; do not copy angled marketing presentation, dark palette or issue semantics.
2. `claude-document-split.png` (same folder): deliberate conversation/document division and one composer; document is clearly a separate output. Do not copy large serif chat or claim its screenshot establishes GTOP functionality.
3. `docs/ai-assistant/prototypes/gtop-question-papers-multidevice.webp`: original concept shows continuous request→progress→paper and small-screen task continuity. It is a reference-only mock; do not copy fake progress, decorative setting or unavailable actions.

## Followed

The app already separates navigation, conversation and document. It exposes a clear primary View paper action, separate answers, actual job phases and keyboard-labelled controls. Phone hides navigation behind a drawer rather than shrinking a desktop rail. Practical tap boxes exist for key icon controls.

## Not followed / visible defects

1. Desktop shell spends 76px on the app header plus roughly 101px on the conversation header before the task begins. Working content is unnecessarily inset and narrow, producing empty bands rather than meaningful grouping.
2. Computed chat is **16px / 29.6px line height** on both tested sizes. Repeated bylines, 26px message gaps and large paragraph rhythm combine into tall, slow-to-scan blocks. At 390px the ready result's useful buttons fall below the conversation viewport; the screenshot shows only its upper portion.
3. Empty mobile state repeats brand mark, slogan, large heading, explanation, suggestion and curriculum note. This is more onboarding material than the single next action needs.
4. Decorative rail slogan, repeated review captions and low-contrast tiny metadata add visual objects without helping the present decision. The result area is a large coloured card around a small set of controls.

## Most relevant M3 principles

Official [typography guidance](https://material-web.dev/theming/typography/) assigns distinct roles to body, label, title and headline, with explicit size/line-height/weight. Working chat needs a body role, not presentation-style vertical rhythm. Official [colour guidance](https://material-web.dev/theming/color/) uses semantic roles for hierarchy, state and brand, including readable on-surface colours. Official [icon-button guidance](https://material-web.dev/components/icon-button/) distinguishes supplementary standard controls from higher-emphasis filled controls and requires descriptive accessible labels. Direct M3 layout links attempted returned 404; no unsupported quotation from those pages is used.

## Required structural corrections

Compress the shell to one quiet top bar and compact conversation context; reduce message leading/margins and visible repeated chrome. Keep the composer stable and make the current paper's primary action discoverable on phones. Use one coherent icon grammar and a compact mark instead of adding hero/background decoration to the working task. Render three materially different initial compositions with comparable content before selecting the implementation; palette/radius variants do not count.

Baseline scores: hierarchy **5.5**, density **4.5**, responsive usability **6.5**, overall **5.5**. No acceptance. Generic risks: repeated slogan/hero treatment **defective**; result-card grouping **justified but overpadded**; shell/navigation separation **justified and retain**. Strongest reference gap: Linear's aligned working density and the original concept's simultaneous conversation/progress/action visibility. Highest-priority change: reclaim vertical space in working mobile chat while keeping the paper action obvious.

Unobserved at prereview: tablet/320px, actual installed PWA, production identity/assets, new candidates, revised long content/library/error states. Fixture evidence is synthetic only; no production data, model ability, educational correctness or physical device acceptance is inferred.
