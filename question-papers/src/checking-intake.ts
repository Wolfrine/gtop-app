import { maxCheckingPages } from '../../assistant-service/domain/checking-limits.mjs';

export { maxCheckingPages };
export type Scan = { name: string; blob: Blob; url: string; veryDark?:boolean };

const edgeLimit = 2200;
const byteLimit = 400_000;
const fileLimit = 64 * 1024 * 1024;
const packetPdfLimit = 256 * 1024 * 1024;
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

// A dark desk border alone should never trigger a retake suggestion.
function veryDarkCentre(canvas:HTMLCanvasElement):boolean {
  const sample=document.createElement('canvas');
  sample.width=24;sample.height=24;
  const context=sample.getContext('2d',{willReadFrequently:true});
  if(!context)return false;
  context.drawImage(canvas,canvas.width*.1,canvas.height*.1,canvas.width*.8,canvas.height*.8,0,0,24,24);
  const pixels=context.getImageData(0,0,24,24).data;
  let dark=0;
  for(let i=0;i<pixels.length;i+=4){
    if(.2126*pixels[i]+.7152*pixels[i+1]+.0722*pixels[i+2]<72)dark++;
  }
  return dark>=24*24*.85;
}

async function encode(canvas: HTMLCanvasElement, name: string): Promise<Scan> {
  for (const quality of [.92, .84, .76, .68, .60]) {
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (blob && blob.size <= byteLimit) return {name, blob, url: URL.createObjectURL(blob), veryDark:veryDarkCentre(canvas)};
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

function checkSize(file: File, limit = fileLimit) {
  if (file.size > limit) throw Error('Choose a file up to '+(limit / (1024 * 1024))+' MB.');
}

async function openPdf(file: File, bytes?: ArrayBuffer, limit = fileLimit) {
  checkSize(file, limit);
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

export async function openReportPreview(blob: Blob) {
  const name = 'Checking report';
  const source = await openPdf(new File([blob], 'checking-report.pdf', {type: 'application/pdf'}));
  return {
    pageCount: source.document.numPages,
    page: (index: number) => rasterPage(source, index, name, 0),
    close: () => source.document.destroy(),
  };
}

export async function scanPdfPageCount(file: File, bytes?: ArrayBuffer): Promise<number> {
  const {document} = await openPdf(file, bytes);
  try {
    return document.numPages;
  } finally {
    await document.destroy();
  }
}

async function convertPhoto(blob: Blob, name: string, turns = 0): Promise<Scan> {
  const sourceUrl = URL.createObjectURL(blob);
  const image = new Image();
  image.src = sourceUrl;
  try {
    await image.decode().catch(() => {
      throw Error('This device could not read the photo. Export it as JPEG or PNG, or upload a scanned PDF.');
    });
    const {canvas, context} = turns % 2
      ? frame(image.naturalHeight, image.naturalWidth)
      : frame(image.naturalWidth, image.naturalHeight);
    try {
      const width = turns % 2 ? canvas.height : canvas.width;
      const height = turns % 2 ? canvas.width : canvas.height;
      context.translate(canvas.width / 2, canvas.height / 2);
      context.rotate(turns * Math.PI / 2);
      context.drawImage(image, -width / 2, -height / 2, width, height);
      return await encode(canvas, name);
    } finally {
      canvas.width = 0;
    }
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

export function rotateScan(page: Scan): Promise<Scan> {
  return convertPhoto(page.blob, page.name, 1);
}

export function isScanPdf(file: File) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

function checkPhoto(file: File) {
  checkSize(file);
  if (!/^image\/(jpeg|png|webp|avif|heic|heif)$/.test(file.type) && !acceptedImages.test(file.name)) {
    throw Error('Choose a photo or scanned PDF.');
  }
}

type OpenPdf = Awaited<ReturnType<typeof openPdf>>;

async function rasterPage(source: OpenPdf, index: number, name: string, turns: number) {
  const page = await source.document.getPage(index);
  try {
    const rotation = (page.rotate + 90 * turns) % 360;
    const bounds = page.getViewport({scale: 1, rotation});
    const viewport = page.getViewport({scale: edgeLimit / Math.max(bounds.width, bounds.height), rotation});
    const {canvas, context} = frame(viewport.width, viewport.height);
    try {
      // Tablet writing may exist solely as PDF ink annotations.
      await page.render({canvas, canvasContext: context, viewport, annotationMode: source.pdf.AnnotationMode.ENABLE}).promise;
      return await encode(canvas, name+' · '+index);
    } finally {
      canvas.width = 0;
    }
  } finally {
    page.cleanup();
  }
}

export async function packetFilePageCount(file: File) {
  if (!isScanPdf(file)) {
    checkPhoto(file);
    const url=URL.createObjectURL(file), image=new Image();
    try {
      image.src=url;
      await image.decode().catch(()=>{throw Error('This device could not read the photo. Export it as JPEG or PNG, or upload a scanned PDF.');});
      if(Math.min(image.naturalWidth,image.naturalHeight)<64)throw Error('The image is too small to read. Choose a clearer scan.');
      return 1;
    } finally {URL.revokeObjectURL(url);}
  }
  const pdf = await openPdf(file, undefined, packetPdfLimit);
  try { return pdf.document.numPages; } finally { await pdf.document.destroy(); }
}

export async function previewPacketPage(file: File, index: number, turns: number) {
  if (!isScanPdf(file)) { checkPhoto(file); return convertPhoto(file, file.name, turns); }
  const pdf = await openPdf(file, undefined, packetPdfLimit);
  try { return await rasterPage(pdf, index, file.name, turns); } finally { await pdf.document.destroy(); }
}

// The packet uploader consumes and releases each JPEG before rendering the next page.
export async function* readScanPages(file: File, available: number, packet = false, rotations?: ReadonlyMap<number, number>) {
  const checkCount = (count: number) => {
    if (count > available) throw Error(packet ? 'This file exceeds the remaining pages in the stack.' : 'Add up to '+maxCheckingPages+' pages per answer sheet.');
  };
  if (!isScanPdf(file)) {
    checkPhoto(file);
    checkCount(1);
    yield await convertPhoto(file, file.name, rotations?.get(1));
    return;
  }
  const pdf = await openPdf(file, undefined, packet ? packetPdfLimit : fileLimit);
  try {
    checkCount(pdf.document.numPages);
    for (let i = 1; i <= pdf.document.numPages; i++) {
      yield await rasterPage(pdf, i, file.name, rotations?.get(i) ?? 0);
    }
  } finally {
    await pdf.document.destroy();
  }
}

export async function scanFiles(files: File[], available: number): Promise<Scan[]> {
  const pages: Scan[] = [];
  try {
    for (const file of files) {
      for await (const page of readScanPages(file, Math.min(maxCheckingPages, available) - pages.length)) pages.push(page);
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
