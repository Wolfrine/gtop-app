import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import {
  marginGroups,
  positionedMarks,
  marksOnPage,
  type MappingPoint,
  type MarkStatus,
} from './checking-scan';
import type { ReturnAnswer, ReturnDetail } from './class-return-data';

const pageWidth = 595.28,
  pageHeight = 841.89,
  margin = 30;
const ink = rgb(0.09, 0.15, 0.19),
  muted = rgb(0.26, 0.32, 0.35),
  lineColour = rgb(0.81, 0.84, 0.84),
  white = rgb(1, 1, 1);
const statusText: Record<MarkStatus, string> = {
  correct: 'Correct',
  partial: 'Partial credit',
  wrong: 'Incorrect',
  missing: 'Unattempted',
  unreadable: 'Unreadable',
  uncertain: 'Needs review',
};
const markColors = {
  correct: rgb(0.04, 0.4, 0.27),
  partial: rgb(0.57, 0.31, 0.05),
  wrong: rgb(0.68, 0.12, 0.13),
  missing: muted,
  unreadable: muted,
  uncertain: muted,
};
const numericScore = (value: number | null, max: number) => `${value ?? '?'} / ${max}`;

/** Keep searchable text whenever the PDF font supports it. Browser-shaped lines preserve multilingual script and math. */
class PdfText {
  private readonly characters: Set<number>;
  private canvas?: HTMLCanvasElement;
  constructor(
    private doc: PDFDocument,
    private normal: PDFFont,
    private bold: PDFFont,
  ) {
    this.characters = new Set(normal.getCharacterSet());
  }
  private supports(s: string) {
    return [...s].every((c) => this.characters.has(c.codePointAt(0)!));
  }
  private ctx(size: number, bold: boolean) {
    this.canvas ??= document.createElement('canvas');
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw Error('This browser could not render the marking notes.');
    ctx.font = `${bold ? 700 : 400} ${size}px Arial, sans-serif`;
    return ctx;
  }
  width(s: string, size: number, bold = false) {
    return this.supports(s)
      ? (bold ? this.bold : this.normal).widthOfTextAtSize(s, size)
      : this.ctx(size, bold).measureText(s).width;
  }
  wrap(s: string, width: number, size: number, bold = false): string[] {
    const lines: string[] = [];
    for (const paragraph of s.replace(/\r\n?/g, '\n').split('\n')) {
      let current = '';
      for (const word of paragraph.trim().split(/\s+/u)) {
        const next = current ? current + ' ' + word : word;
        if (this.width(next, size, bold) <= width) {
          current = next;
          continue;
        }
        if (current) {
          lines.push(current);
          current = '';
        }
        for (const char of word) {
          if (current && this.width(current + char, size, bold) > width) {
            lines.push(current);
            current = '';
          }
          current += char;
        }
      }
      lines.push(current);
    }
    return lines;
  }
  short(s: string, width: number, size: number, bold = false) {
    if (this.width(s, size, bold) <= width) return s;
    const first = this.wrap(s, width - this.width('…', size, bold), size, bold)[0];
    return first.trimEnd() + '…';
  }
  async write(p: PDFPage, s: string, x: number, top: number, size: number, bold = false, color = ink) {
    // PDF coordinates use bottom-left. Callers position each line from the top of A4.
    if (!s) return;
    if (this.supports(s)) {
      p.drawText(s, {
        x,
        y: pageHeight - top - size,
        size,
        font: bold ? this.bold : this.normal,
        color,
      });
      return;
    }
    const scale = 3;
    const ctx = this.ctx(size * scale, bold),
      canvas = ctx.canvas;
    const width = Math.ceil(ctx.measureText(s).width) + 4 * scale,
      height = Math.ceil(size * scale * 1.7);
    canvas.width = width;
    canvas.height = height;
    this.ctx(size * scale, bold);
    ctx.fillStyle = `rgb(${Math.round(color.red * 255)},${Math.round(color.green * 255)},${Math.round(color.blue * 255)})`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(s, 2 * scale, size * scale * 1.05);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(Error('Could not render a marking note.'))),
        'image/png',
      ),
    );
    const png = await this.doc.embedPng(await blob.arrayBuffer());
    p.drawImage(png, {
      x: x - 2,
      y: pageHeight - top - height / scale,
      width: width / scale,
      height: height / scale,
    });
    canvas.width = 1;
    canvas.height = 1;
  }
}

type Pin = { id: string; status: MarkStatus; score: string; comment: string; anchor: MappingPoint };
function pagePins(answers: ReturnAnswer[], page: number): Pin[] {
  return marksOnPage(answers, page).map((mark) => ({
    id: `Q${mark.answer.number}` + (mark.stepIndex === null ? '' : '.' + (mark.stepIndex + 1)),
    status: mark.status,
    score: numericScore(mark.awarded, mark.max),
    comment: mark.comment || mark.title,
    anchor: mark.anchor,
  }));
}
function markSymbol(p: PDFPage, status: MarkStatus, x: number, top: number) {
  const y = pageHeight - top,
    color = markColors[status];
  const stroke = (x1: number, y1: number, x2: number, y2: number) =>
    p.drawLine({
      start: { x: x + x1, y: y - y1 },
      end: { x: x + x2, y: y - y2 },
      color,
      thickness: 1.1,
    });
  if (status === 'correct') {
    stroke(0, 4, 2.2, 6.3);
    stroke(2.2, 6.3, 6.5, 0);
  } else if (status === 'wrong') {
    stroke(0.5, 0.5, 5.5, 6);
    stroke(5.5, 0.5, 0.5, 6);
  } else if (status === 'partial') {
    p.drawCircle({ x: x + 3.2, y: y - 3.4, size: 2.8, borderWidth: 0.8, borderColor: color });
    stroke(1.2, 5.5, 5.2, 1.3);
  } else stroke(0.5, 3, 6, 3);
}
async function header(p: PDFPage, text: PdfText, detail: ReturnDetail, section: string) {
  const score = detail.sheet.grade!;
  await text.write(
    p,
    text.short(detail.rubric.title, pageWidth - margin * 2, 15, true),
    margin,
    margin,
    15,
    true,
  );
  const total = `Final  ${numericScore(score.awarded, score.max)}`;
  const totalWidth = text.width(total, 10, true);
  await text.write(p, total, pageWidth - margin - totalWidth, margin + 24, 10, true);
  const rest = pageWidth - 2 * margin - totalWidth - 16;
  await text.write(
    p,
    text.short(detail.sheet.label, rest - text.width('  ·  ' + section, 10), 10) + '  ·  ' + section,
    margin,
    margin + 24,
    10,
    false,
    muted,
  );
  p.drawLine({
    start: { x: margin, y: pageHeight - 74 },
    end: { x: pageWidth - margin, y: pageHeight - 74 },
    color: lineColour,
    thickness: 0.6,
  });
}
async function annotate(
  p: PDFPage,
  text: PdfText,
  pins: Pin[],
  x: number,
  top: number,
  w: number,
  h: number,
  notesX: number,
) {
  const marks = pins.map((pin) => ({ answer: pin, anchor: pin.anchor }));
  const positions = positionedMarks(marks, w, h, 53, 11);
  for (const position of positions) {
    const pin = position.answer,
      px = x + (w * position.left) / 100,
      py = top + (h * position.top) / 100;
    const label = pin.id + '  ' + pin.score.replace(/ /g, '');
    const labelWidth = text.width(label, 7.2, true) + 15;
    p.drawRectangle({
      x: px,
      y: pageHeight - py - 10.7,
      width: labelWidth,
      height: 10.7,
      color: white,
      opacity: 0.95,
      borderColor: markColors[pin.status],
      borderWidth: 0.55,
    });
    markSymbol(p, pin.status, px + 2.2, py + 2);
    await text.write(p, label, px + 11, py + 1, 7.2, true, markColors[pin.status]);
  }
  const groups = marginGroups(marks, h, 32);
  const gutterWidth = pageWidth - margin - notesX;
  for (const [i, group] of groups.entries()) {
    const pin = group.marks[0].answer;
    const share =
      Math.min(
        2 * group.center,
        2 * (1 - group.center),
        i ? group.center - groups[i - 1].center : 1,
        i + 1 < groups.length ? groups[i + 1].center - group.center : 1,
      ) * h;
    const maxLines = Math.min(10, Math.max(0, Math.floor((share - 11) / 8.3)));
    const heading =
      pin.id + '  ' + pin.score + (group.marks.length > 1 ? '  +' + (group.marks.length - 1) : '');
    let caption = text.wrap(pin.comment, gutterWidth, 7.1);
    if (caption.length > maxLines && pin.status !== 'correct') {
      const last = pin.comment
        .trim()
        .split(/(?<=[.!?।])\s+/u)
        .pop();
      if (last && last !== pin.comment) caption = text.wrap(last, gutterWidth, 7.1);
    }
    if (caption.length > maxLines) {
      caption = caption.slice(0, maxLines);
      if (caption.length)
        caption[caption.length - 1] = text.short(caption[caption.length - 1] + '…', gutterWidth, 7.1);
    }
    const start = top + group.center * h - (10 + caption.length * 8.3) / 2;
    await text.write(p, heading, notesX, start, 8, true, markColors[pin.status]);
    for (const [j, value] of caption.entries())
      await text.write(p, value, notesX, start + 10 + j * 8.3, 7.1);
  }
}

export async function markedCopy(
  detail: ReturnDetail,
  getPage: (index: number) => Promise<Blob>,
  checkActive: () => void,
) {
  const { sheet } = detail,
    grade = sheet.grade;
  if (sheet.state !== 'final' || !grade || grade.pending)
    throw Error('This sheet is still awaiting final marks.');
  const pages = [...sheet.uploaded].sort((a, b) => a.index - b.index);
  if (
    !pages.length ||
    pages.length !== sheet.pageCount ||
    pages.some((p, i) => p.index !== i + 1 || !p.width || !p.height)
  )
    throw Error('The saved scans are incomplete.');
  const doc = await PDFDocument.create();
  doc.setTitle(detail.rubric.title + ' — ' + sheet.label);
  doc.setAuthor('GT Papers');
  doc.setSubject('Final checked answer sheet');
  const text = new PdfText(
    doc,
    await doc.embedFont(StandardFonts.Helvetica),
    await doc.embedFont(StandardFonts.HelveticaBold),
  );
  for (const scan of pages) {
    checkActive();
    const image = await doc.embedJpg(await (await getPage(scan.index)).arrayBuffer());
    checkActive();
    if (image.width !== scan.width || image.height !== scan.height)
      throw Error('A saved scan changed. Refresh the sheet before downloading.');
    const p = doc.addPage([pageWidth, pageHeight]);
    await header(p, text, detail, `Page ${scan.index} / ${pages.length}`);
    const pins = pagePins(grade.answers, scan.index),
      gutter = pins.length ? 111 : 0,
      top = 88;
    const available = pageWidth - margin * 2 - gutter;
    const ratio = Math.min(available / scan.width, (pageHeight - top - margin) / scan.height);
    const w = scan.width * ratio,
      h = scan.height * ratio,
      x = margin + (available - w) / 2;
    p.drawImage(image, { x, y: pageHeight - top - h, width: w, height: h });
    if (pins.length) await annotate(p, text, pins, x, top, w, h, margin + available + 8);
  }
  let page = doc.addPage([pageWidth, pageHeight]),
    y = 91;
  await header(page, text, detail, 'Marking notes');
  const next = async () => {
    checkActive();
    page = doc.addPage([pageWidth, pageHeight]);
    await header(page, text, detail, 'Marking notes');
    y = 91;
  };
  const paragraph = async (s: string, size: number, bold = false, indent = 0, color = ink) => {
    for (const value of text.wrap(s, pageWidth - margin * 2 - indent, size, bold)) {
      if (y + size * 1.5 > pageHeight - margin) await next();
      await text.write(page, value, margin + indent, y, size, bold, color);
      y += size * 1.48;
    }
  };
  for (const answer of grade.answers) {
    if (y + 44 > pageHeight - margin) await next();
    const description = [
      `Q${answer.number}`,
      statusText[answer.status],
      numericScore(answer.awarded, answer.max),
    ];
    if (answer.choice) description.push('Option ' + answer.choice);
    if (answer.counted === false) description.push('Excluded from total');
    if (answer.anchors.length)
      description.push('p. ' + [...new Set(answer.anchors.map((a) => a.page))].join(', '));
    await paragraph(description.join('  ·  '), 11, true);
    await paragraph(answer.explanation, 9.5);
    for (const [i, step] of (answer.steps || []).entries()) {
      y += 3;
      await paragraph(
        `Q${answer.number}.${i + 1}  ${step.criterion}  ·  ${numericScore(step.awarded, step.max)}`,
        9,
        true,
        8,
      );
      if (step.comment) await paragraph(step.comment, 9, false, 8);
    }
    if (answer.evidence) {
      y += 3;
      await paragraph('Evidence: ' + answer.evidence, 8.8, false, 0, muted);
    }
    y += 12;
  }
  checkActive();
  return doc.save({ objectsPerTick: 30 });
}
