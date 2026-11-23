# GTOP Progress — Lumen design references (23 November 2026)

These are **three owner-reviewed prototype concepts**, not complete specifications. The owner observed that they look nearly identical and authorized development, with **unwanted text kept to a minimum**.

- [overview.jpg](overview.jpg): Overview-first dashboard with MCQ accuracy, written results, subject-level progress, recent history and next steps.
- [mastery.jpg](mastery.jpg): Deeper chapter/subject comparison and marks by question. Be cautious: do not display invented "overall mastery" or unsupported trends.
- [learning-story.jpg](learning-story.jpg): Recent approved feedback and actionable next steps as the primary focus.

**Implement the cleanest unified version within the actual GTOP Lumen design system** (warm ivory, sage, jade, deep green, spacious, readable typography and shared Growth Tutorials tree branding), mobile-first, then desktop. The owner has approved implementation, not any specific fake student, sample score, AI diagnosis or fabricated indicator. Use real owned MCQ results and teacher-approved written-paper grading results only.

Goal: Progress should help a learner see results, paper feedback and what they can do next, with minimal words and disclosure on demand. Respect existing quiz routes, admin view constraints and private student submissions. Separate MCQ accuracy from written marks; only use data/metadata that exist. Admin's query-param other-user reports must not gain access to someone else's private written results. Use a bounded/paginated fetch and no unbounded listeners/polling. No scheduled jobs or automated test suites per owner.

Source: original images generated and approved in the GTOP chat. Compression is for design reference only. Review after implementation.
