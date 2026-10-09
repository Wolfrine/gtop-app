import { Timestamp } from 'firebase/firestore';

/**
 * Data-only Firestore fixture builders for screenshot/emulator setup.
 * The caller still writes these documents to the local emulator; this module
 * never connects to Firestore or production.
 */
export type FixtureMode = 'live' | 'run';
export type FixtureStatus = 'lobby' | 'active' | 'ended';

export interface LiveFixtureOptions {
  sessionId?: string;
  mode?: FixtureMode;
  status?: FixtureStatus;
  hostId?: string;
  hostName?: string;
  joinCode?: string;
  participantIds?: string[];
  questionIds?: string[];
  /** Absolute scheduling time. Defaults to 10 minutes in the future. */
  scheduledStartAt?: Date;
  bufferSeconds?: number;
  perQuestionSeconds?: number;
  maxParticipants?: number;
  now?: Date;
}

export interface FirestoreFixtureDocument {
  path: string;
  data: Record<string, unknown>;
}

export function makeLiveQuestion(id: string, index = 0): FirestoreFixtureDocument {
  return {
    path: `questions/${id}`,
    data: {
      question: `Fixture question ${index + 1}: which quantity measures electric current?`,
      options: ['Volt', 'Ampere', 'Ohm', 'Watt'],
      correctIndex: 1,
      solutions: 'Electric current is measured in amperes (A).',
      board: 'CBSE',
      standard: '10',
      subject: 'Physics',
      chapter: 'Electricity',
    },
  };
}

/** Build a complete parent session plus one or more participant and question docs. */
export function makeLiveSessionFixtures(options: LiveFixtureOptions = {}): {
  sessionId: string;
  documents: FirestoreFixtureDocument[];
} {
  const now = options.now ?? new Date();
  const sessionId = options.sessionId ?? 'qa-live-session';
  const mode = options.mode ?? 'live';
  const status = options.status ?? 'lobby';
  const hostId = options.hostId ?? 'qa-admin';
  const questionIds = options.questionIds ?? ['qa-live-q1', 'qa-live-q2'];
  const startAt = options.scheduledStartAt ?? new Date(now.getTime() + 10 * 60_000);
  const bufferSeconds = options.bufferSeconds ?? 300;
  const anchorAt = status === 'active' ? now : startAt;

  const session = {
    hostId,
    hostName: options.hostName ?? 'QA Host',
    joinCode: options.joinCode ?? (mode === 'run' ? 'RUN246' : 'LIVE246'),
    mode,
    maxParticipants: mode === 'run' ? (options.maxParticipants ?? 5) : null,
    scope: { board: 'CBSE', standard: '10', subjectIds: ['Physics'], chapterIds: ['Electricity'] },
    questionIds,
    scheduledStartAt: Timestamp.fromDate(startAt),
    bufferSeconds: mode === 'run' ? 0 : bufferSeconds,
    perQuestionSeconds: options.perQuestionSeconds ?? 30,
    effectiveStartAt: Timestamp.fromDate(startAt),
    autoAdvance: true,
    anchorIndex: 0,
    anchorAt: Timestamp.fromDate(anchorAt),
    status,
    overrideIndex: null,
    overrideAt: null,
    startedAt: mode === 'run' && status === 'active' ? Timestamp.fromDate(now) : null,
    createdAt: Timestamp.fromDate(now),
    updatedAt: Timestamp.fromDate(now),
    resultLinked: false,
  };

  const participants = (options.participantIds ?? ['qa-learner']).map((uid, i) => ({
    path: `LiveSessions/${sessionId}/participants/${uid}`,
    data: {
      uid,
      displayName: uid === hostId ? (options.hostName ?? 'QA Host') : `QA Player ${i + 1}`,
      photoURL: null,
      joinedAt: Timestamp.fromDate(now),
      ready: true,
    },
  }));

  return {
    sessionId,
    documents: [
      { path: `LiveSessions/${sessionId}`, data: session },
      ...participants,
      ...questionIds.map((id, i) => makeLiveQuestion(id, i)),
    ],
  };
}
