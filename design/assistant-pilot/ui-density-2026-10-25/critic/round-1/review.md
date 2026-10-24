# Round 1: compact conversation foundation

Candidate: baseline `f736109` plus designer's uncommitted A-composition implementation and parent PWA integration. Actual CUA renders inspected: ready 1440×900, 390×844 and 320×760; working 390; document and revision continuation 320. Existing long reply text was retained. Screenshots in this folder are synthetic fixture data only.

The shell is materially improved: desktop header/context use 60+64px, chat computes 14.5px/23.2px (was 16/29.6); phone chat 15px/24px with 16px gutters. Named primary paper action is now visible in the normal ready phone view. Standard document/header actions measured 44px high; page width stays 320 at the narrow viewport. Opening paper then returning and selecting revision visibly seeds/focuses the composer.

Scores: hierarchy **8**, density **7.5**, responsive usability **8**, overall **7.8**. Visual acceptance remains blocked by density, not by build/test status.

Required correction: the ready card is still roughly 247px tall on 390px phone and 194px on desktop. Long Request a revision wraps into its own 44px row; a divider plus repeated review/print helper adds more vertical objects. Use concise context-preserving actions and reduce duplicate helper text. Prose lines across the 925px desktop card alignment can become very long; preserve usable measure without restoring the baseline's empty side bands.

Generic risks: pale finished-artifact grouping **justified**; oversized default hero **resolved in working state**; duplicated ready/review instruction treatment **defective**. Retain colour/navigation/type direction, refine artifact spacing and action copy, retain distinct document view. Strongest remaining reference gap: Linear/original-prototype action economy. Highest priority is compact artifact actions without sacrificing their readable labels or tap targets.

Separate QA belongs to parent. This review does not establish Firebase auth, real paper content quality, PWA installation, A4 printing or device acceptance. Tablet/long/library and new empty/auth/error states remain unobserved for this candidate.
