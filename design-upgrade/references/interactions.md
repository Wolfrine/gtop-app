# Verified interactions and unresolved controls

9 October 2026. Each result below refers to the actual visible state, not merely a completed automation command. [Gallery with logs and recordings](gallery.md) · [Live observation manifest](live-browser-observations.json).

| Reference | Action and actual result | Evidence | Status and boundary |
|---|---|---|---|
| Linear | Open Product → categorized menu; press Escape → closed menu | `linear-live-03-menu-settled.jpg`, live DOM observations | Verified desktop navigation only |
| twks | Open Projects → Services → Digital; grid changes and shows Digital chip, active count and Reset | `twks-live-02-projects.jpg` and `twks-live-03-filtered.jpg` | Verified desktop filter state; reset affordance visible, reset execution not separately tested |
| Primer | Repository sort → ascending order; second click → descending order, matching arrows | `primer-live-04-sort-settled.jpg`, `primer-live-05-descending.jpg` | Verified public table example; intermediate screenshot 03 was captured before visible settlement and is diagnostic |
| Trust | Play → introduction → first choice → Cooperate; text explains -1/+3 and highlights the numerical consequence and alternative in the diagram | `trust-live-02-choice.jpg`, `trust-live-03-feedback.jpg` | Verified first choice; no full-game or mobile-choice claim |
| DES | Three mobile touch swipes move from entry to introduction and first sculptural course card | Run `37895197290`, DES 390px, `01-before-touch` to `04-touch-scroll` | Verified emulated touch progression; supersedes the ineffective wheel attempt for mobile scroll evidence |
| Bicycle | Drag rider slider from centre to right, then left; knob and rider orientation change | Run `37895866895`, 1440px and 390px, `01-slider-neutral` / `02-slider-right` / `03-slider-left` | Verified in rendered desktop and emulated mobile views. DOM knob position also changed from 50% to approximately 88%, then 15% |
| Brilliant | Dismiss banner, then inspect settled homepage | Run `37895866895`, both viewports, `01-clean-entry.png` | Banner removal and clean layout verified |
| Brilliant | Attempt Pause activation, then a targeted hover attempt | Runs `37895197290` and `37895866895`, record failures and diagnostic screenshots | **Unresolved.** The DOM exposes a Pause label, but the rendered control had zero opacity/no pointer events and could not be activated by the attempted path. No verified pause/resume claim; subsequent subject-tab action was not reached |

The first Bicycle attempt targeted a parent area rather than the actual knob. It did not visibly change the mobile knob and could not place the desktop target reliably. Those attempts remain diagnostics. The second pass used the observed knob element and verified both its movement and the rendered scene. This is why a successful script exit cannot be treated as a successful interaction.

Brilliant remains a reference for public composition, typography, educational imagery and responsive structure. Its playback controls are excluded as a positive interaction benchmark. This unresolved control does not establish a site defect: the attempted automation path may not match the intended reveal interaction. GTOP's future media controls still need their own explicit, verified behavior.

The initial archive step failed because it lacked same-repository Actions read access. Archival run `37895676840` preserved those existing artifacts and the superseded first pass. Capture originals remain unchanged; duplicate copies of older runs accidentally bundled in the first interaction ZIPs were not added again.
