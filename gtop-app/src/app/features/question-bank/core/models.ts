export interface SyllabusItem {
  id: string;
  board: string;
  standard: string;
  subject: string;
  chapter: string;
  mcqCount: number;
}

export interface Question {
  id: string;
  board: string;
  standard: string;
  subject: string;
  chapter: string;
  title: string;
  question: string;
  options: string[];
  correctIndex: number;
  solutions: string[];
  selectedIndex?: number | null;
  createdAt?: unknown;
  createdBy?: string;
  flagCount?: number;
  lastFlaggedAt?: unknown;
}
