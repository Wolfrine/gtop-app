export interface ShareAssessment {
  title: string;
  outcome: 'complete' | 'partial' | 'unassessable' | null;
  releasedAt: string | null;
  message: string | null;
  revision: string;
  filename: string;
  summaryFilename: string;
  fullMaximum: number | null;
  final: {earned: number; maximum: number} | null;
  assessed: {earned: number | null; maximum: number} | null;
  pending: number | null;
  questions: {
    number: number;
    maximum: number | null;
    earned: number | null;
    state: string | null;
    choice: string | null;
    counted: boolean | null;
    explanation: string;
  }[];
}
export function openResultShare(options: {
  metadata(signal: AbortSignal): Promise<ShareAssessment>;
  report(revision: string, signal: AbortSignal): Promise<Blob>;
  loadPdf(): Promise<unknown>;
}): () => void;
