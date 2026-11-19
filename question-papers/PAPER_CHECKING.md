# Checking answer sheets

Open **Check answer sheets** from a paper in the library, a completed conversation, or the document preview. Every sheet stays linked to the exact paper revision. Choose a separate label for each submission. Add photos or a scanned PDF, confirm page order, and select **Upload and check**. The browser converts the pages to JPEG before upload. It keeps the same page image for review, evidence markers and printing. The feature currently accepts up to 12 pages per sheet, 5 queued or active sheets per teacher and 24 grading attempts per UTC day.

The grader reads the saved questions and marking points. The review indicates when the saved scheme is incomplete. Each numbered question has a single allocation, including questions with an OR alternative. An answer can link to several pages. Unreadable, uncertain and missing answers need a teacher decision before finalization. Teachers can change an assessment, overwrite its explanation, and place or remove a marker on a page. Printing includes the marked scans and the full marking notes.

The gateway authorizes each scan and result against the signed-in teacher. It never places scan content in the paper library or client-readable notification documents. Firestore's default deny covers the new private collections. The site sends grading images to the service selected on the local host. Use anonymized sheets where possible.

## Local checking process

Use the existing paired GT Papers worker configuration with a separate operations directory on H:. Checkout source remains on F:. Run the checking entry point with the controller's Node 22 and tsx runtime.

    node --import <tsx-loader-file-url> <checkout-or-staged-source>/tools/gtop-assistant/src/checking-worker.ts <existing-worker-config> <private-checking-directory>

For Windows Task Scheduler, use wscript.exe to call start-checking.vbs with the five absolute paths for Node, the tsx loader file URL, checking-worker.ts, the existing pairing configuration, and the private checking directory. An optional sixth argument pins the engine. Use the account that already owns the pairing and the signed-in desktop Codex CLI. The checker records connectivity, queue calls, and completed attempts in checking-status.json. The paper generation service retains its own process and operations directory.

The default engine is the signed-in Codex CLI with gpt-6.2-sol and xhigh. GTOP_CHECKING_CODEX_MODEL and GTOP_CHECKING_CODEX_EFFORT override those defaults on the worker. For deliberate paid operation, set GTOP_CHECKING_ENGINE=openai-api and supply GTOP_CHECKING_API_MODEL and OPENAI_API_KEY to the worker process only. Restart the checking process to apply the settings. Missing API configuration stops startup. Each queued attempt uses one engine. A provider error leaves the sheet available for a teacher-directed retry or manual marking.

The local process listens for the existing owner-scoped Firestore dispatch marker and owns one grading attempt at a time. A lease and its expiry survive process restarts. Expired work returns to the teacher for review or explicit retry. The job timeout bounds the provider call and ephemeral Codex runs remove their temporary scan files after execution.
