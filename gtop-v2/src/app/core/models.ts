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
  createdOn?: unknown;
  lastLogin?: unknown;
}

export type ThemeId =
  'academic-editorial' | 'learning-os' | 'aurora-glass' | 'warm-studio' | 'quiz-pulse';
export type MotionPreset = 'purposeful' | 'reduced';

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  description: string;
  swatches: string[];
  dark: boolean;
}

export interface PublishedAppearance {
  themeId: ThemeId;
  motionPreset: MotionPreset;
  version: number;
  updatedBy?: Actor;
  updatedAt?: unknown;
}

export interface PresenceRecord {
  userId: string;
  displayName?: string;
  email?: string;
  isOnline: boolean;
  lastActive?: number;
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
  flagCount?: number;
  lastFlaggedAt?: unknown;
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
  durationSeconds?: number;
}

export type QuizLaunchKind =
  'new' | 'retry-all' | 'retry-incorrect' | 'historical' | 'live' | 'generated';
export type ShellContext = 'learner' | 'admin';
export type ShellDisplayMode = 'standard' | 'immersive';
export type MobileNavPlacement = 'primary' | 'more' | 'drawer';

export interface NavItem {
  label: string;
  path: string;
  icon: string;
  group?: string;
  mobilePlacement?: MobileNavPlacement;
  mobilePriority?: number;
}

export interface ResponsiveColumn<T> {
  key: keyof T | string;
  label: string;
  priority: 'primary' | 'secondary' | 'detail';
  numeric?: boolean;
}

export interface DeviceDiagnosticContext {
  viewportWidth: number;
  viewportHeight: number;
  visualViewportWidth?: number;
  visualViewportHeight?: number;
  orientation: 'portrait' | 'landscape';
  standalone: boolean;
  coarsePointer: boolean;
  hoverCapable: boolean;
  shellContext?: ShellContext;
  shellDisplayMode?: ShellDisplayMode;
}

export interface DevicePreviewPreset {
  id: 'compact-phone' | 'phone' | 'landscape-phone' | 'tablet' | 'desktop' | 'wide';
  label: string;
  width: number;
  height: number;
}

export interface QuizLaunchContext {
  kind: QuizLaunchKind;
  sourceResultId?: string;
  sourceUserId?: string;
  readOnly?: boolean;
  shellContext?: ShellContext;
  returnPath?: string;
  returnTo?: string;
  hubReturnPath?: string;
}

export interface DashboardMetric<T = number> {
  status: 'idle' | 'loading' | 'ready' | 'error';
  value: T | null;
  source: 'firestore' | 'realtime-database' | 'cache';
  error?: string;
  refreshedAt?: string;
}

export interface PersistenceState {
  mode: 'persistent-multi-tab' | 'persistent-single-tab' | 'memory';
  indexedDbAvailable: boolean;
  localIndexesEnabled: boolean;
  fallbackReason?: string;
}

export type AppUpdatePhase = 'current' | 'checking' | 'available' | 'applying' | 'error';
export interface AppUpdateState {
  phase: AppUpdatePhase;
  currentVersion?: string;
  currentCommit?: string;
  channel?: 'local' | 'uat' | 'production';
  requiredVersion?: string;
  requiredCommit?: string;
  error?: string;
}

export interface LegacyLaunchContext {
  userId?: string;
  resultId?: string;
  liveSessionId?: string;
  mode?: 'live' | 'run';
}

export interface ReportSession extends QuizResult {
  questionIds: string[];
  launchContext?: QuizLaunchContext;
}

export interface UserActivityView {
  user: GtopUser;
  presence: PresenceRecord | null;
  attempts: QuizResult[];
  liveSessions: LiveSession[];
  totalQuestions: number;
  averageAccuracy: number;
  latestAttemptAt?: Date | null;
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
  status: 'scheduled' | 'lobby' | 'active' | 'ended';
  mode?: 'live' | 'run';
  questionIds: string[];
  currentQuestionIndex?: number;
  perQuestionSeconds: number;
  scheduledStartAt?: unknown;
  joinBufferMinutes?: number;
  anchorIndex?: number;
  anchorAt?: unknown;
  overrideIndex?: number;
  overrideAt?: unknown;
  resultLinked?: boolean;
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
