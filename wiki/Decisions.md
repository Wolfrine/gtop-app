# Decisions

## Summary

This page records product and business decisions that should guide future GTOP work. Technical implementation decisions belong in `docs/` or engineering plans unless they materially affect product direction.

## Current Strategic Bets

GTOP's current product bets are not independent feature ideas; they build on each other. Question-bank quality enables better metadata. Better metadata enables topic-level diagnosis. Repeated student usage gives diagnosis enough signal. AI-assisted feedback becomes valuable when it sits on that foundation and helps students understand weak areas, strong areas, and next practice.

Future agents should treat these as strategic anchors: question-bank quality, ongoing enrichment, student usage, learning diagnosis, AI-assisted feedback, and future-ready education direction.

## GTOP Is Independent

GTOP is owned as an independent production application. It should not be treated as a Hub submodule.

## Hub Integration Is Contract-Based

Hub integration should remain contract-based through URL parameters and return paths. GTOP should preserve integration values such as `hubSource`, `hubSessionId`, and `hubReturnPath` when work touches quiz launch or summary flows.

## Wiki And Technical Docs Are Separate

The project wiki captures product intent, user problems, product logic, decisions, open questions, and implementation-independent lessons. Existing `docs/` captures technical and functional documentation.

## Quiz Runs Reuse Live Quiz Concepts

Quiz Run is positioned as a lighter peer-to-peer practice mode, reusing the live quiz infrastructure conceptually while avoiding unnecessary admin-host assumptions in the user experience.

## Question Bank Quality Is Ongoing

Question-bank improvement should be treated as an ongoing product capability rather than a one-time cleanup. GTOP needs both addition of missing content and improvement of existing content over time. The decision is product-level because a large, trusted question bank is the base for student trust, reports, topic diagnosis, and any serious AI-assisted guidance.

## Question Metadata Should Support Diagnosis

GTOP should enrich MCQs beyond chapter alignment when it improves learning diagnosis. Question type, question pattern, topic-level tagging, and multiple tags are product-relevant because they can support stronger weak-area and strong-area feedback.

## Student Pulse Remains Exploratory

Student Pulse is a product exploration area, not yet a finalized feature contract. The durable direction is personalized learning feedback; the unresolved details are cadence, format, minimum data requirements, and whether visual cards are worth the cost.

## AI Must Serve Learning Diagnosis

AI should be used where it improves GTOP's learning product: classifying question types and patterns, enriching topic tags, explaining weak topics in multiple ways, and producing concise student-specific feedback. AI novelty by itself is not a decision anchor.

## Future-Ready Education Direction Is A Strategy Question

GTOP should study what students may expect from education products over the next decade and use that thinking to shape product bets. This is a strategic direction, not a wiki todo list or a commitment to any specific AI feature.

## Source Notes

- `raw/2026-06-02-gtop-existing-docs-baseline.md`
- `raw/2026-06-03-gtop-ai-meeting-notes-question-bank-pulse.md`
