# Raw Note - 2026-10-04 - Paper Chat And Bank Reuse

## Source

Founder discussion in ChatGPT Work: admin paper module simplification, followed by explicit approval to implement.

## Context

Admins struggle to navigate paper preparation, set priorities, know whether questions are complete and assemble the paper. Two or more urgent papers need real use once the feature becomes available.

## Key Points

- Admins express requirements in a conversation. A scheduled agent produces questions and the corresponding paper, then returns the result in that conversation.
- All papers remain discoverable, and the requesting admin receives notification.
- The paper should be printable and preserve required illustrations. HTML and Firebase image storage were suggested as implementation means.
- Existing generated papers may be in Google Drive; their visibility was part of initial discovery, not a confirmed migration requirement.

## Decisions

- Go ahead with the chat workflow.
- Run the scheduled agent every two hours between 8 AM and 8 PM; existing personal/project schedule uses Asia/Kolkata.
- Check and reuse suitable questions from the existing bank before creating missing questions.
- No manual approval mechanism over chat-paper questions. Question flagging may be added later.
- Preserve genuine gaps, saved results and the connection between each request and its paper. Bank content must fit the requested scope, marks and difficulty.

## Open Questions

- The specific urgent-paper requirements have not been supplied in this discussion.
- Future paper-question flagging and correction behavior remain undefined.

## Suggested Wiki Integration

Update Question Bank Quality, Decisions, Home and OpenQuestions. Supersede the earlier manual question-approval gate for the new chat-paper workflow while retaining independent syllabus trust and learner-bank controls. Delivery and verification belong in Action Plan, not the wiki.
