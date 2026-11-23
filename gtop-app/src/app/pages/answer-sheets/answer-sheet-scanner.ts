import type { PDFDocumentProxy } from 'pdfjs-dist';

const workerDirectory = '/answer-sheet-pdf/';
const maxPdfSize = 64 * 1024 * 1024;
const maxPageBytes = 400_000;

export interface ScannedPdf {
    name: string;
    document: PDFDocumentProxy;
    order: number[];
}

export async function openScan(file: File, limit: number): Promise<ScannedPdf> {
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
        throw Error('Choose a scanned PDF.');
    }
    if (!file.size || file.size > maxPdfSize) throw Error('Choose a PDF up to 64 MB.');
    const bytes = await file.arrayBuffer();
    // Keep the PDF engine out of the PWA's prefetched app chunks. Load it only
    // when a student selects a PDF, from the same pinned package as the worker.
    const location = workerDirectory + 'pdf.min.mjs';
    const pdf = await import(/* @vite-ignore */ location) as typeof import('pdfjs-dist');
    pdf.GlobalWorkerOptions.workerSrc = workerDirectory + 'pdf.worker.min.mjs';
    const task = pdf.getDocument({
        data: bytes,
        isEvalSupported: false,
        useWasm: false,
        enableXfa: false,
        cMapUrl: workerDirectory + 'cmaps/',
        cMapPacked: true,
        standardFontDataUrl: workerDirectory + 'standard_fonts/',
        canvasMaxAreaInBytes: maxPdfSize,
    });
    let document: PDFDocumentProxy;
    try {
        document = await task.promise;
    } catch (error) {
        await task.destroy();
        if (error instanceof Error && error.name === 'PasswordException') {
            throw Error('Upload an unlocked copy of this PDF.');
        }
        throw Error('This PDF could not be opened. Scan or export it again.');
    }
    if (!document.numPages || document.numPages > limit) {
        await document.destroy();
        throw Error(limit === 1 ? 'Choose a PDF containing just the replacement page.' : 'Choose a PDF with up to ' + limit + ' pages.');
    }
    return { name: file.name, document, order: Array.from({ length: document.numPages }, (_, i) => i + 1) };
}

export async function scanPage(source: ScannedPdf, index: number, preview = false): Promise<Blob> {
    const page = await source.document.getPage(source.order[index - 1]);
    const canvas = document.createElement('canvas');
    try {
        const bounds = page.getViewport({ scale: 1 });
        const edge = preview ? 880 : 2200;
        const viewport = page.getViewport({ scale: edge / Math.max(bounds.width, bounds.height) });
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const context = canvas.getContext('2d', { alpha: false });
        if (!context || Math.min(canvas.width, canvas.height) < 64) {
            throw Error('Page ' + index + ' is too small to read. Scan it again.');
        }
        await page.render({ canvas, canvasContext: context, viewport, background: '#fff' }).promise;
        for (const quality of [.92, .82, .72, .62, .52]) {
            const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
            if (blob && blob.size <= maxPageBytes) return blob;
        }
        throw Error('Page ' + index + ' is too large to save clearly. Crop or rescan it.');
    } finally {
        canvas.width = 0;
        page.cleanup();
    }
}

export function encodeScan(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(Error('A scanned page could not be read.'));
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.readAsDataURL(blob);
    });
}
