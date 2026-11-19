# Checking answer sheets

1. Open **Check papers** in GT Papers. Keep each student’s extra sheets with their answer book. Scan the class as one PDF, select photos in order, or take photos in the app. The optional **Students present** count lets you compare the physical count with the books found. On a supported device, camera photos can be resumed for 24 hours by the same signed-in teacher. Use the saved draft’s remove action on a shared device. If device storage is unavailable, keep the tab open until upload finishes.
2. Select **Find student books**. Keep the page open until the upload finishes. The checker reads labels and groups pages in the background. Open the saved stack to resolve unclear labels, split or move pages, and check any attendance discrepancy. Each stack accepts up to 200 pages and each student book up to 32.
3. Choose the exam once. Select the GT paper revision used in class, or upload the actual question paper and an optional marking scheme. Review any uncertain question text, marks or choices before using an imported paper. Start checking the class together.
4. Open **View class results**. Review flagged handwriting and missing answers against the original pages. A method mark can be corrected and moved to the relevant working. Finalize reviewed sheets and use the group finalization action for ready sheets.
5. Under **Return results**, download one ZIP with a separate marked PDF for each finalized book. The marks register is a separate teacher-only CSV and includes pending sheets. For physical handback, **Print class set** prepares one printable PDF. For digital return, give each student their own PDF from the ZIP. The class or section name appears on each student copy. Held and withdrawn books appear in the register and are excluded from the ZIP.

Use **Manage scans** for a late page, a clearer photo, or to identify a held book. For a wrong shared key, choose **Recheck with a corrected paper**. This reopens the class against the selected revision. Return updated copies to anyone who received earlier marks.

For already separated scripts, **Check answer sheets** on a saved paper still accepts individual page photos or one PDF per student. Teachers can reopen a finalized result to correct it. Download a fresh copy after finalizing again.

The gateway authorizes each scan and result against the signed-in teacher. It verifies each saved page against its upload fingerprint before serving it. It never places scan content in the paper library or client-readable notification documents. Firestore's default deny covers the new private collections. The site sends grading images to the service selected on the local host. Use anonymized sheets where possible.

## Local checking process

Use the existing paired GT Papers worker configuration with a separate operations directory on H:. Checkout source remains on F:. Run the checking entry point with the controller's Node 22 and tsx runtime.

    node --import <tsx-loader-file-url> <checkout-or-staged-source>/tools/gtop-assistant/src/checking-worker.ts <existing-worker-config> <private-checking-directory>

For Windows Task Scheduler, use wscript.exe to call start-checking.vbs with the five absolute paths for Node, the tsx loader file URL, checking-worker.ts, the existing pairing configuration, and the private checking directory. An optional sixth argument pins the engine. Use the account that already owns the pairing and the signed-in desktop Codex CLI. The checker records connectivity, queue calls, and completed attempts in checking-status.json. The paper generation service retains its own process and operations directory.

The default engine is the signed-in Codex CLI with gpt-6.2-sol and xhigh. GTOP_CHECKING_CODEX_MODEL and GTOP_CHECKING_CODEX_EFFORT override those defaults on the worker. For deliberate paid operation, set GTOP_CHECKING_ENGINE=openai-api and supply GTOP_CHECKING_API_MODEL and OPENAI_API_KEY to the worker process only. Restart the checking process to apply the settings. Missing API configuration stops startup. The gateway reserves paid attempts before dispatch. Configure `paidDailyOwnerAttempts` and `paidDailyProjectAttempts` in the server-only `assistantConfig/checking` document. Their defaults are 60 and 120 attempts per UTC day. A value of zero pauses new paid dispatches. These are attempt limits, not dollar-denominated caps. Each queued attempt uses one engine. A provider error leaves the sheet available for a teacher-directed retry or manual marking.

The local process listens for the existing owner-scoped Firestore dispatch marker and owns one grading attempt at a time. A lease and its expiry survive process restarts. Expired work returns to the teacher for review or explicit retry. The job timeout scales with the page and question counts and bounds the provider call and ephemeral Codex runs remove their temporary scan files after execution.
