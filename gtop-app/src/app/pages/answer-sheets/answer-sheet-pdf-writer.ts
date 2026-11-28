const writerModuleUrl = '/answer-sheet-pdf/pdf-lib.esm.min.js';

export function loadScanPdfWriter(): Promise<typeof import('pdf-lib')> {
    // Leave the writer out of the PWA's prefetched application chunks.
    return import(/* @vite-ignore */ writerModuleUrl);
}
