# GT Papers — Phase 1 private paper catalogue

Approved 23 November 2026. The Intelligent Library design contract (owner-approved in the GT Papers conversation) controls the planned browse UX. This file records the new server/data boundary. Phase 2 remains separately approvable.

## Boundaries

- Source of truth: immutable generated documents at assistantPapers/{paperId}, their protected student/answer artifacts, original conversations, validation and accepted curriculum references. Do not rewrite these sources.
- Derived index: paperCatalogue/{paperId} (schema 1), including normalized board/class/subject, chapterKeys and per-chapter question counts, source fingerprint, revision familyId and metadata-only lookupKeys. paperCatalogueFamilies/{familyId} identifies the most recent revision. No student scans, handwritten results or complete answer text are indexed.
- One-time migration checkpoint: assistantCatalogueMigrations/generatedV1. The backfill resumes from a stable document-ID cursor; successful completion makes subsequent release invocations read only that small checkpoint. New paper completion updates the index transactionally. No scheduler, timer or background scan.
- Classification: exact supported board labels are recognized. Subject names normalize their actual raw text; Science and Science New NCERT are not silently merged. Missing source validation, chapter mismatches and invalid revision ancestry are recorded as needs_review. Verified structure is not equivalent to teacher academic approval.
- Permissions: gateway authorization requires a currently invited GTOP admin. Native-private papers remain visible to their owners only; no public Firestore reads of catalogue metadata. The existing /admin/library endpoint and immutable artifact checks remain unchanged.

## Indexed retrieval endpoint

POST /api/admin/library/search, with a signed-in authorized teacher's bearer token:

~~~json
{
  "kind":"papers",
  "filters":{
    "boardKey":"cbse","standardKey":"10","subjectKey":"science",
    "chapterKey":"electricity","academicYear":"2026-27",
    "format":"practice","ownerScope":"accessible"
  },
  "query":"",
  "latestRevisionOnly":true,
  "sort":"recent",
  "pageSize":24,
  "cursor":null
}
~~~

Each deeper curriculum filter requires the preceding board → class → subject hierarchy. The server answers using an indexed Firestore array membership and newest-first cursor, with only authorized metadata returned. The opaque cursor binds the search scope and page size. The response includes items, nextCursor, indexCoverage, isPartial, sortApplied and pageSize; no fabricated global counts or private student information.

The supported query field searches exact normalized title/board/class/subject/chapter words, not full question text. Conceptual semantic search, AI rankers, recommendations, imported school references and teacher collections remain later phases. The currently supported sort is recent. Do not imply that metadata-token search is semantic intelligence.

## Deployment

1. The existing assistant gateway deploy script provisions one additive paperCatalogue composite index (lookupKeys contains + createdAt descending) if it does not already exist; it never deletes unrelated indexes and waits for readiness.
2. The existing main backend release runs the bounded, resumable assistant-service/scripts/backfill-paper-catalogue.mjs once after gateway deployment. It reads at most 240 originals per explicit invocation, in pages of at most 40, with an auditable marker. No scheduled job is created.
3. The release uses assistant-service/scripts/verify-paper-catalogue.mjs to inspect existing original-vs-derived chapter membership and run a real authorized catalogue query. This is operational acceptance evidence, not a new test suite.
4. If a legacy record cannot be mapped safely, retain its source and mark needs_review rather than fabricating a syllabus. If the migration is incomplete, search responses signal partial index coverage.

## Next approval

Phase 2: replace the linear Papers archive and Check-paper picker with the approved curriculum-first mobile/desktop UI, maintaining all five app destinations and the existing teacher review/private-return workflows. Phase 2 is not part of this release.
