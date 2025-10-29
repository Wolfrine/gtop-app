# UI/UX Improvement Roadmap

## How to Use This Plan
- Phases are sequenced; complete them in order unless a dependency is explicitly noted as optional.
- Mark a phase as complete by changing `[ ]` to `[x]` in the phase headers and summary table.
- Update the "Recent Notes" section with decisions, blockers, or links to design artifacts so the next assignee has context.

## Phase Summary
| Phase | Status | Focus | Primary Outcomes |
|-------|--------|-------|------------------|
| Phase 1 | [x] | Foundations & System Setup | Design tokens, shared layout patterns, baseline accessibility checklist |
| Phase 2 | [ ] | High-Traffic Learner Journeys | Redesigned landing, onboarding, dashboard, quiz flow |
| Phase 3 | [ ] | Admin & Content Tools | MCQ management, syllabus tools, reporting dashboards |
| Phase 4 | [ ] | Feedback, Analytics & Iteration | In-app guidance, telemetry dashboards, UX analytics loops |
| Phase 5 | [ ] | Polish & Launch Readiness | Cross-browser QA, performance pass, documentation & handoff |

## Phase Details

### Phase 1 – Foundations & System Setup `[x]`
**Objective:** Establish a consistent design system and responsive layout scaffolding that all future work builds upon.

**Key Tasks**
- [ ] Audit existing global styles, typography, spacing, and color usage; document gaps vs brand targets.
- [x] Define design tokens (colors, typography scale, spacing, radii, shadows) in SCSS variables or CSS custom properties and publish in a shared tokens file.
- [x] Implement reusable layout utilities (grid, flex, responsive breakpoints) and ensure Angular Material theme alignment.
- [x] Create baseline component examples (buttons, cards) and a dev route `/dev/ui` demonstrating the updated system.
- [x] Perform initial accessibility checklist pass: focus-visible, labels for icon buttons on demo page; added global focus ring.

**Deliverables**
- Updated global style tokens & mixins.
- Living style guide (markdown or Storybook stub) referencing the new system.
- Accessibility findings list with remediation plan.

**Dependencies / Notes**
- Coordinates with design/brand stakeholders for color palette approval.
- Parallel engineering effort may be required to refactor hard-coded styles.

---

### Phase 2 – High-Traffic Learner Journeys `[ ]`
**Objective:** Elevate the core learner experience covering discovery, onboarding, and daily usage flows.

**Key Tasks**
- [x] Redesign landing page feature cards to use system AppCard; kept hero copy, ready for content pass.
- [ ] Streamline profile setup with progressive disclosure and contextual helper text.
- [x] Rework dashboard to surface actionable insights (tokenized stats, recent sessions, quick actions).
- [x] Modernize quiz flow visuals (question/option cards use AppCard; clearer spacing on mobile).
- [x] Refresh quiz summary: donut accuracy, stat chips, incorrect-only filter, polished headers, dual retry CTAs.

**Deliverables**
- Annotated mockups (desktop + mobile) for each flow.
- Implemented Angular templates/styles matching approved designs. (Landing cards, Dashboard, Quiz, Summary done)
- Updated success metrics definition (e.g., onboarding completion rate, quiz start rate).

**Dependencies / Notes**
- Requires Phase 1 tokens/utilities complete.
- Engage content team for revised copywriting and microcopy.

---

### Phase 3 – Admin & Content Tools `[ ]`
**Objective:** Improve productivity for admins managing content, syllabus, and users.

**Key Tasks**
- [ ] Redesign MCQ management tables with better filtering, bulk actions, and inline editing affordances.
- [ ] Enhance syllabus management (hierarchy navigation, versioning indicators, preview workflows).
- [ ] Improve user list & reports with advanced search, status chips, and export options.
- [ ] Standardize admin navigation and surface cross-tool shortcuts.
- [ ] Add responsive behavior ensuring admin tools are usable on tablets.

**Deliverables**
- Admin journey wireframes & interaction specs.
- Updated Angular components with refactored layout and state feedback.
- Admin-specific accessibility & performance checklist results.

**Dependencies / Notes**
- Requires data shape clarity from backend for advanced filters.
- Coordinate with analytics for actionable admin KPIs.

---

### Phase 4 – Feedback, Analytics & Iteration `[ ]`
**Objective:** Close the feedback loop and enable data-informed UX improvements.

**Key Tasks**
- [ ] Integrate lightweight in-app feedback prompts contextual to key flows.
- [ ] Configure analytics dashboards (e.g., Mixpanel/Data Studio) to track UX metrics.
- [ ] Establish usability testing cadence with scripts focusing on updated features.
- [ ] Prioritize iteration backlog from qualitative & quantitative insights.
- [ ] Implement feature flags or A/B testing harness where beneficial.

**Deliverables**
- Feedback capture widgets & storage plan.
- Analytics dashboards linked to core KPIs.
- Iteration backlog document with scoring rubric.

**Dependencies / Notes**
- Requires alignment with product and data teams on metrics definitions.
- Ensure legal/compliance review for data collection changes.

---

### Phase 5 – Polish & Launch Readiness `[ ]`
**Objective:** Finalize the experience for public rollout, ensuring quality, performance, and documentation.

**Key Tasks**
- [ ] Conduct full QA sweep (cross-browser, mobile devices, accessibility audits, localization).
- [ ] Optimize asset loading, bundle sizes, and perceived performance for redesigned views.
- [ ] Document UI coding standards, component usage guidelines, and handoff notes.
- [ ] Train support/marketing teams on new workflows and messaging.
- [ ] Plan incremental rollout strategy and monitoring.

**Deliverables**
- QA test matrix and results.
- Performance benchmark report and remediation list.
- Updated documentation pack (design system summary, implementation notes).

**Dependencies / Notes**
- Requires previous phases marked complete.
- Coordinate release timeline with product marketing.

---

## Cross-Cutting Initiatives
- Maintain a shared Figma (or equivalent) workspace linked in this document’s notes.
- Establish UI/UX review checkpoints in the PR process (design sign-off before merge).
- Ensure design tokens are consumable by both Angular and any native mobile efforts.

## Recent Notes
- 2025-09-25: Phase 1 kicked off. Added design tokens `src/styles/_tokens.scss`, utilities `src/styles/_utilities.scss`, and typography base `src/styles/_typography.scss`. Wired into `src/styles.scss`.
- 2025-09-25: Added UI Kitchen page `/dev/ui` and improved card utilities. Introduced `AppCard` directive for consistent cards; applied to Dashboard and Reports.
- 2025-09-25: Initial a11y pass completed on demo and key components (focus ring, icon button labels). Further page-level a11y checks to be iterated during Phase 2 per screen.
 - 2025-09-25: Phase 2 updates — Dashboard redesigned (stats, recent sessions, actions), side nav refined (labels, active state), Landing feature cards aligned to system, Quiz question/options use AppCard, Quiz Summary upgraded with donut chart, stat chips, incorrect-only filter, and improved accordion headers.
 - 2025-10-01: Side nav polish — icons vertically aligned with labels using `matListItemIcon`, spacing tightened; Dashboard pinned as first item for both user and admin menus; minor CSS tweaks to remove MDC start graphic and ensure consistent icon sizing.
- 2025-10-01: Profile page added — standalone `/profile` shows centered circular avatar, display name and email, and allows editing Board & Standard with save (no redirect). Header dropdown now includes a Profile link.
- 2025-10-05: Landing page hero and Live Quiz showcase refreshed with premium messaging (question bank stats, CBSE/ICSE coverage, free access promo) and new SVG art tailored for students in standards 5–12.
 - 2025-10-05: Landing hero refined to spotlight GTOP branding first, introducing a brand lockup, refreshed copy, and updated stats tying features back to Growth Tutorials.
- 2025-10-05: Landing benefits icons replaced with custom SVG set aligned to the GTOP palette so promotional blocks feel cohesive with the refreshed hero.
- 2025-10-09: Admin user list refreshed with status pills, quick stats grid, and empty state; profile admin controls gained Reset Online Status to clear stuck presence flags.
- 2025-10-12: Admin user list cards condensed for mobile — tighter header, responsive quick facts, and balanced action row so multiple users remain visible at a glance.
- 2025-10-16: Admin user list shows compact presence summaries with tap-to-expand detail drawers for quicker scanning on mobile; presence service polished and noisy console logs trimmed.
- 2025-10-18: Added unauthenticated sample quiz CTA on landing hero and wired public sample quiz flow for quick trials; documented static pool for future updates.
