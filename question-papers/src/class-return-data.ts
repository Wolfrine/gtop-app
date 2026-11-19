import type { MappingPoint, MarkStatus, MethodStep } from './checking-scan';

export type SheetState =
  | 'uploading'
  | 'queued'
  | 'running'
  | 'failed'
  | 'review'
  | 'final'
  | 'withdrawn'
  | 'held';
export interface RegisterEntry {
  id: string;
  label: string;
  state: SheetState;
  pageCount: number;
  version: number;
  awarded: number | null;
  max?: number;
  pending?: number | null;
  packetId?: string;
  packetLabel?: string;
  gradingRevision?: number;
}
export interface ReturnAnswer {
  number: number;
  status: MarkStatus;
  max: number;
  awarded: number | null;
  explanation: string;
  evidence: string;
  choice?: string | null;
  anchors: MappingPoint[];
  counted?: boolean | null;
  steps?: MethodStep[];
}
export interface MarkedSheet extends RegisterEntry {
  uploaded: { index: number; width: number; height: number }[];
  grade?: { awarded: number; max: number; pending: number; answers: ReturnAnswer[] };
}
export interface ReturnDetail {
  classLabel?: string;
  sheet: MarkedSheet;
  rubric: { title: string; marks: number };
}

export function fileStem(input: string, fallback: string, maxBytes = 185) {
  const stem = input
    .normalize('NFC')
    .replace(/[<>:"/\\|?*\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[. ]+|[. ]+$/g, '');
  // Some extraction tools enforce a byte limit, even when a label is short on screen.
  const encoder = new TextEncoder();
  let name = '',
    bytes = 0;
  for (const char of Array.from(stem).slice(0, 95)) {
    const length = encoder.encode(char).length;
    if (bytes + length > maxBytes) break;
    bytes += length;
    name += char;
  }
  name = name.trimEnd().replace(/[. ]+$/g, '') || fallback;
  return /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name) ? '_' + name : name;
}

export function filenames(entries: RegisterEntry[]) {
  const result = new Map<string, string>();
  const used = new Set<string>();
  for (const row of entries) {
    const base = row.packetLabel
      ? fileStem(row.label, 'Sheet', 110) + ' — ' + fileStem(row.packetLabel, 'Class', 70)
      : fileStem(row.label, 'Sheet');
    let name = base + '.pdf';
    let serial = 1;
    while (used.has(name.toLowerCase())) name = base + ' (' + ++serial + ').pdf';
    used.add(name.toLowerCase());
    result.set(row.id, name);
  }
  return result;
}

export function registerStatus(row: RegisterEntry) {
  switch (row.state) {
    case 'uploading':
      return 'Upload incomplete';
    case 'queued':
      return 'Queued';
    case 'running':
      return 'Checking';
    case 'failed':
      return 'Checking failed';
    case 'review':
      return row.pending === 0 ? 'Ready to finalize' : 'Needs review';
    case 'final':
      return 'Final';
    case 'held':
      return 'Held for identification';
    case 'withdrawn':
      return 'Withdrawn';
  }
}

function csvCell(input: string | number | null | undefined) {
  if (typeof input === 'number') return Number.isFinite(input) ? String(input) : '';
  if (input == null) return '';
  // Treat teacher-supplied labels and filenames as text in spreadsheet programs.
  const text = /^\s*[=+\-@]/.test(input) || /^[\t\n\r]/.test(input) ? "'" + input : input;
  return '"' + text.replace(/"/g, '""') + '"';
}

export function marksRegister(
  entries: RegisterEntry[],
  maximum: number | undefined,
  names: Map<string, string>,
) {
  const includeClass = entries.some((row) => row.packetLabel);
  const rows: (string | number | null | undefined)[][] = [
    [
      'Roll / sheet label',
      'Status',
      'Final marks',
      'Maximum marks',
      'Draft marks',
      'Unresolved items',
      'Marked copy',
      ...(includeClass ? ['Class sitting'] : []),
    ],
  ];
  for (const row of entries) {
    rows.push([
      row.label,
      registerStatus(row),
      row.state === 'final' ? row.awarded : null,
      row.max ?? maximum,
      row.state === 'review' ? row.awarded : null,
      row.state === 'held' || row.state === 'withdrawn' ? null : row.pending,
      row.state === 'final' ? names.get(row.id) : null,
      ...(includeClass ? [row.packetLabel] : []),
    ]);
  }
  return (
    '\uFEFF' +
    rows
      .map((row) =>
        row
          .map((value, column) => {
            // A quoted CSV field alone still turns 001 into 1 in Excel. Only a digit-only roll may use
            // a controlled string literal; all teacher-supplied expressions go through csvCell.
            if (column === 0 && typeof value === 'string' && /^(?:0\d+|\d{16,})$/.test(value)) {
              return '"=""' + value + '"""';
            }
            return csvCell(value);
          })
          .join(','),
      )
      .join('\r\n') +
    '\r\n'
  );
}
