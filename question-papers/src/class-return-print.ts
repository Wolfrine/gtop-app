import { Duplex, PDFDocument, rgb } from 'pdf-lib';

// The combined PDF must retain its full object graph until it is saved.
const maxPrintBytes = 64 * 1024 * 1024;
const maxPrintPages = 400;

export class ClassPrintSet {
  private bytes = 0;

  private constructor(private document: PDFDocument) {}

  static async create(title: string) {
    const document = await PDFDocument.create();
    document.setTitle(title);
    document.setAuthor('GT Papers');
    document.setSubject('Class print set for the teacher');
    document.catalog.getOrCreateViewerPreferences().setDuplex(Duplex.DuplexFlipLongEdge);
    return new ClassPrintSet(document);
  }

  async add(copy: Uint8Array) {
    this.bytes += copy.byteLength;
    if (this.bytes > maxPrintBytes)
      throw Error('This print set is too large. Select fewer sheets per PDF.');
    const previous = this.document.getPageCount(),
      blankBack = previous % 2;
    const source = await PDFDocument.load(copy, { updateMetadata: false });
    if (previous + blankBack + source.getPageCount() > maxPrintPages)
      throw Error('This print set is too large. Select fewer sheets per PDF.');
    // Place the next student's first page on the front of a new physical sheet.
    if (blankBack) {
      const { width, height } = this.document.getPage(previous - 1).getSize();
      const back = this.document.addPage([width, height]);
      // A printed line keeps drivers with blank-page suppression from removing the separator.
      back.drawText('End of answer book', { x: 30, y: 30, size: 9, color: rgb(0.28, 0.33, 0.31) });
    }
    const pages = await this.document.copyPages(source, source.getPageIndices());
    for (const page of pages) this.document.addPage(page);
  }

  async finish() {
    const bytes = await this.document.save({ objectsPerTick: 30 });
    return new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
  }
}
