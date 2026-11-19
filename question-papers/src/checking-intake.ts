import { maxCheckingPages } from '../../assistant-service/domain/checking-limits.mjs';

export { maxCheckingPages };
export type Scan = { name: string; blob: Blob; url: string };

const edgeLimit = 2200;
const byteLimit = 400_000;
const fileLimit = 64 * 1024 * 1024;
const acceptedImages = /\.(jpe?g|png|webp|avif|heic|heif)$/i;

function frame(width: number, height: number) {
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, edgeLimit / Math.max(width, height));
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  if (Math.min(canvas.width, canvas.height) < 64) throw Error('The image is too small to read. Choose a clearer scan.');
  const context = canvas.getContext('2d', {alpha: false});
  if (!context) throw Error('Could not prepare the scan. Try reopening the page.');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  return {canvas, context};
}

async function encode(canvas: HTMLCanvasElement, name: string): Promise<Scan> {
  for (const quality of [.92, .84, .76, .68, .60]) {
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (blob && blob.size <= byteLimit) return {name, blob, url: URL.createObjectURL(blob)};
  }
  if (Math.max(canvas.width, canvas.height) > 1650) {
    const scale = 1600 / Math.max(canvas.width, canvas.height);
    const smaller = frame(canvas.width * scale, canvas.height * scale);
    try {
      smaller.context.drawImage(canvas, 0, 0, smaller.canvas.width, smaller.canvas.height);
      return await encode(smaller.canvas, name);
    } finally {
      smaller.canvas.width = 0;
    }
  }
  throw Error('This page is too large to save legibly. Crop out the background and try again.');
}

function checkSize(file: File) {
  if (file.size > fileLimit) throw Error('Choose a file up to 64 MB.');
}

async function openPdf(file: File, bytes?: ArrayBuffer) {
  checkSize(file);
  const pdf = await import('pdfjs-dist');
  pdf.GlobalWorkerOptions.workerSrc = '/pdf-engine/pdf.worker.min.mjs';
  const task = pdf.getDocument({
    data: bytes ?? await file.arrayBuffer(), isEvalSupported: false, useWasm: false, enableXfa: false,
    cMapUrl: '/pdf-engine/cmaps/', cMapPacked: true, standardFontDataUrl: '/pdf-engine/standard_fonts/',
    canvasMaxAreaInBytes: 64 * 1024 * 1024
  });
  try {
    return {document: await task.promise, pdf};
  } catch (error) {
    await task.destroy();
    if (error instanceof Error && error.name === 'PasswordException') {
      throw Error('This PDF needs a password. Upload an unlocked copy.');
    }
    throw Error('The PDF could not be opened. Try exporting or scanning it again.');
  }
}

export async function scanPdfPageCount(file: File, bytes?: ArrayBuffer): Promise<number> {
  const {document} = await openPdf(file, bytes);
  try {
    return document.numPages;
  } finally {
    await document.destroy();
  }
}

async function convertPhoto(blob: Blob, name: string, rotate = false): Promise<Scan> {
  const sourceUrl = URL.createObjectURL(blob);
  const image = new Image();
  image.src = sourceUrl;
  try {
    await image.decode().catch(() => {
      throw Error('This device could not read the photo. Export it as JPEG or PNG, or upload a scanned PDF.');
    });
    const {canvas, context} = rotate
      ? frame(image.naturalHeight, image.naturalWidth)
      : frame(image.naturalWidth, image.naturalHeight);
    try {
      if (rotate) {
        context.translate(canvas.width, 0);
        context.rotate(Math.PI / 2);
        context.drawImage(image, 0, 0, canvas.height, canvas.width);
      } else {
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
      }
      return await encode(canvas, name);
    } finally {
      canvas.width = 0;
    }
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

export function rotateScan(page: Scan): Promise<Scan> {
  return convertPhoto(page.blob, page.name, true);
}

export async function scanFiles(files: File[], available: number): Promise<Scan[]> {
  const pages: Scan[] = [];
  const ensureSpace = (count: number) => {
    if (pages.length + count > Math.min(maxCheckingPages, available)) {
      throw Error('Add up to '+maxCheckingPages+' pages per answer sheet.');
    }
  };
  try {
    for (const file of files) {
      checkSize(file);
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const {document, pdf} = await openPdf(file);
        try {
          ensureSpace(document.numPages);
          for (let index = 1; index <= document.numPages; index++) {
            const page = await document.getPage(index);
            const bounds = page.getViewport({scale: 1});
            const viewport = page.getViewport({scale: edgeLimit / Math.max(bounds.width, bounds.height)});
            const {canvas, context} = frame(viewport.width, viewport.height);
            try {
              // A tablet-written answer can be an ink annotation over an otherwise blank page.
              await page.render({canvas, canvasContext: context, viewport, annotationMode: pdf.AnnotationMode.ENABLE}).promise;
              pages.push(await encode(canvas, file.name+' · '+index));
            } finally {
              canvas.width = 0;
              page.cleanup();
            }
          }
        } finally {
          await document.destroy();
        }
      } else {
        ensureSpace(1);
        if (!/^image\/(jpeg|png|webp|avif|heic|heif)$/.test(file.type) && !acceptedImages.test(file.name)) {
          throw Error('Choose a photo or scanned PDF.');
        }
        pages.push(await convertPhoto(file, file.name));
      }
    }
    return pages;
  } catch (error) {
    for (const page of pages) URL.revokeObjectURL(page.url);
    throw error;
  }
}

export function scanBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(Error('This scan page could not be read.'));
    reader.readAsDataURL(blob);
  });
}
