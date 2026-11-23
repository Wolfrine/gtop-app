# GTOP answer-sheet submissions

## Staff workflow

1. Sign in to GT Papers and open **Inbox** or the **Student submissions** card on the desk. Use the invitation controls to make a private GTOP link for a pilot student or a small group. A saved paper can also supply the test link. Send invitations only to intended students. A link expires after seven days, can be revoked, and stops admitting new accounts when its places are used.
2. Direct submissions arrive under **For approval** already linked to the student's existing GTOP account. Review the answer pages. For a linked saved paper, approve an individual sheet or approve the ready submissions for the paper together.
3. For a school's question sheet, open the uploaded question pages. Prepare and confirm the reference, including the question numbers, mark allocations and any supplied marking scheme. Use a matching approved paper when appropriate. Exact copies of the confirmed question scans can reuse the paper automatically. Confirm a match when independently scanned copies differ.
4. Use **Request rescan** when a page is missing or unreadable. Choose the answer sheet or question paper, identify the affected page when possible and say what the student should change. They can replace one page or upload the whole document again.
5. Open the checked sheet when it is ready. Review flagged marks and finalize them. Return to the submission and release the marked PDF. The student receives the published version in GTOP.

## Student workflow

1. Sign in to GTOP and open **Answer Sheets**. Every GTOP role can use this area for its own scans. An invitation link can connect your GTOP account to the issuing staff inbox.
2. Attach an answer PDF and preview the page order. **Save private draft** retains the uploaded pages for your account. If an upload stops midway, keep the original PDF so you can resume it.
3. Where checking is available, attach the question paper or use the paper already supplied by an enrolled shared test. **Send for checking** shares the scans with your assigned GT Papers reviewer. **Send to Growth Tutorials** shares them with the designated central intake. Either action changes the record to **Submitted**. Staff approval starts checking.
4. Open **Answer Sheets** for status, rescan requests, and released feedback. Released results include marks and the annotated PDF.

## Access and operations

- Drafts and released results remain bound to the authenticated account UID. Staff owner indexes are created on send. The personal API has no staff capabilities, including when the account also has the GTOP admin role.
- An existing staff assignment takes precedence, including a disabled or inactive assignment. Shared test links still require enrollment into the issuing inbox. Submitting for checking requires a saved GTOP profile and an active inbox.
- To support sending without an invitation, an authorized operator can set `assistantConfig/studentSubmissions.checkingOwnerUid` to the explicitly designated GT Papers inbox owner. The gateway verifies the owner is both a GTOP admin and listed in the GT Papers pilot allowlist. An unset or inactive inbox leaves unassigned accounts in private-save mode. Changing the default affects unassigned work on its next send. Previously routed submissions and rescans keep their original owner. An active prior inbox can receive an uninvited rescan even after the default changes. An explicit disabled or conflicting assignment prevents sending until GT staff resolve it.
- The Growth Tutorials action confirms a recipient selected by the gateway and rejects a stale choice. The gateway limits new central submissions to 30 per day by default. A server-owned `checkingDailyLimit` between 1 and 150 can tune capacity. Invitation assignments and rescans are outside that shared limit. Existing per-account draft and page limits still apply. Each first send records the intake type and timestamp beside the submitting and reviewing account IDs.
- To stop new central submissions while preserving assigned traffic, clear `checkingOwnerUid`. This keeps existing submitted items and authorized rescans with their recorded reviewer.
- Setting `assistantConfig/studentSubmissions.enabled` to `false` pauses new drafts, uploads and sends. Own saved scans and released results remain available for reading. Existing teacher-uploaded checking uses its current workflow.
- Submitted scans are tied to immutable page revisions. Approval fixes the student, paper and pages for the grading attempt. The existing checking worker takes approved jobs from the owner-scoped dispatch listener. A submitted PDF may stay queued until the worker is available.
- Question material and answer scans stay in the existing private grading boundary. Student access is limited to their own uploads and released copies. Staff access is limited to their assigned inbox. The grading provider and limits are documented in [Checking handwritten answer sheets](../../question-papers/PAPER_CHECKING.md).

## Pilot checks

Use a small invited GT group. Include a saved-paper link, a school paper, an interrupted upload, a single-page rescan, a late submission and a checker restart. Compare staff handling time and mark agreement with the current checking workflow, along with turnaround and rescans.
