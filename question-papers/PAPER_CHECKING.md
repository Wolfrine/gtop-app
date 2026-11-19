# Checking handwritten answer sheets

1. From the teaching desk, open **Check answer sheets**. Keep each student’s extra sheets with their book. Choose **Class stack** for a batch or **One student** for an individual book. Add a scan PDF, choose photos in order, or take photos in the app. If you already have separate PDFs, select **Each PDF starts a separate student’s book**. The optional number present helps reconcile the pile with attendance.
2. Choose the saved question paper used in class, or **Use a printed paper** to scan the actual paper and optional marking scheme. You can choose it before or after uploading the answer books. Resolve any uncertain questions or mark allocations on an imported paper once for the class.
3. Upload the pages and keep the tab open until they are saved. For a mixed class stack, the checker finds the student books in the background. Return from the teaching desk, resolve unclear names or page boundaries, and send the books for marking together. Each stack holds up to 200 pages and each book up to 32. On a supported device the same signed-in teacher can also resume camera photos locally for 24 hours.
4. Open the class register. Review flagged answers against the handwriting and the reason for each mark. You can hide the overlay to inspect the original, correct a mark, add a remark, and approve the result. Ready sheets support group approval.
5. Open **Return marked work**. **Download individual copies** gives you a ZIP of labelled marked PDFs. **Print a class set** produces a combined PDF for physical handback. **Download marks register** gives the teacher a CSV including pending, held and withdrawn books. Share each learner’s own copy. Only approved work appears in the student downloads.

A saved stack can be reopened for a late page, a clearer photo or a book that needs identifying. If the marking key changes, reopen the class against the corrected revision and give affected learners their updated copies.

The gateway authorizes scans and results against the signed-in teacher and verifies each saved page against its upload fingerprint. The paper library and client-readable notifications contain no student scans. The local worker sends grading images to its configured provider.

## Local checking process

Use the existing paired GT Papers worker configuration with a separate operations directory on H:. Checkout source remains on F:. Run the checking entry point with the controller's Node 22 and tsx runtime.

    node --import <tsx-loader-file-url> <checkout-or-staged-source>/tools/gtop-assistant/src/checking-worker.ts <existing-worker-config> <private-checking-directory>

For Windows Task Scheduler, use wscript.exe to call start-checking.vbs with the five absolute paths for Node, the tsx loader file URL, checking-worker.ts, the existing pairing configuration, and the private checking directory. An optional sixth argument pins the engine. Use the account that already owns the pairing and the signed-in desktop Codex CLI. The checker records connectivity, queue calls, and completed attempts in checking-status.json. The paper generation service retains its own process and operations directory.

The default engine is the signed-in Codex CLI with gpt-6.2-sol and xhigh. GTOP_CHECKING_CODEX_MODEL and GTOP_CHECKING_CODEX_EFFORT override those defaults on the worker. For deliberate paid operation, set GTOP_CHECKING_ENGINE=openai-api and supply GTOP_CHECKING_API_MODEL and OPENAI_API_KEY to the worker process only. Restart the checking process to apply the settings. Missing API configuration stops startup. The gateway reserves paid attempts before dispatch. Configure `paidDailyOwnerAttempts` and `paidDailyProjectAttempts` in the server-only `assistantConfig/checking` document. Their defaults are 60 and 120 attempts per UTC day. A value of zero pauses new paid dispatches. These are attempt limits, not dollar-denominated caps. Each queued attempt uses one engine. A provider error leaves the sheet available for a teacher-directed retry or manual marking.

The local process listens for the existing owner-scoped Firestore dispatch marker and owns one grading attempt at a time. A lease and its expiry survive process restarts. Expired work returns to the teacher for review or explicit retry. The job timeout scales with the page and question counts and bounds the provider call and ephemeral Codex runs remove their temporary scan files after execution.
