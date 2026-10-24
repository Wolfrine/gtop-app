# Library prereview

Bounded follow-up requested by the UI builder after parent authorization. Preserve the accepted chat-first visual direction; do not restart visual exploration. This reviewer owns evidence only, not application code or backend permissions.

Structural guidance sent upstream before layout:

- Add one Paper library navigation entry within the existing rail, distinct from Recent conversation history.
- Use Papers/Conversations tabs with an editorial list: title first, board/class/subject second, then creator/date/revision/marks. Avoid a dashboard grid or a horizontally scrolling mobile table.
- Give each paper row a clear viewing action; keep supplementary answers/conversation access secondary. Maintain practical 44px action targets in narrow stacked rows.
- Put search first, with board/class/subject filters wrapping or contained in a labelled mobile disclosure. Tell users explicitly that filters apply only to the currently loaded items. Load more remains visible as paging, preserving selected filters.
- Distinguish an empty library, loading failure and zero matches among loaded rows. A zero loaded-match state must not claim there are no papers globally.
- Identify the creator and label cross-admin transcripts Read-only conversation near the heading. Remove composer, retry/cancel/revise controls there. Owners can continue their own conversation.
- Shared invited-administrator access requires accurate scope copy; do not claim cross-owner material is private to the signed-in account. Backend enforcement is the parent's responsibility and cannot be established by a visual fixture.
- Preserve current print v3 and the separate student/answers document presentation.

Requested review states: labelled synthetic populated library, filtering to no matches, loading, error, cross-admin read-only transcript and owner continuation. The subsequent review must inspect desktop and phone rendered evidence. Live permission claims require separate authenticated backend evidence.
