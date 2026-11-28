import type { MappingPoint, MarkStatus, MethodStep } from './checking-scan';
import { artifactFilename } from '../../assistant-service/domain/artifact-filenames.mjs';

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
  reportDigest?: string | null;
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

export function filenames(entries: RegisterEntry[], title: string) {
  return new Map(entries.map(row=>[row.id,artifactFilename({label:[handbackIdentity(row).name,title].filter(Boolean).join(' - '),kind:'checked-report',
    id:row.id,revision:row.version,digest:row.reportDigest,extension:'pdf'})]));
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
