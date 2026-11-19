/** Summed occupancy of locally contrasting strokes, including coloured and faint pen marks. */
export interface InkMap {
  width: number;
  height: number;
  occupied: Uint32Array;
}

export function scanInk(image: HTMLImageElement | ImageBitmap): InkMap | null {
  const originalWidth = 'naturalWidth' in image ? image.naturalWidth : image.width;
  const originalHeight = 'naturalHeight' in image ? image.naturalHeight : image.height;
  if (!originalWidth || !originalHeight) return null;
  const ratio = Math.min(1, 1600 / Math.max(originalWidth, originalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(originalWidth * ratio));
  canvas.height = Math.max(1, Math.round(originalHeight * ratio));
  const { width, height } = canvas;
  try {
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(image, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height).data;
    const occupied = new Uint32Array((width + 1) * (height + 1));
    for (let y = 0; y < height; y++) {
      let sum = 0;
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4,
          right = (y * width + Math.min(width - 1, x + 3)) * 4,
          down = (Math.min(height - 1, y + 3) * width + x) * 4;
        let stroke = Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) < 90;
        for (let channel = 0; channel < 3 && !stroke; channel++) {
          stroke =
            Math.abs(pixels[i + channel] - pixels[right + channel]) >= 12 ||
            Math.abs(pixels[i + channel] - pixels[down + channel]) >= 12;
        }
        if (stroke) sum++;
        const n = (y + 1) * (width + 1) + x + 1;
        occupied[n] = occupied[n - width - 1] + sum;
      }
    }
    return { width, height, occupied };
  } catch {
    // A protected canvas or missing decoder leaves the scan unobstructed.
    return null;
  } finally {
    canvas.width = canvas.height = 1;
  }
}

export async function scanBlobInk(blob: Blob) {
  if (typeof createImageBitmap === 'function') {
    let bitmap: ImageBitmap | undefined;
    try {
      bitmap = await createImageBitmap(blob);
      return scanInk(bitmap);
    } catch {
      /* Try the image decoder used by the browser's normal scan view. */
    } finally {
      bitmap?.close();
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return scanInk(image);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

type Size = { width: number; height: number };
type Box = Size & { x: number; y: number };

export function inkAwareMarks<T extends { anchor: { x: number; y: number } }>(
  marks: T[],
  imageWidth: number,
  imageHeight: number,
  sizeFor: (mark: T) => Size,
  ink: InkMap | null,
  symbolSize: Size = { width: 8, height: 8 },
) {
  const placed: Box[] = [];
  function available(box: Box) {
    if (!ink) return false;
    const pad = Math.max(1, box.height * 0.13);
    if (
      box.x < pad ||
      box.y < pad ||
      box.x + box.width + pad > imageWidth ||
      box.y + box.height + pad > imageHeight
    )
      return false;
    if (
      placed.some(
        (other) =>
          box.x < other.x + other.width + pad &&
          box.x + box.width + pad > other.x &&
          box.y < other.y + other.height + pad &&
          box.y + box.height + pad > other.y,
      )
    )
      return false;
    const left = Math.floor(((box.x - pad) * ink.width) / imageWidth),
      top = Math.floor(((box.y - pad) * ink.height) / imageHeight);
    const right = Math.ceil(((box.x + box.width + pad) * ink.width) / imageWidth),
      bottom = Math.ceil(((box.y + box.height + pad) * ink.height) / imageHeight);
    const stride = ink.width + 1,
      a = ink.occupied;
    return (
      a[bottom * stride + right] -
        a[bottom * stride + left] -
        a[top * stride + right] +
        a[top * stride + left] ===
      0
    );
  }
  function findSpace(anchorX: number, anchorY: number, size: Size) {
    if (!ink || size.width <= 0 || size.height <= 0) return;
    const { width: w, height: h } = size,
      gap = Math.max(1.5, h * 0.22);
    const choices: { box: Box; distance: number }[] = [];
    const offsetsX = [gap, -w - gap, -w / 2, -w * 0.25, -w * 0.75, gap + h * 0.6, -w - gap - h * 0.6];
    const offsetsY = [
      -h - gap,
      gap,
      -h * 0.5,
      -h - gap - 0.5 * h,
      gap + 0.5 * h,
      -h - gap - h,
      gap + h,
      -h - gap - 1.5 * h,
      gap + 1.5 * h,
    ];
    for (const dy of offsetsY)
      for (const dx of offsetsX) {
        // Keep the recorded pen location visible even on unusually faint scans.
        if (dx < gap && dx + w > -gap && dy < gap && dy + h > -gap) continue;
        const box = { x: anchorX + dx, y: anchorY + dy, width: w, height: h };
        if (!available(box)) continue;
        const distance = Math.hypot(dx + w / 2, dy + h / 2);
        choices.push({ box, distance });
      }
    choices.sort((a, b) => a.distance - b.distance);
    return choices[0]?.box;
  }
  return [...marks]
    .sort((a, b) => a.anchor.y - b.anchor.y)
    .map((mark) => {
      const x = mark.anchor.x * imageWidth,
        y = mark.anchor.y * imageHeight;
      let placement: 'label' | 'symbol' | 'margin' = 'label';
      let box = findSpace(x, y, sizeFor(mark));
      if (!box) {
        placement = 'symbol';
        box = findSpace(x, y, symbolSize);
      }
      if (!box) return { ...mark, placement: 'margin' as const, left: 100, top: mark.anchor.y * 100 };
      placed.push(box);
      return { ...mark, placement, left: (box.x / imageWidth) * 100, top: (box.y / imageHeight) * 100 };
    });
}
