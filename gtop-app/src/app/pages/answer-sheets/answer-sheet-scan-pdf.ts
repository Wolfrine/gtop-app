import { PreparedScanPage, jpegDimensions, maxScanEdge, maxScanPageBytes } from './answer-sheet-photo';
import { loadScanPdfWriter } from './answer-sheet-pdf-writer';

const marker = '%GTOP-SCAN-1 ';
const maxScanPages = 32;
const footerBytes = 4096;
const encoder = new TextEncoder();
const decoder = new TextDecoder();
type PageManifest = [offset: number, length: number, sha256: string];

async function sha256(bytes: Uint8Array): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function findBytes(document: Uint8Array, bytes: Uint8Array, start: number): number {
    for (let offset = start; offset <= document.length - bytes.length; offset++) {
        if (document[offset] === bytes[0] && document[offset + 1] === bytes[1] &&
            bytes.every((byte, position) => byte === document[offset + position])) return offset;
    }
    return -1;
}

async function writeScanPdf(pages: PreparedScanPage[]): Promise<Uint8Array> {
    // The same simple PDF can be rebuilt byte for byte before trusting a reselected file.
    const { PDFDocument } = await loadScanPdfWriter();
    const pdf = await PDFDocument.create({ updateMetadata: false });
    pdf.setTitle('GTOP scan');
    const images: Uint8Array[] = [];
    for (const entry of pages) {
        const jpeg = new Uint8Array(await entry.jpeg.arrayBuffer());
        const image = await pdf.embedJpg(jpeg);
        const scale = 842 / Math.max(entry.width, entry.height);
        const width = entry.width * scale;
        const height = entry.height * scale;
        pdf.addPage([width, height]).drawImage(image, { x: 0, y: 0, width, height });
        images.push(jpeg);
    }
    const pdfBytes = await pdf.save({ useObjectStreams: false });
    const manifest: PageManifest[] = [];
    let start = 0;
    for (const jpeg of images) {
        const offset = findBytes(pdfBytes, jpeg, start);
        if (offset < 0) throw Error('The scan PDF could not preserve the prepared pages.');
        manifest.push([offset, jpeg.length, await sha256(jpeg)]);
        start = offset + jpeg.length;
    }
    const insertion = findBytes(pdfBytes, encoder.encode('startxref\n'), Math.max(0, pdfBytes.length - 100));
    if (insertion < 0 || insertion < start) throw Error('The scan PDF could not be completed.');
    // An ordinary PDF comment after the trailer leaves every cross-reference offset intact.
    const comment = encoder.encode(marker + JSON.stringify(manifest) + '\n');
    const result = new Uint8Array(pdfBytes.length + comment.length);
    result.set(pdfBytes.subarray(0, insertion));
    result.set(comment, insertion);
    result.set(pdfBytes.subarray(insertion), insertion + comment.length);
    return result;
}

export async function buildScanPdf(pages: PreparedScanPage[]): Promise<Blob> {
    if (!pages.length || pages.length > maxScanPages) throw Error('Choose pages to include in this PDF.');
    return new Blob([await writeScanPdf(pages)], { type: 'application/pdf' });
}

export async function recoverScanPdf(file: File, limit: number): Promise<PreparedScanPage[] | undefined> {
    if (file.size > maxScanPages * maxScanPageBytes + 128 * 1024) return;
    const tail = decoder.decode(await file.slice(-footerBytes).arrayBuffer());
    const comment = /%GTOP-SCAN-1 ([^\r\n]+)\nstartxref\n\d+\n%%EOF$/u.exec(tail);
    if (!comment) return;
    try {
        const manifest: unknown = JSON.parse(comment[1]);
        if (!Array.isArray(manifest) || !manifest.length || manifest.length > limit) return;
        const pages: PreparedScanPage[] = [];
        let end = 0;
        for (const entry of manifest) {
            if (!Array.isArray(entry) || entry.length !== 3) return;
            const [offset, length, digest] = entry;
            if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) ||
                offset < end || length < 4 || length > maxScanPageBytes || offset + length > file.size ||
                typeof digest !== 'string' || !/^[a-f0-9]{64}$/u.test(digest)) return;
            end = offset + length;
            const jpeg = file.slice(offset, end, 'image/jpeg');
            const bytes = new Uint8Array(await jpeg.arrayBuffer());
            const size = jpegDimensions(bytes);
            if (!size || Math.min(size.width, size.height) < 64 || Math.max(size.width, size.height) > maxScanEdge ||
                bytes[length - 2] !== 0xff || bytes[length - 1] !== 0xd9 || await sha256(bytes) !== digest) return;
            pages.push({ jpeg, ...size });
        }
        const expected = await writeScanPdf(pages);
        if (expected.length !== file.size) return;
        const original = new Uint8Array(await file.arrayBuffer());
        if (original.every((byte, offset) => expected[offset] === byte)) return pages;
    } catch {
        // File comments are untrusted. Fall back to the ordinary PDF renderer.
    }
    return undefined;
}
