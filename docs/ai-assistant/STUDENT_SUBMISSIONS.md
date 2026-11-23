# Student answer-sheet submissions

## Staff workflow

1. Sign in to GT Papers and open **Inbox** or the **Student submissions** card on the desk. Use the invitation controls to make a private GTOP link for a pilot student or a small group. A saved paper can also supply the test link. Send invitations only to intended students. A link expires after seven days, can be revoked, and stops admitting new accounts when its places are used.
2. Direct submissions arrive under **For approval** already linked to the student's existing GTOP account. Review the answer pages. For a linked saved paper, approve an individual sheet or approve the ready submissions for the paper together.
3. For a school's question sheet, open the uploaded question pages. Prepare and confirm the reference, including the question numbers, mark allocations and any supplied marking scheme. Use a matching approved paper when appropriate. Exact copies of the confirmed question scans can reuse the paper automatically. Confirm a match when independently scanned copies differ.
4. Use **Request rescan** when a page is missing or unreadable. Choose the answer sheet or question paper, identify the affected page when possible and say what the student should change. They can replace one page or upload the whole document again.
5. Open the checked sheet when it is ready. Review flagged marks and finalize them. Return to the submission and release the marked PDF. The student receives the published version in GTOP.

## Student workflow

1. Open the link shared by GT and sign in to GTOP. Open **Answer sheets** from the dashboard on later visits.
2. Attach an answer PDF. When giving a test that has no linked paper, attach the scanned question paper separately. Preview the documents and confirm the page order. If the upload stops midway, keep the original scan files so you can resume the saved draft.
3. Check the status under **Answer sheets**. A rescan request includes the staff message and the affected document. When staff release the result, open it to see the marks and save the annotated PDF.

## Access and operations

- A live GTOP learner profile plus an active enrollment controls intake. A test link selects a saved paper revision for an enrolled student. An invitation can enroll a learner into its staff owner's inbox.
- The first pilot is invitation-only. Creating a link or inviting a learner does not start grading. Setting `assistantConfig/studentSubmissions.enabled` to `false` pauses student self-submissions. Existing teacher-uploaded checking uses its current workflow.
- Submitted scans are tied to immutable page revisions. Approval fixes the student, paper and pages for the grading attempt. The existing checking worker takes approved jobs from the owner-scoped dispatch listener. A submitted PDF may stay queued until the worker is available.
- Question material and answer scans stay in the existing private grading boundary. Student access is limited to their own uploads and released copies. Staff access is limited to their assigned inbox. The grading provider and limits are documented in [Checking handwritten answer sheets](../../question-papers/PAPER_CHECKING.md).

## Pilot checks

Use a small invited GT group. Include a saved-paper link, a school paper, an interrupted upload, a single-page rescan, a late submission and a checker restart. Compare staff handling time and mark agreement with the current checking workflow, along with turnaround and rescans.
