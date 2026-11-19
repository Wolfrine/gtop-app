# Checking answer sheets

Open **Check answer sheets** on the paper and revision used for the exam.

- For one student, add page photos or a scanned PDF. Check the page order and orientation before uploading. The preview, model and printed copy use the same normalized scan, including visible PDF ink.
- For a class, select one PDF per student. Check the sheet labels in the upload list. Keep the tab open until the uploads finish. Queued scripts continue checking after you leave. Each script accepts up to 32 pages.
- Open a result to see the relevant answer on the original page, its score, and the reason. Follow the page references for answers continued elsewhere. Use the marking scheme to review an alternative method. A missing answer stays unresolved until the teacher confirms the copy is complete.
- Use the attention filter to find unresolved scripts. Correct the score, evidence text, explanation or marker as needed. For a choose-N section with extra attempts, select the answers to count. Finalize the sheet and use **Print / Save PDF** for the marked pages and complete notes.
- Use the sheet’s delete control to remove its scans, marks and any queued work.

The gateway authorizes each scan and result against the signed-in teacher. It verifies each saved page against its upload fingerprint before serving it. It never places scan content in the paper library or client-readable notification documents. Firestore's default deny covers the new private collections. The site sends grading images to the service selected on the local host. Use anonymized sheets where possible.

## Local checking process

Use the existing paired GT Papers worker configuration with a separate operations directory on H:. Checkout source remains on F:. Run the checking entry point with the controller's Node 22 and tsx runtime.

    node --import <tsx-loader-file-url> <checkout-or-staged-source>/tools/gtop-assistant/src/checking-worker.ts <existing-worker-config> <private-checking-directory>

For Windows Task Scheduler, use wscript.exe to call start-checking.vbs with the five absolute paths for Node, the tsx loader file URL, checking-worker.ts, the existing pairing configuration, and the private checking directory. An optional sixth argument pins the engine. Use the account that already owns the pairing and the signed-in desktop Codex CLI. The checker records connectivity, queue calls, and completed attempts in checking-status.json. The paper generation service retains its own process and operations directory.

The default engine is the signed-in Codex CLI with gpt-6.2-sol and xhigh. GTOP_CHECKING_CODEX_MODEL and GTOP_CHECKING_CODEX_EFFORT override those defaults on the worker. For deliberate paid operation, set GTOP_CHECKING_ENGINE=openai-api and supply GTOP_CHECKING_API_MODEL and OPENAI_API_KEY to the worker process only. Restart the checking process to apply the settings. Missing API configuration stops startup. The gateway reserves paid attempts before dispatch. Configure `paidDailyOwnerAttempts` and `paidDailyProjectAttempts` in the server-only `assistantConfig/checking` document. Their defaults are 60 and 120 attempts per UTC day. A value of zero pauses new paid dispatches. These are attempt limits, not dollar-denominated caps. Each queued attempt uses one engine. A provider error leaves the sheet available for a teacher-directed retry or manual marking.

The local process listens for the existing owner-scoped Firestore dispatch marker and owns one grading attempt at a time. A lease and its expiry survive process restarts. Expired work returns to the teacher for review or explicit retry. The job timeout scales with the page and question counts and bounds the provider call and ephemeral Codex runs remove their temporary scan files after execution.
