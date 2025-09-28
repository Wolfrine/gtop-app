import { Timestamp } from '@angular/fire/firestore';

/**
 * Firestore Paths
 * - LiveSessions/{sessionId}
 * - LiveSessions/{sessionId}/participants/{uid}
 * - LiveSessions/{sessionId}/answers/{questionIndex}/items/{uid}
 */

export type SessionStatus = 'lobby' | 'active' | 'ended';

export interface LiveSessionScope {
  board: string;
  standard: string;
  subjectIds?: string[];
  chapterIds?: string[];
}

export interface LiveSession {
  id?: string;
  hostId: string;
  hostName: string;
  joinCode: string;

  scope: LiveSessionScope;

  // The ordered set of question document IDs from the shared `questions` collection
  questionIds: string[];

  // Scheduling
  scheduledStartAt: Timestamp; // When the host wants to start
  bufferSeconds: number;       // Extra time in seconds to allow joining (lobby countdown)
  perQuestionSeconds: number;  // How long each question stays active
  effectiveStartAt: Timestamp; // deprecated; same as scheduledStartAt in v1
  autoAdvance: boolean;        // clients compute current index from scheduledStartAt

  // Flow control
  status: SessionStatus;       // 'lobby' | 'active' | 'ended'
  overrideIndex: number | null; // Host can force jump to index
  overrideAt: Timestamp | null;  // Timestamp when override was set

  // Timestamps
  createdAt: any; // serverTimestamp
  updatedAt: any; // serverTimestamp

  // Linkage to results
  resultLinked?: boolean;
}

export interface LiveParticipant {
  uid: string;
  displayName: string;
  photoURL?: string | null;

  joinedAt: any; // serverTimestamp
  ready?: boolean;

  // Optional aggregates for convenience
  submittedCount?: number;
  totalResponseMs?: number;
  lastAnswerAt?: any; // serverTimestamp
  score?: number;

  // Presence & linkage
  lastSeen?: any; // serverTimestamp
  resultId?: string; // QuizResults doc ID for this user/session
}

export interface LiveAnswerItem {
  uid: string;
  displayName: string;
  selectedIndex: number; // Selected option index
  submittedAt: any;      // serverTimestamp
  responseMs: number;    // Client-computed response time in milliseconds
}

export interface CreateSessionOptions {
  hostId: string;
  hostName: string;
  scope: LiveSessionScope;
  questionIds: string[];
  scheduledStartAt: Timestamp; // Host-selected time (can be now)
  bufferSeconds: number;       // Join window
  perQuestionSeconds: number;  // Time per question
  autoAdvance?: boolean;       // default true
}

export interface ComputeScheduleResult {
  effectiveStartAt: Date;
  indexStartAt: (index: number) => Date;
}
