import { Zip, ZipPassThrough } from 'fflate';

const maxBlobBytes = 160 * 1024 * 1024;

/** Store already-compressed PDFs unchanged. Each finished PDF is released before reading the next student. */
export class ReturnArchive {
  private chunks: Uint8Array<ArrayBuffer>[] = [];
  private parts: Blob[] = [];
  private bytes = 0;
  private failure?: Error;
  private zip = new Zip((error, chunk) => {
    if (error) this.failure = error;
    else if (chunk.length) this.chunks.push(chunk as Uint8Array<ArrayBuffer>);
  });
  constructor(private writer?: FileSystemWritableFileStream) {}

  private async flush() {
    if (this.failure) throw this.failure;
    const next = this.chunks;
    this.chunks = [];
    for (const chunk of next) {
      this.bytes += chunk.byteLength;
      if (this.writer) await this.writer.write(chunk);
      else {
        if (this.bytes > maxBlobBytes)
          throw Error('This download exceeds the memory limit. Choose fewer sheets for each ZIP.');
        this.parts.push(new Blob([chunk]));
      }
    }
  }
  async add(name: string, pdf: Uint8Array) {
    const file = new ZipPassThrough(name);
    this.zip.add(file);
    file.push(pdf, true);
    await this.flush();
  }
  async finish(checkActive: () => void) {
    this.zip.end();
    await this.flush();
    checkActive();
    if (this.writer) {
      await this.writer.close();
      return;
    }
    const download = new Blob(this.parts, { type: 'application/zip' });
    this.parts = [];
    return download;
  }
  async cancel() {
    this.zip.terminate();
    this.parts = [];
    this.chunks = [];
    await this.writer?.abort().catch(() => {});
  }
}
