export const MAX_QUERY_LIMIT = 200;
export const MAX_BATCH_WRITES = 20;

export function assertDocumentPath(path: string): string {
  const normalized = path.trim().replace(/^\/+|\/+$/g, '');
  const parts = normalized.split('/').filter(Boolean);
  if (!normalized || parts.length % 2 !== 0) throw new Error('A document path must have an even number of non-empty segments.');
  if (parts.some((part) => part === '.' || part === '..')) throw new Error('Relative path segments are not allowed.');
  return normalized;
}

export function assertCollectionPath(path: string): string {
  const normalized = path.trim().replace(/^\/+|\/+$/g, '');
  const parts = normalized.split('/').filter(Boolean);
  if (!normalized || parts.length % 2 !== 1) throw new Error('A collection path must have an odd number of non-empty segments.');
  if (parts.some((part) => part === '.' || part === '..')) throw new Error('Relative path segments are not allowed.');
  return normalized;
}

export function boundedLimit(value: number | undefined): number {
  if (value === undefined) return 50;
  if (!Number.isInteger(value) || value < 1) throw new Error('Query limit must be a positive integer.');
  return Math.min(value, MAX_QUERY_LIMIT);
}

export function assertDeleteConfirmation(path: string, confirmation: string): void {
  if (confirmation !== `DELETE ${path}`) throw new Error(`Confirmation must exactly equal: DELETE ${path}`);
}

export function assertBatchSize(values: unknown[]): void {
  if (!values.length) throw new Error('A batch must contain at least one write.');
  if (values.length > MAX_BATCH_WRITES) throw new Error(`A batch may contain at most ${MAX_BATCH_WRITES} writes.`);
}
