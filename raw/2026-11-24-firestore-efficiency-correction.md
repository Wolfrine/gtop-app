# Raw Note — 2026-11-24 — Firestore efficiency correction

## Source

Owner-approved implementation request on 24 November and completed native RCA `01a20bfd-c421-7b42-bd8e-a4da545de018`. Execution is tracked in GTOP Action Plan `UYM9i7n8yMoVHfz3t3ZU`.

## Context

GTOP recorded 69,689 Firestore read operations on 23 November IST, including 57,185 query reads. The eager full-syllabus listener existed before and after Lumen. Its measured catalogue contained 1,381 documents. Development and production both used the live database. A worker curriculum catalogue cache miss was observed. The initiating client and collection of individual bursts remain unresolved.

## Decisions

- Load the curriculum and question scope needed for the learner or teacher's current task. Preserve the complete curriculum and availability, randomized practice, academic history, and offline access.
- Require development to stay isolated from classroom data. Preserve authorization and older clients while correcting read behavior. Measure practical workflows before crediting savings.
- Retain progress and paper records and avoid destructive data changes, additional schedules, billing changes, and new paid infrastructure. PTI Home and the legacy launcher were corrected separately.

## Suggested Wiki Integration

Add the product principle to Decisions. Keep measured load evidence, query budgets, deployment and verification in the engineering standard and Action Plan.
