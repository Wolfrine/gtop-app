# Decisions

## Summary

This page records product and business decisions that should guide future GTOP work. Technical implementation decisions belong in `docs/` or engineering plans unless they materially affect product direction.

## GTOP Is Independent

GTOP is owned as an independent production application. It should not be treated as a Hub submodule.

## Hub Integration Is Contract-Based

Hub integration should remain contract-based through URL parameters and return paths. GTOP should preserve integration values such as `hubSource`, `hubSessionId`, and `hubReturnPath` when work touches quiz launch or summary flows.

## Wiki And Technical Docs Are Separate

The project wiki captures product intent, user problems, product logic, decisions, open questions, and implementation-independent lessons. Existing `docs/` captures technical and functional documentation.

## Quiz Runs Reuse Live Quiz Concepts

Quiz Run is positioned as a lighter peer-to-peer practice mode, reusing the live quiz infrastructure conceptually while avoiding unnecessary admin-host assumptions in the user experience.

## Question Bank Quality Is Ongoing

Question-bank improvement should be treated as an ongoing product capability rather than a one-time cleanup. GTOP needs both addition of missing content and improvement of existing content over time.

## Question Metadata Should Support Diagnosis

GTOP should enrich MCQs beyond chapter alignment when it improves learning diagnosis. Question type, question pattern, topic-level tagging, and multiple tags are product-relevant because they can support stronger weak-area and strong-area feedback.

## Student Pulse Remains Exploratory

Student Pulse is a product exploration area, not yet a finalized feature contract. The durable direction is personalized learning feedback; the unresolved details are cadence, format, minimum data requirements, and whether visual cards are worth the cost.

## Source Notes

- `raw/2026-06-02-gtop-existing-docs-baseline.md`
- `raw/2026-06-03-gtop-ai-meeting-notes-question-bank-pulse.md`
