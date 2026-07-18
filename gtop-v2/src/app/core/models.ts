import type { User } from 'firebase/auth';

export type UserRole = 'user' | 'admin' | 'institute-admin';
export type AuthPhase = 'initializing' | 'authenticated' | 'unauthenticated' | 'error';

export interface GtopUser {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string | null;
  board?: string | null;
  standard?: string | null;
  role: UserRole;
}

export interface AuthState {
  phase: AuthPhase;
  firebaseUser: User | null;
  profile: GtopUser | null;
  role: UserRole | null;
  error: string | null;
}

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
}

export interface QuizAnswer {
  questionId: string;
  selectedIndex: number;
  correctIndex: number;
  isCorrect: boolean;
}

export interface QuizResult {
  id?: string;
  userId: string;
  userName: string;
  board: string;
  standard: string;
  subject: string;
  chapter: string;
  quizType: 'quick' | 'custom' | 'live' | 'run';
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  percentage: number;
  questions: QuizAnswer[];
  timestamp: unknown;
  sessionId?: string;
  duration?: string;
}

export type WorkStatus = 'planned' | 'in-progress' | 'blocked' | 'review' | 'done';
export type WorkPriority = 'critical' | 'high' | 'medium' | 'low';

export interface Actor {
  uid?: string | null;
  name: string;
  email?: string | null;
  kind?: 'user' | 'agent' | 'system';
}

export interface WorkItem {
  id: string;
  title: string;
  description: string;
  area: string;
  owner: string;
  status: WorkStatus;
  priority: WorkPriority;
  dueDate?: string | null;
  milestone?: string;
  labels: string[];
  dependencies: string[];
  blockedReason?: string;
  acceptanceCriteria: string[];
  latestUpdate?: string;
  sourceReferences: string[];
  archived: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy?: Actor;
  updatedBy?: Actor;
}

export interface WorkUpdate {
  id: string;
  message: string;
  type: 'progress' | 'status' | 'blocker' | 'review' | 'completion';
  fromStatus?: WorkStatus;
  toStatus?: WorkStatus;
  actor: Actor;
  sourceReference?: string;
  createdAt?: unknown;
}

export interface LiveSession {
  id: string;
  joinCode: string;
  hostId: string;
  hostName: string;
  status: 'lobby' | 'active' | 'ended';
  mode?: 'live' | 'run';
  questionIds: string[];
  currentQuestionIndex?: number;
  perQuestionSeconds: number;
  scheduledStartAt?: unknown;
  scope?: Record<string, unknown>;
}

export interface FirestoreRecord {
  id: string;
  [key: string]: unknown;
}

export function asDate(value: unknown): Date | null {
  if (!value) return null;
  if (typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  const date = value instanceof Date ? value : new Date(value as string | number);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function normalizeWorkItem(id: string, raw: Record<string, unknown>): WorkItem {
  const criteria = raw['acceptanceCriteria'];
  const references = raw['sourceReferences'] ?? raw['sourceReference'];
  return {
    id,
    title: String(raw['title'] ?? 'Untitled activity'),
    description: String(raw['description'] ?? ''),
    area: String(raw['area'] ?? 'General'),
    owner: String(raw['owner'] ?? 'Unassigned'),
    status: (raw['status'] as WorkStatus) ?? 'planned',
    priority: (raw['priority'] as WorkPriority) ?? 'medium',
    dueDate: raw['dueDate'] ? String(raw['dueDate']) : null,
    milestone: raw['milestone'] ? String(raw['milestone']) : '',
    labels: Array.isArray(raw['labels']) ? raw['labels'].map(String) : [],
    dependencies: Array.isArray(raw['dependencies']) ? raw['dependencies'].map(String) : [],
    blockedReason: raw['blockedReason'] ? String(raw['blockedReason']) : '',
    acceptanceCriteria: Array.isArray(criteria)
      ? criteria.map(String)
      : typeof criteria === 'string' && criteria.trim()
        ? criteria.split(/\r?\n/).filter(Boolean)
        : [],
    latestUpdate: raw['latestUpdate'] ? String(raw['latestUpdate']) : '',
    sourceReferences: Array.isArray(references)
      ? references.map(String)
      : typeof references === 'string' && references.trim()
        ? [references]
        : [],
    archived: Boolean(raw['archived']),
    createdAt: raw['createdAt'],
    updatedAt: raw['updatedAt'],
    createdBy: raw['createdBy'] as Actor | undefined,
    updatedBy: raw['updatedBy'] as Actor | undefined,
  };
}
