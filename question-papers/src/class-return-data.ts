import type { MappingPoint, MarkStatus, MethodStep } from './checking-scan';

export type SheetState =
  | 'uploading'
  | 'queued'
  | 'running'
  | 'failed'
  | 'review'
  | 'final'
  | 'completed'
  | 'withdrawn'
  | 'held';
export interface RegisterEntry {
  id: string;
  label: string;
  studentUid?: string;
  studentLabel?: string;
  labelFromStudent?: boolean;
  singleStudentBook?: boolean;
  state: SheetState;
  automatic?: boolean;
  outcome?: 'complete' | 'partial' | 'unassessable' | null;
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

type SheetIdentity = Pick<RegisterEntry, 'label' | 'studentUid' | 'studentLabel' | 'labelFromStudent' | 'singleStudentBook' | 'packetLabel'>;

/** Account-derived labels can still hold the name used before a teacher corrected the link. */
export function handbackIdentity(row: SheetIdentity) {
  const name = row.studentLabel || row.label;
  const reference = row.studentUid ? 'GT ' + row.studentUid.slice(-6) : '';
  const sheetLabel = !row.labelFromStudent && (!row.studentUid || row.label !== name) ? row.label : '';
  const classLabel = row.singleStudentBook ? '' : row.packetLabel || '';
  const detail = [reference, row.studentUid && sheetLabel].filter(Boolean).join(' · ');
  return {name, reference, sheetLabel, classLabel, detail, full: [name, detail].filter(Boolean).join(' · ')};
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
    const {name: student, reference, sheetLabel, classLabel} = handbackIdentity(row);
    const distinctClass = classLabel && classLabel !== student;
    const parts = reference
      ? [fileStem(student, 'Student', 68), reference, ...(sheetLabel ? [fileStem(sheetLabel, 'Sheet', 45)] : [])]
      : [fileStem(student, 'Sheet', distinctClass ? 110 : 185)];
    if (distinctClass) parts.push(fileStem(classLabel, 'Class', reference ? 45 : 70));
    const base = parts.join(' — ');
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
    case 'completed':
      return row.outcome === 'partial' ? 'Partial assessment' : 'Unable to assess';
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
  const includeClass = entries.some(row => handbackIdentity(row).classLabel);
  const includeStudent = entries.some(row => row.studentUid);
  const rows: (string | number | null | undefined)[][] = [
    [
      ...(includeStudent ? ['Student', 'Account reference'] : []),
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
    const identity = handbackIdentity(row);
    rows.push([
      ...(includeStudent ? [row.studentLabel ?? '', identity.reference] : []),
      identity.sheetLabel,
      registerStatus(row),
      row.state === 'final' ? row.awarded : null,
      row.max ?? maximum,
      row.state === 'review' ? row.awarded : null,
      row.state === 'held' || row.state === 'withdrawn' ? null : row.pending,
      row.state === 'final' ? names.get(row.id) : null,
      ...(includeClass ? [identity.classLabel] : []),
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
            if (column === (includeStudent ? 2 : 0) && typeof value === 'string' && /^(?:0\d+|\d{16,})$/.test(value)) {
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
