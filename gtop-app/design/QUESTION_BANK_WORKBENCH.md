# Question module workbench

## Navigation

The admin sidebar has one **Question bank** entry. Inside the module, four short tabs lead to **Papers**, **Coverage**, **Review**, and **Bank**. The older MCQ management route remains linked from Bank for existing edit and flag tools.

## Coverage and priorities

The left column lists bounded, paginated priority items with status and search. A chapter can also be found by exact syllabus scope. The detail panel shows live approved quiz questions, approved paper-only questions, pending drafts, and the shortfall to the admin target. Drafts do not count as approved. An admin can set a target, urgency, accepted question types, and pause or resume a priority. Creator output is traceable through the priority ID, paginated linked drafts, review status, and the last recorded run. A blocked priority retains its blocker and cannot be reopened by an ordinary save.

## Bulk review

The queue counts all pending drafts and loads 50 at a time; the filter and select-all operate on loaded rows. Selection remains available after loading the next page. Each compact row contains chapter, question, short answer, type, difficulty, marks, and destination. Details reveal options, complete solution, reference, class fit, and diagram asset. The editor is available for exceptions. Approval excludes blocked priorities, mismatched class checks, missing source evidence, invalid answers, and repeated wording in the loaded batch. A confirmation states separately how many objective items enter the learner bank and how many written items enter papers only. Each transaction rechecks the source draft, syllabus, priority, and duplicates; failures stay pending and appear individually. Rejecting multiple items requires a note.

On desktop, the selection actions sit above the rows and stay visible while scrolling. The mobile layout collapses the batch rail into a selector and pins those actions near the bottom. Solutions stay folded until a row is opened.

## Scale and release checks

The queue and bank are paginated and coverage uses server-side counts; the interface never requires rendering a chapter's target of 1,000 questions at once. Paper requests reuse stable priority IDs. Before production release, inspect desktop and phone views with 50+ pending drafts and verify objective plus written approval destinations, permissions, overflow, and the deployment version in dev.
