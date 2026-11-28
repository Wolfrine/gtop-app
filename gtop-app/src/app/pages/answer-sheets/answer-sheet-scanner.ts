import type { PDFDocumentProxy } from 'pdfjs-dist';
import { PhotoPage, PreparedScanPage, encodePageJpeg, maxScanEdge, maxScanSourceBytes } from './answer-sheet-photo';
import { recoverScanPdf } from './answer-sheet-scan-pdf';

const workerDirectory = '/answer-sheet-pdf/';
interface ScannedPdf {
    mode: 'pdf';
    name: string;
    file: File;
    order: number[];
    prepared?: PreparedScanPage[];
}

export interface PhotoScan {
    mode: 'photos';
    name: string;
    order: number[];
    pages: Map<number, PhotoPage>;
}

export type LocalScan = ScannedPdf | PhotoScan;

export function preparedPage(source: LocalScan, index: number): PreparedScanPage | undefined {
    const page = source.order[index - 1];
    return source.mode === 'photos' ? source.pages.get(page) : source.prepared?.[page - 1];
}

// PDF.js 5.4 shares the pages mapper across documents in one module instance.
// Only one document can be open here, including during concurrent preview clicks.
let active: { file: File; document: PDFDocumentProxy } | undefined;
let pending: Promise<unknown> = Promise.resolve();

function serial<T>(work: () => Promise<T>): Promise<T> {
    const result = pending.then(work);
    pending = result.catch(() => {});
    return result;
}

async function closeActive(): Promise<void> {
    const prior = active;
    active = undefined;
    if (prior) await prior.document.destroy();
}

export function releaseScan(source: LocalScan): Promise<void> {
    if (source.mode === 'photos') return Promise.resolve();
    return serial(async () => {
        if (source.file === active?.file) await closeActive();
    });
}

export function openScan(file: File, limit: number): Promise<ScannedPdf> {
    return serial(async () => {
        validatePdf(file);
        const prepared = await recoverScanPdf(file, limit);
        if (prepared) {
            return { mode: 'pdf', name: file.name, file, prepared, order: prepared.map((_, i) => i + 1) };
        }
        const document = await openDocument(file);
        if (!document.numPages || document.numPages > limit) {
            await closeActive();
            throw Error(limit === 1 ? 'Choose a PDF containing just the replacement page.' : 'Choose a PDF with up to ' + limit + ' pages.');
        }
        return { mode: 'pdf', name: file.name, file, order: Array.from({ length: document.numPages }, (_, i) => i + 1) };
    });
}

function validatePdf(file: File): void {
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
        throw Error('Choose a scanned PDF.');
    }
    if (!file.size || file.size > maxScanSourceBytes) throw Error('Choose a PDF up to 64 MB.');
}

async function openDocument(file: File): Promise<PDFDocumentProxy> {
    if (active?.file === file) return active.document;
    await closeActive();
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
        canvasMaxAreaInBytes: maxScanSourceBytes,
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
    active = { file, document };
    return document;
}

export function scanPage(source: LocalScan, index: number, preview = false): Promise<Blob> {
    const prepared = preparedPage(source, index);
    if (prepared) return Promise.resolve(prepared.jpeg);
    if (source.mode === 'photos') return Promise.reject(Error('This photo could not be opened.'));
    const inputPage = source.order[index - 1];
    return serial(async () => {
        const document = await openDocument(source.file);
        return drawPage(document, inputPage, index, preview);
    });
}

async function drawPage(pdf: PDFDocumentProxy, inputPage: number, index: number, preview: boolean): Promise<Blob> {
    const page = await pdf.getPage(inputPage);
    const canvas = document.createElement('canvas');
    try {
        const bounds = page.getViewport({ scale: 1 });
        const edge = preview ? 880 : maxScanEdge;
        const viewport = page.getViewport({ scale: edge / Math.max(bounds.width, bounds.height) });
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const context = canvas.getContext('2d', { alpha: false });
        if (!context || Math.min(canvas.width, canvas.height) < 64) {
            throw Error('Page ' + index + ' is too small to read. Scan it again.');
        }
        await page.render({ canvas, canvasContext: context, viewport, background: '#fff' }).promise;
        return await encodePageJpeg(canvas, index);
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
