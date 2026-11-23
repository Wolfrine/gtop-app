# GT Papers workspace

GT Papers is a staff workspace for creating question papers, checking handwritten answers, and returning feedback. The design should make the next teaching task obvious and keep documents readable.

## Visual direction

The owner asked for modern, creative branding and rejected the first notebook-and-checkmark treatment. The second exploration compared Fold, Margin, and Signal. Fold was selected for the original angular monogram and its ability to support a quiet, light document workspace. The ImageGen monogram and folded-ribbon artwork are production assets. Dark indigo frames the app, a strong violet identifies the primary action, and a small citron line identifies the selected desktop destination. Colors used for correctness and feedback stay semantic.

## Interaction decisions

- Desk, Papers, Inbox and Students are stable destinations. Create and upload are actions on the desk, with a second create entry in Papers and a paper-linked upload in the preview. Phone navigation stays within reach at the bottom of the workspace.
- The desk leads with those actions, recent work and one entry to the inbox. Review rows include a paper title when it is already available to the workspace.
- Keep the paper and worked answers close to print, upload and share. On wide screens the archive or request can remain beside the document.
- Give handwritten pages the majority of the marking layout. Approving marks and releasing a marked copy are separate decisions, with a direct return to the submission inbox between them.
- Keep the install identity and start URL. Use the generated mark consistently in site branding and across the browser, Apple, and maskable app icon sizes.

## Review

Baseline source was `d4c6666`. Matched fixture and emulator captures on desktop, 390px and 320px covered the desk, creation, paper archive and preview, student lookup, uploading, and marking to release. The independent visual review rated the implemented change higher for action hierarchy, identity, and phone navigation. Wide document readability and the distinct release step were preserved. The review used synthetic papers and accounts.
