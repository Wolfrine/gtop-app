import * as pdfLib from 'pdf-lib';
import { renderCheckedReturn } from '../../assistant-service/domain/checked-return-pdf.mjs';
import { scanBlobInk } from './checking-ink';
import type { ReturnDetail } from './class-return-data';

function browserTextFallback() {
  let canvas: HTMLCanvasElement | undefined;
  const context = (size: number, bold: boolean) => {
    canvas ??= document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw Error('This browser could not render the marking notes.');
    ctx.font = `${bold ? 700 : 400} ${size}px Arial, sans-serif`;
    return ctx;
  };
  return {
    measure(value: string, size: number, bold: boolean) {
      return context(size, bold).measureText(value).width;
    },
    async rasterize(value: string, size: number, bold: boolean, color: {red: number; green: number; blue: number}) {
      const scale = 3;
      const ctx = context(size * scale, bold);
      const width = Math.ceil(ctx.measureText(value).width) + 4 * scale;
      const height = Math.ceil(size * scale * 1.7);
      const target = ctx.canvas;
      target.width = width;
      target.height = height;
      try {
        context(size * scale, bold);
        ctx.fillStyle = `rgb(${Math.round(color.red * 255)},${Math.round(color.green * 255)},${Math.round(color.blue * 255)})`;
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(value, 2 * scale, size * scale * 1.05);
        const blob = await new Promise<Blob>((resolve, reject) =>
          target.toBlob((image) => image ? resolve(image) : reject(Error('Could not render a marking note.')), 'image/png'),
        );
        return {bytes: new Uint8Array(await blob.arrayBuffer()), width: width / scale, height: height / scale};
      } finally {
        target.width = target.height = 1;
      }
    },
  };
}

export async function markedCopy(
  detail: ReturnDetail,
  getPage: (index: number) => Promise<Blob>,
  checkActive: () => void,
) {
  const { sheet } = detail;
  if (sheet.state !== 'final' || !sheet.grade || sheet.grade.pending)
    throw Error('This sheet is still awaiting final marks.');
  const scans = [...sheet.uploaded].sort((a, b) => a.index - b.index);
  if (!scans.length || scans.length !== sheet.pageCount || scans.some((scan, i) => scan.index !== i + 1 || !scan.width || !scan.height))
    throw Error('The saved scans are incomplete.');
  const pages: Uint8Array[] = [];
  for (const scan of scans) {
    checkActive();
    const blob = await getPage(scan.index);
    pages.push(new Uint8Array(await blob.arrayBuffer()));
    checkActive();
  }
  return renderCheckedReturn({
    pdfLib, detail, pages,
    scanInk: (bytes) => scanBlobInk(new Blob([Uint8Array.from(bytes)], {type: 'image/jpeg'})),
    textFallback: browserTextFallback(),
    assertCurrent: checkActive,
  });
}
