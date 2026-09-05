# Features

## Summary

GTOP's feature set is organized around practice, review, content management, and live participation. Features should serve the larger [[Product Direction]] rather than become isolated surfaces.

## Authentication And Profile Setup

Google-based sign-in and profile setup establish the student's board and standard. This gives GTOP the context needed to filter syllabus and practice experiences.

## Quick And Custom Quiz Practice

Quick Quiz supports low-friction practice by selecting available MCQs automatically. Custom Quiz supports deliberate practice by letting users filter by board, standard, subject, chapter, and question count.

Together, these modes start the [[Practice Loop]] for both spontaneous practice and targeted revision.

## Quiz Summary, Reports, And Retry

Summaries and reports close the attempt. They let students review correctness, inspect past attempts, and retry all questions or only incorrect ones.

This area should be treated as core [[Learning Diagnosis]] infrastructure, not just post-quiz display.

## Learning Lab

Learning Lab is the chosen home for interactive lessons inside GTOP, accessible to every signed-in role regardless of selected grade. The first scope is Current Lab, an electricity lesson that moves through prediction, circuit experiments, questions with explanations, and learner feedback.

The founder chose this work because real people can use a complete lesson and respond to it. Its value should be assessed through observed understanding and usability, not the novelty of a generated interface. Learners review their own progress; admins use results and account-linked feedback to improve the lesson. This adds a practical explanation path to the [[Practice Loop]] and produces bounded evidence for [[Learning Diagnosis]].

## Question Flagging

Question flagging lets students report potential MCQ issues and gives admins a signal for content review. It connects learner feedback to [[Question Bank Quality]].

## Admin Content Tools

Admin tools manage MCQs, syllabus combinations, user roles, logs, live quiz hosting, and content health. These tools support the quality and operations layer behind the student experience.

## Question Bank Enrichment

Question-bank enrichment is an emerging product capability around coverage, verification, and metadata. It should help GTOP know which boards, standards, subjects, chapters, and topics are sufficiently covered, where content is missing, and which existing questions need improvement.

Enrichment should also support diagnosis. Question type, question pattern, topic-level tags, and multiple tags can make reports and recommendations more useful than chapter-level grouping alone.

## Student Pulse

[[Student Pulse]] is an exploratory AI-assisted feedback concept inspired by periodic personal summaries. Its core promise is that a student can quickly understand recent progress and what to practice next.

Pulse depends on consistent usage, trustworthy question metadata, and careful restraint about how much certainty the product claims.

## Live Quiz And Quiz Run

[[Live Practice]] includes hosted Live Quiz events and lighter Quiz Run experiences for peer-oriented practice.

The product distinction matters: Live Quiz is admin/host-oriented; Quiz Run should feel easier for everyday participation.

## Source Notes

- `raw/2026-06-02-gtop-existing-docs-baseline.md`
- `raw/2026-06-03-gtop-ai-meeting-notes-question-bank-pulse.md`
- `raw/2026-06-04-gtop-docs-code-education-direction-synthesis.md`
- `raw/2026-09-05-learning-lab-current-lab.md`
