export function fileStem(input: unknown, fallback: string, maxBytes?: number): string;
export function artifactFilename(options: {
  label?: string | null;
  kind: string;
  id: string;
  revision?: number | string | null;
  digest?: string | null;
  page?: number | null;
  extension: string;
}): string;
export function attachmentHeader(filename: string): string;
export function attachmentName(header: string | null, fallback: string): string;
export function saveArtifact(blob: Blob, filename: string): void;
