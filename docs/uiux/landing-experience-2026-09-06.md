# GTOP landing experience

## Authorized delivery

The founder requested a complete, substantially more attractive public landing page, with generated imagery, visible background variation, intuitive presentation and memorable motion. Work autonomously through iteration and commit the finished page to main. Main deploys production. The Astra launch page is a reference for opening impact and visual staging, not a visual identity to copy.

Impact: public visitors to GTOP, especially learners in classes 5–12. Discovery: this repository, existing product capabilities and the previously inspected Astra page. Delivery: landing template, scoped styles, presentation interactions, original compressed imagery, browser review evidence and main release.

## Acceptance fixed before implementation

- A distinctive opening composition, readable heading and immediately visible start action.
- Complete dark / warm / fresh / cobalt section sequence; differentiated layouts, not repeated white cards.
- Five coordinated original generated artworks, including a dedicated mobile hero; meaningful interactive content complements the imagery.
- Real sample answer selection, explicit correct/incorrect feedback, keyboard navigation and unchanged sign-up destination.
- Existing signed-in redirect, account setup, quizzes, results and saved data retain their behavior.
- Desktop and phone review, 360px minimum layout, no horizontal overflow, usable touch targets and reduced-motion support.
- Production build, relevant behavioral checks and visual refinement before release. A completed checklist does not establish a founder rating or learner outcome.

## Visual sequence

Large midnight-blue book scene → warm illustrated subject gallery → mint sample-question stage → dark Current Lab circuit demonstration → cobalt group practice → concise questions and closing invitation.

Copy stays factual and brief. Illustrative subject artwork does not claim to be a scientific diagram. Product previews do not fabricate live participants, scores, testimonials or question counts.

## Coordination

Main baseline: `70be78ff0bb9fbc0b43cb907b070e3b381332bee`. Local source is a reconstructed snapshot; publish only intended file changes on the real GitHub parent tree. Do not push reconstructed local history.

The current browser is signed out. The Action Plan also had a previously verified deployed permissions error on `actionPlans`. Track this task here; backfill Action Plan when authorized admin access works. Do not change permissions as part of visual work.

## Review evidence

### Iteration 1

The first complete review build introduced the dark book hero, three illustrated subject panels, a mint quiz stage, dark interactive circuit, cobalt group-practice sequence, native FAQ and warm closing section. Review deployment `237f42864b0e3fbcb26a830476cb677c8342798f` passed workflow `34007665448`.

Actual desktop and phone review identified a poor mobile crop of the landscape hero, overly small supporting copy and unnecessary subject-image labels. A second generated hero was composed specifically for portrait use; text sizes increased and redundant labels were removed. Image assets retain their generated resolution, encoded as WebP: desktop hero 65 KB, mobile hero 95 KB, science 41 KB, mathematics 83 KB, biology 121 KB. The picture element selects the appropriate hero; subject images load lazily.

### Behavioral checks

- `npm run build -- --configuration production`: passed locally. Existing application bundle and unrelated component style budget warnings remain; no budget gate was relaxed.
- `node scripts/landing-contracts.test.cjs`: passed. Completed profiles still redirect to dashboard, incomplete profiles remain, later account updates cannot navigate a destroyed landing page, observer teardown works, sample retry resets feedback, sign-up still uses profile setup, and reduced-motion navigation avoids smooth scrolling.
- Source comparison: existing `ngOnInit` and `signUp` bodies unchanged; no other application component, service, scoring, permissions or saved-data logic changed.
- Browser: incorrect and correct answers, keyboard selection and reset checked; circuit switch exposes its on/off state and changes the lamp; native FAQ opens with Enter; motion pause stops decorative animations; Sign in navigates to the existing Google sign-in page without submitting credentials.
- Responsive first-pass checks at outer iframe widths 360/390/768/1024 and full desktop 1348: no horizontal overflow. Windows-style scrollbars reduce content width by 15px; the narrowest effective width tested was 345px. These are responsive browser layouts, not physical-device performance tests.
- The first browser origin retained an older PWA bundle after deployment. A fresh Firebase Hosting alias confirmed the new build. Release verification must identify the served bundle rather than infer success from CI alone.

### Final review and release

Refined candidate `063c3d16a0bb8da64b5ac369e481100431bbf457` passed workflow `34008072655`. Browser verification confirmed the new portrait picture source, larger copy, no clipped controls and minimum 44px button targets. Served candidate: `main-VCRSUFSV.js`, `styles-Q6TL6647.css`.

Final polish after this review tightens the mobile hero to 900px with a 400px portrait image and darkens the closing note from a 4.08:1 contrast combination to a darker text colour. These changes are limited to CSS; production will be rechecked after main deployment. The dev-only responsive review harness is excluded from the main tree.

Main release `7036baa32afd472e26a01eaadb044e172e666ef0` passed production workflow `34008366507`, including the exact production build and Firebase Hosting deployment. The final local rebuild was blocked by the workspace network policy for fonts.googleapis.com; the main CI build completed successfully without changing dependencies, font configuration or gates.

Verified live at https://gtop-app.web.app/: `main-VCRSUFSV.js` and `styles-ZSXSYNWC.css`, all original artwork, and the refined phone picture source. Production phone review confirmed the final 900px hero, complete book composition and 375px content width with no horizontal overflow. The shared app/services and generated syllabus remain untouched. The dev-only review harness is absent from the main release.

The founder rated the result almost 8/10, called it substantially better and accepted this version for now. The release is complete; no further visual redesign is implied by this acceptance.
