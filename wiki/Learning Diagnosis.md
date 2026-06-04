# Learning Diagnosis

## Definition

Learning diagnosis is GTOP's interpretation of quiz activity into learning signals: strong areas, weak areas, topics needing more practice, question patterns that confuse the student, and useful next actions.

It is the bridge between "a student took a quiz" and "the student understands what to revise next." Scores are evidence, but they are not diagnosis by themselves.

## Why It Matters

The product promise becomes stronger when students can see where effort is working and where it is not. The founder discussion specifically pushes beyond marks toward help for weak topics, multiple explanation styles, practical examples, visual summaries, and daily targets.

Diagnosis is also where GTOP can compete in an AI-era education environment without abandoning MCQ discipline. AI is useful here only when it makes feedback more accurate, clearer, or easier to act on.

## Current GTOP State

GTOP already records quiz attempts, correctness, reports, retries, and question context. That supports basic diagnosis such as wrong questions, retry targets, and performance review.

The stronger diagnosis layer is still emerging. It needs more reliable [[Question Bank Quality]], topic-level tagging, question type and pattern metadata, enough repeated [[Practice Loop]] activity, and restraint about confidence.

Current diagnosis should stay close to visible evidence: wrong questions, weak chapters, retry needs, and recent performance. Future diagnosis can become more specific, such as noticing that a student is strong on recall questions but repeatedly misses application questions in one topic, only after metadata and repeated attempts make that claim trustworthy.

## Diagnostic Signals

Useful diagnosis may include:

- Topic-level weakness and strength patterns.
- Repeated mistakes on a question type or pattern.
- Strong areas worth maintaining.
- Gaps caused by missing or weak content coverage.
- Suggested next practice that follows from recent evidence.
- Alternative explanations for a difficult concept when the student is repeatedly stuck.

## Boundaries And Non-Goals

Diagnosis should not become a black-box recommendation layer. If GTOP cannot explain why a suggestion is being made, the suggestion should be softened or avoided.

Diagnosis also should not pretend to replace teachers. It should make student effort visible and give teachers/admins better context where relevant, while keeping learner-facing feedback clear and limited to the evidence GTOP actually has.

## Relationship To Other Concepts

[[Question Bank Quality]] determines whether diagnostic signals are trustworthy. [[Practice Loop]] supplies repeated evidence. [[Student Pulse]] may package diagnosis into a concise student-facing summary. [[Product Direction]] treats diagnosis as the reason AI and metadata matter.

## Decision Guidance

Before adding a diagnostic claim, GTOP should ask: what evidence supports it, how fresh is that evidence, how trustworthy is the underlying content, and what action can the student take? If those answers are weak, the product should show review guidance rather than strong personalization.

## Source Notes

- `raw/2026-06-03-gtop-ai-meeting-notes-question-bank-pulse.md`
- `raw/2026-06-04-gtop-docs-code-education-direction-synthesis.md`
