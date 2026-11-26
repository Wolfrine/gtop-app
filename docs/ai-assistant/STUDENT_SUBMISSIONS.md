# GTOP answer-sheet submissions

## Staff workflow

1. Sign in to GT Papers and open **Inbox** or the **Student submissions** card on the desk. Use the invitation controls to make a private GTOP link for a pilot student or a small group. A saved paper can also supply the test link. Send invitations only to intended students. A link expires after seven days, can be revoked, and stops admitting new accounts when its places are used.
2. Direct submissions arrive under **For approval**, linked to the submitting GTOP account. Choose **Approve & check** once. A shared test uses its saved paper revision. An uploaded question scan is read and checked for consistent allocations in the same approved workflow.
3. The existing ChatGPT-authenticated checker reads the original answer pages, awards marks, flags unattempted or unresolved answers and prepares a private checking report. A demonstrably blank answer earns zero. Unreadable or missing evidence does not earn or lose marks. An over-attempted section uses the applicable, explicit choice policy when the evidence supports it.
4. The inbox and the student's Answer Sheets show the result automatically. If some questions cannot be assessed, the report includes supported marks and explains the limits. It has no final score. An unassessable paper still returns a report with the reason. Optional discussion or a new submission can happen after handback.


## Student workflow

1. Sign in to GTOP and open **Answer Sheets**. Every GTOP role can use this area for its own scans. An invitation link can connect your GTOP account to the issuing staff inbox.
2. Attach an answer PDF and preview the page order. **Save private draft** retains the uploaded pages for your account. If an upload stops midway, keep the original PDF so you can resume it.
3. Where checking is available, attach the question paper or use the paper already supplied by an enrolled shared test. **Send for checking** shares the scans with your assigned GT Papers reviewer. **Send to Growth Tutorials** shares them with the designated central intake. Either action changes the record to **Submitted**. Staff approval starts checking.
4. Open **Answer Sheets** for status, rescan requests, and checking reports. A report includes the annotated PDF where scans could be used, per-question feedback and a final mark when it can be established.

## Access and operations

- Drafts and released results remain bound to the authenticated account UID. Staff owner indexes are created on send. The personal API has no staff capabilities, including when the account also has the GTOP admin role.
- An existing staff assignment takes precedence, including a disabled or inactive assignment. Shared test links still require enrollment into the issuing inbox. Submitting for checking requires a saved GTOP profile and an active inbox.
- To support sending without an invitation, an authorized operator can set `assistantConfig/studentSubmissions.checkingOwnerUid` to the explicitly designated GT Papers inbox owner. The gateway verifies the owner is both a GTOP admin and listed in the GT Papers pilot allowlist. An unset or inactive inbox leaves unassigned accounts in private-save mode. Changing the default affects unassigned work on its next send. Previously routed submissions and rescans keep their original owner. An active prior inbox can receive an uninvited rescan even after the default changes. An explicit disabled or conflicting assignment prevents sending until GT staff resolve it.
- The Growth Tutorials action confirms a recipient selected by the gateway and rejects a stale choice. The gateway limits new central submissions to 30 per day by default. A server-owned `checkingDailyLimit` between 1 and 150 can tune capacity. Invitation assignments and rescans are outside that shared limit. Existing per-account draft and page limits still apply. Each first send records the intake type and timestamp beside the submitting and reviewing account IDs.
- To stop new central submissions while preserving assigned traffic, clear `checkingOwnerUid`. This keeps existing submitted items and authorized rescans with their recorded reviewer.
- Setting `assistantConfig/studentSubmissions.enabled` to `false` pauses new drafts, uploads and sends. Own saved scans and released results remain available for reading. Existing teacher-uploaded checking uses its current workflow.
- Submitted scans are tied to immutable page revisions. Approval fixes the student, paper and pages for the grading attempt. A checker advertising automatic-checking-v1 takes the approved attempt from the existing owner-scoped dispatch listener. Approved question preparation transfers its queue slot to answer grading in one transaction. A submitted PDF may stay queued until the worker is available.
- Question material and answer scans stay in the existing private grading boundary. Student access is limited to their own uploads and released copies. Staff access is limited to their assigned inbox. The grading provider and limits are documented in [Checking handwritten answer sheets](../../question-papers/PAPER_CHECKING.md).

## Release verification

Use a small invited GT group. Include a saved-paper link, a school paper, a genuine blank answer, unreadable work, an unsafe or unusable scan and a checker restart. Verify same-account access, denial to another student, stale-lease rejection and the contents of the returned PDF.
