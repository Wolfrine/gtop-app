# Checking handwritten answer sheets

Students with an invitation can send their own scans from GTOP. Open **Inbox** in GT Papers to review those uploads. See [Student answer-sheet submissions](../docs/ai-assistant/STUDENT_SUBMISSIONS.md) for invitations, scan corrections, checking and release.

## One student sends a PDF

1. The student scans their handwritten answers into one PDF in page order and sends it to the teacher or administrator. The student needs to sign in to GTOP once for their account to appear in the picker.
2. In GT Papers, open **Students** and enter at least two characters of their first name or surname. Use the class, board and account hint to distinguish students with the same name.
3. Select the student, choose **Check a new PDF**, attach the answer sheet and choose the question paper. Select **Send for checking**. An individual PDF can be submitted as soon as it arrives. Keep the tab open until the pages are saved. When another student sends answers for the same test, choose **Check another student** to reuse the question paper.
4. Return to **Students** to see that student's submissions to your staff account. Open the completed check to see the marks, limitations and private checking PDF. When a student was linked at intake, the report also appears in their GTOP Answer Sheets. A check without a verified account stays with the initiating staff member.

You can also begin from **Check answer sheets** on the teaching desk, or from an existing question paper with the paper preselected. Choose **Use a printed paper** to scan a question paper and optional marking scheme. GT Papers extracts the question paper automatically and returns a report if the scan cannot establish a usable marking reference.

## When a whole class hands in physical books

1. Choose **Class stack**. Add a combined scan or photos in order. If you have separate PDFs, choose **Each PDF starts a separate student’s book**. The optional number present helps reconcile the pile with attendance.
2. Upload the scans. The checker proposes the individual books in the background. Resolve unclear names and page boundaries, then send the books for marking together. A stack holds up to 200 pages and a book up to 32. On supported devices, the same signed-in teacher can resume camera photos locally for 24 hours.
3. Open the class register to see the results and any flagged answers. Booklet identity and grouping are established during intake, before grading. Checking and production of individual reports run automatically once the books have been sent.
4. Open **Return marked work**. **Download individual copies** gives the teacher a ZIP of labelled marked PDFs. **Print a class set** produces a combined PDF. **Download marks register** gives a CSV including pending, held and withdrawn books. Completed reports are downloadable. Partial assessments have no final score in the marks register.

If the pages or paper change after automatic checking begins, start a new check. The prior report retains its original evidence and marks.

The gateway authorizes scans and results against the signed-in teacher and verifies each saved page against its upload fingerprint. The paper library and client-readable notifications contain no student scans. The local worker sends grading images to its configured provider.

## Local checking process

Use the existing paired GT Papers worker configuration with a separate operations directory on H:. Checkout source remains on F:. Run the checking entry point with the controller's Node 22 and tsx runtime.

    node --import <tsx-loader-file-url> <checkout-or-staged-source>/tools/gtop-assistant/src/checking-worker.ts <existing-worker-config> <private-checking-directory>

For Windows Task Scheduler, use wscript.exe to call start-checking.vbs with the five absolute paths for Node, the tsx loader file URL, checking-worker.ts, the existing pairing configuration, and the private checking directory. An optional sixth argument pins the engine. Use the account that already owns the pairing and the signed-in desktop Codex CLI. The checker records connectivity, queue calls, and completed attempts in checking-status.json. The paper generation service retains its own process and operations directory.

The default engine is the signed-in Codex CLI with gpt-6.2-sol and xhigh. GTOP_CHECKING_CODEX_MODEL and GTOP_CHECKING_CODEX_EFFORT override those defaults on the worker. For deliberate paid operation, set GTOP_CHECKING_ENGINE=openai-api and supply GTOP_CHECKING_API_MODEL and OPENAI_API_KEY to the worker process only. Restart the checking process to apply the settings. Missing API configuration stops startup. The gateway reserves paid attempts before dispatch. Configure `paidDailyOwnerAttempts` and `paidDailyProjectAttempts` in the server-only `assistantConfig/checking` document. Their defaults are 60 and 120 attempts per UTC day. A value of zero pauses new paid dispatches. These are attempt limits, not dollar-denominated caps. Each queued attempt uses one engine. Automatic checking jobs require the ChatGPT-authenticated Codex CLI and are not claimable by a worker in API mode. Operational interruptions use bounded recovery within the lease and the existing expiry path, then return a report if assessment cannot be completed.

The local process listens for the existing owner-scoped Firestore dispatch marker and owns one grading attempt at a time. A lease and its expiry survive process restarts. One expired automatic lease is requeued. A second expiry returns an explicit unassessable report. The job timeout scales with the page and question counts and bounds the provider call and ephemeral Codex runs remove their temporary scan files after execution.

For an idle checker cutover, set a short UTC expiry in the existing pilot document field
`checkingCutoverUntil`. It fences only new checking claims, including legacy workers using the
deployed gateway. Active work can finish. Verify the checking queue has no running claims
before updating the existing task's release paths. Clear only the fence you set and start the
matching worker. The generation lane does not consume this field.
