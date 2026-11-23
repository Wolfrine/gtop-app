# GT Papers — Intelligent Paper Library Phase 2

**Decision:** Owner approved 23 November 2026. Implement the curriculum-first library in the approved GT Papers tree-and-sage identity and existing five-tab shell. This record separates working metadata retrieval from later semantic AI proposals.

## Navigation and product semantics

- Preserve Home / Papers / Check / Inbox / Students in desktop header and mobile bottom navigation.
- Papers defaults to curriculum-aware server-indexed browsing: Board → Class → Subject → Chapter. The same paper can appear under several chapters. Earlier revisions are available via the Latest revisions control; default results show the latest family member.
- On desktop, show a curriculum navigator, contextual result list and preview of a selected **original saved paper**. On mobile, use editable curriculum chips, an expandable navigator and a preview sheet above the existing bottom bar.
- Paper actions retain existing secure Open question paper, Worked answers, Print / Save PDF and Check sheets functions. No decorative sample content is presented as an original paper; preview is fetched on explicit selection.
- Check → Choose a question paper uses the same indexed curriculum picker; Use a printed paper and previous saved-paper list remain available. Scanning, teacher mark approval and private return are not redesigned.
- Paper requests remain accessible through the previous request archive. Four real shortcuts are Browse curriculum, Recent, My papers and All revisions. Saved collections, smart AI recommendations and paper composition are NOT implemented in this phase.

## Search and data boundaries

- Existing private POST /admin/library/search provides secure server-filtered results with bounded, filter-bound cursors, explicit newest-first sort and partial coverage indicators. Search matches saved metadata words, NOT question-body full-text or semantic intent.
- POST /admin/library/facets materializes board/class/subject/chapter choices under per-scope subcollections, separately for each owner and for globally shareable paper metadata. Private papers contribute only to their owner's facet list. Admin authorization is still enforced at the gateway; no public Firestore rules are added.
- Original assistantPapers, student and answer artifacts, conversation histories, checking sheets and GTOP student submission boundaries are unchanged.
- Facet materialization is committed with new paper transactions and a one-time bounded, resumable migration over the derived paperCatalogue. No scheduler, timer, continual query or new automated test suite.
- Keep separate subject labels such as Science and Science New NCERT; expose classification-needs-review, empty and partial states. Do not claim global category counts without authorized aggregates.

## Verification and further phases

- Verify the real app on mobile and desktop, the five destinations, chapter drilldown, old-paper lookup, revision selection and secure previews. Build or screenshot evidence alone is not staff acceptance.
- A signed-in teacher should review the live interface and manually check an actual paper before final UX acceptance.
- Full-text and semantic retrieval, similarity intelligence and user-maintained collections remain Phase 3 proposals requiring separate approval.
