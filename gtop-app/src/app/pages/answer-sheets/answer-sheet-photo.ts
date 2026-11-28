export const maxScanEdge = 2200;
export const maxScanPageBytes = 400_000;
export const maxScanSourceBytes = 64 * 1024 * 1024;
export const maxPhotoBytes = 20 * 1024 * 1024;
const maxPhotoPixels = 24_000_000;

export interface PreparedScanPage {
    jpeg: Blob;
    width: number;
    height: number;
    sourceBasename?: string;
}

export interface PhotoPage extends PreparedScanPage {
    file: File;
    turns: number;
}

type Dimensions = { width: number; height: number };

export async function encodePageJpeg(canvas: HTMLCanvasElement, index: number): Promise<Blob> {
    for (const quality of [.92, .82, .72, .62, .52]) {
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
        if (blob?.type === 'image/jpeg' && blob.size <= maxScanPageBytes) return blob;
    }
    throw Error('Page ' + index + ' is too large to save clearly. Crop or rescan it.');
}

export function jpegDimensions(bytes: Uint8Array): Dimensions | undefined {
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 2;
    while (offset + 3 < bytes.length && bytes[offset++] === 0xff) {
        while (bytes[offset] === 0xff) offset++;
        const marker = bytes[offset++];
        if (offset + 2 > bytes.length || marker === 0xda || marker === 0xd9) return;
        const length = view.getUint16(offset);
        if (length < 2 || offset + length > bytes.length) return;
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
            if (length < 8) return;
            return { width: view.getUint16(offset + 5), height: view.getUint16(offset + 3) };
        }
        offset += length;
    }
    return undefined;
}

function ascii(bytes: Uint8Array, offset: number, value: string): boolean {
    return [...value].every((char, i) => bytes[offset + i] === char.charCodeAt(0));
}

function webpDimensions(bytes: Uint8Array, view: DataView): Dimensions | undefined {
    if (bytes.length < 20 || view.getUint32(4, true) + 8 !== bytes.length) return;
    let canvas: Dimensions | undefined;
    let frame: Dimensions | undefined;
    for (let offset = 12; offset + 8 <= bytes.length;) {
        const size = view.getUint32(offset + 4, true);
        const start = offset + 8;
        if (start + size > bytes.length) return;
        if (ascii(bytes, offset, 'VP8X')) {
            if (offset !== 12 || size !== 10 || (bytes[start] & 2)) return;
            canvas = {
                width: 1 + (view.getUint32(start + 4, true) & 0xffffff),
                height: 1 + (view.getUint32(start + 6, true) >>> 8),
            };
        } else if (ascii(bytes, offset, 'VP8 ')) {
            if (frame || size < 10 || bytes[start] & 1 ||
                bytes[start + 3] !== 0x9d || bytes[start + 4] !== 0x01 || bytes[start + 5] !== 0x2a) return;
            frame = { width: view.getUint16(start + 6, true) & 0x3fff, height: view.getUint16(start + 8, true) & 0x3fff };
        } else if (ascii(bytes, offset, 'VP8L')) {
            if (frame || size < 5 || bytes[start] !== 0x2f) return;
            const sizeBits = view.getUint32(start + 1, true);
            frame = { width: 1 + (sizeBits & 0x3fff), height: 1 + ((sizeBits >>> 14) & 0x3fff) };
        } else if (ascii(bytes, offset, 'ANIM') || ascii(bytes, offset, 'ANMF')) {
            return;
        }
        offset = start + size + (size % 2);
    }
    if (canvas && (frame?.width !== canvas.width || frame.height !== canvas.height)) return;
    return frame;
}

async function photoType(file: File, index: number): Promise<string> {
    // Inspect dimensions before asking the browser to allocate decoded pixels.
    const bytes = new Uint8Array(await file.arrayBuffer());
    const view = new DataView(bytes.buffer);
    let size: Dimensions | undefined;
    let type = '';
    if (bytes[0] === 0xff && bytes[1] === 0xd8) {
        type = 'image/jpeg';
        size = jpegDimensions(bytes);
    } else if (bytes.length >= 33 && view.getUint32(0) === 0x89504e47 && view.getUint32(4) === 0x0d0a1a0a &&
        view.getUint32(8) === 13 && ascii(bytes, 12, 'IHDR')) {
        type = 'image/png';
        size = { width: view.getUint32(16), height: view.getUint32(20) };
    } else if (ascii(bytes, 0, 'RIFF') && ascii(bytes, 8, 'WEBP')) {
        type = 'image/webp';
        size = webpDimensions(bytes, view);
    }
    if (!size?.width || !size.height) throw Error('Page ' + index + ' could not be read. Choose a JPG, PNG, or still WebP photo.');
    if (size.width * size.height > maxPhotoPixels) {
        throw Error('Page ' + index + ' is over 24 megapixels. Choose a smaller photo or retake it at a lower resolution.');
    }
    return type;
}

async function decodePhoto(file: Blob): Promise<{ source: ImageBitmap | HTMLImageElement; dispose: () => void }> {
    if (typeof createImageBitmap === 'function') {
        try {
            // The decoder handles EXIF, including mirrored orientations. The editor only applies manual turns.
            const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
            return { source: bitmap, dispose: () => bitmap.close() };
        } catch { /* Fall back to the browser's image decoder. */ }
    }
    const url = URL.createObjectURL(file);
    const image = new Image();
    const dispose = () => {
        image.removeAttribute('src');
        URL.revokeObjectURL(url);
    };
    try {
        await new Promise<void>((resolve, reject) => {
            image.onload = () => resolve();
            image.onerror = () => reject(Error('Photo could not be decoded.'));
            image.src = url;
        });
        return { source: image, dispose };
    } catch (error) {
        dispose();
        throw error;
    }
}

function sourceBasename(file: File): string | undefined {
    return file.name.split(/[\\/]/u).pop()?.normalize('NFC')
        .replace(/[\p{Cc}\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu, '')
        .trim().slice(0, 120) || undefined;
}

export async function preparePhoto(file: File, index: number, turns: number, signal: AbortSignal): Promise<PhotoPage> {
    signal.throwIfAborted();
    if (!file.size || file.size > maxPhotoBytes) throw Error('Choose a photo up to 20 MB for page ' + index + '.');
    const type = await photoType(file, index);
    signal.throwIfAborted();
    const decoded = await decodePhoto(file.slice(0, file.size, type)).catch(() => {
        throw Error('Page ' + index + ' could not be read. Retake or export the photo.');
    });
    const canvas = document.createElement('canvas');
    try {
        signal.throwIfAborted();
        const { source } = decoded;
        const originalWidth = 'naturalWidth' in source ? source.naturalWidth : source.width;
        const originalHeight = 'naturalHeight' in source ? source.naturalHeight : source.height;
        if (originalWidth * originalHeight > maxPhotoPixels) throw Error('Choose a smaller photo for page ' + index + '.');
        const scale = Math.min(1, maxScanEdge / Math.max(originalWidth, originalHeight));
        const width = Math.round(originalWidth * scale);
        const height = Math.round(originalHeight * scale);
        const sideways = turns % 2 !== 0;
        canvas.width = sideways ? height : width;
        canvas.height = sideways ? width : height;
        const context = canvas.getContext('2d', { alpha: false });
        if (!context || Math.min(width, height) < 64) {
            throw Error('Page ' + index + ' is too small to read. Retake or crop the photo.');
        }
        context.fillStyle = '#fff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.translate(canvas.width / 2, canvas.height / 2);
        context.rotate(turns * Math.PI / 2);
        context.drawImage(source, -width / 2, -height / 2, width, height);
        const jpeg = await encodePageJpeg(canvas, index);
        signal.throwIfAborted();
        return { jpeg, width: canvas.width, height: canvas.height, file, turns, sourceBasename: sourceBasename(file) };
    } finally {
        decoded.dispose();
        canvas.width = 0;
    }
}
