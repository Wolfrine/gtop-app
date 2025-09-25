# Accessibility Checklist (Phase 1)

Use this list to validate primary screens after the design system rollout.

- Keyboard navigation
  - [ ] All interactive elements reachable with Tab/Shift+Tab
  - [ ] Visible focus styles on all interactive elements
  - [ ] Escape/Enter/Space behave as expected for dialogs and buttons
- Color & contrast
  - [ ] Text contrast ≥ 4.5:1 (normal text) / 3:1 (large text)
  - [ ] Icon-only buttons have accessible labels (`aria-label`)
  - [ ] State colors (success/warning/error) meet contrast on surfaces
- Semantics
  - [ ] Proper headings structure (h1→h2→h3)
  - [ ] Regions/landmarks used where helpful (main/nav/footer)
  - [ ] Images/charts have meaningful alt/labels or are marked presentational
- Forms
  - [ ] Inputs associated with labels; helpful error messages
  - [ ] Keyboard-friendly controls (no pointer-only interactions)
- Motion
  - [ ] Respects reduced motion preferences for large transitions

Record findings in this doc and open issues for fixes.
