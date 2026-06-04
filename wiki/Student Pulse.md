# Student Pulse

## Definition

Student Pulse is an exploratory GTOP concept for a concise, personalized learning summary. It should tell a student what recent practice shows, where they appear strong, where they appear weak, and what near-term practice target makes sense when the evidence is strong enough.

Pulse is not defined by a visual card or by AI generation. It is defined by whether it helps the student decide what to do next.

## Why It Matters

Students need fast orientation, not only detailed reports. A useful Pulse can turn scattered attempts into a simple learning narrative: what happened recently, what matters, and what should be practiced today or soon.

The concept carries founder urgency around student-specific support. GTOP should help students see weakness and receive explanations in more than one style, but only when the product has enough evidence to speak responsibly.

## Current GTOP State

Student Pulse is not yet a finalized product contract. It is supported by existing ingredients: attempt history, reports, correctness, retries, board/standard context, and future question metadata.

The strongest first version is likely text-first or lightly templated. Rich image cards may be useful later, but they are presentation, not the durable product promise.

Current Pulse should be modest: "your latest quiz showed weakness in this chapter; review and retry these questions." Future Pulse can become broader only when GTOP has enough attempts and trusted metadata to summarize trends across topics, explain confidence, and recommend a near-term practice target.

## Evidence And Confidence

Pulse should be grounded in [[Learning Diagnosis]]. It should use recent attempts, weak and strong areas, topic or chapter evidence, retry behavior, and confidence limits.

When student usage is sparse, Pulse should say less. It may encourage more practice, summarize only the latest attempt, or point to review/retry actions instead of generating broad claims about ability.

## Boundaries And Non-Goals

Student Pulse should not become a decorative AI report, a generic motivational message, or a substitute for reports. It should summarize and direct, not hide the evidence.

It also should not become a task tracker for the student or the GTOP team. Cadence, trigger, confidence rules, and first format remain product questions until decided.

## Relationship To Other Concepts

[[Practice Loop]] generates the activity Pulse summarizes. [[Question Bank Quality]] and [[Learning Diagnosis]] determine how trustworthy Pulse can be. [[Product Direction]] treats Pulse as a possible visible expression of practice intelligence, not as the whole strategy.

## Decision Guidance

Before shipping any Pulse behavior, GTOP should decide the minimum evidence required, how confidence is shown, and what action the student should take after reading it. A simple truthful Pulse is better than a polished one that overstates certainty.

## Source Notes

- `raw/2026-06-03-gtop-ai-meeting-notes-question-bank-pulse.md`
- `raw/2026-06-04-gtop-docs-code-education-direction-synthesis.md`
