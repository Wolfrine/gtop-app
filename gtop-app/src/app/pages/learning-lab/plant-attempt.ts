import { baseline, questions, missions, LESSON_VERSION } from './plant-lesson';

export const MAX_ATTEMPTS = 5;
export type Answers = Record<string, number>;
export interface LabAttempt {
  id: string;
  version: string;
  createdAt: number;
  updatedAt: number;
  phase: 'experiment' | 'checked' | 'complete';
  baseline: Answers;
  predictions: Answers;
  experiments: string[];
  answers: Answers;
  confidence: number;
  rating: number;
  friction: string;
  feedback: string;
}
export interface LabHistory {
  lessonId: 'plant-reproduction';
  attempts: LabAttempt[];
}
export type LabChange =
  | { kind: 'prediction'; mission: string; answer: number }
  | { kind: 'experiment'; mission: string }
  | { kind: 'assessment'; answers: Answers; confidence: number }
  | { kind: 'feedback'; rating: number; friction: string; feedback: string };

function validAnswers(
  answers: Answers,
  items: readonly { id: string; choices: readonly string[] }[],
): boolean {
  return (
    !!answers &&
    Object.keys(answers).length === items.length &&
    items.every(
      (q) =>
        Number.isInteger(answers[q.id]) &&
        answers[q.id] >= 0 &&
        answers[q.id] < q.choices.length,
    )
  );
}
export function newAttempt(
  id: string,
  answers: Answers,
  now: number,
): LabAttempt {
  if (!validAnswers(answers, baseline))
    throw new Error('Answer both predictions first.');
  return {
    id,
    version: LESSON_VERSION,
    createdAt: now,
    updatedAt: now,
    phase: 'experiment',
    baseline: { ...answers },
    predictions: {},
    experiments: [],
    answers: {},
    confidence: 0,
    rating: 0,
    friction: '',
    feedback: '',
  };
}
export function appendAttempt(
  history: LabAttempt[],
  attempt: LabAttempt,
): LabAttempt[] {
  return [attempt, ...history.filter((a) => a.id !== attempt.id)].slice(
    0,
    MAX_ATTEMPTS,
  );
}
// Applied inside a Firestore transaction so another tab cannot overwrite a saved first answer.
// This is formative feedback stored in the learner's editable profile, not an exam record.
export function changeAttempt(
  attempt: LabAttempt,
  change: LabChange,
  now: number,
): LabAttempt {
  if (attempt.version !== LESSON_VERSION)
    throw new Error('This lesson has changed. Start a new attempt.');
  const next: LabAttempt = { ...attempt, updatedAt: now };
  if (change.kind === 'prediction') {
    const mission = missions.find((m) => m.id === change.mission);
    if (
      !mission ||
      !Number.isInteger(change.answer) ||
      change.answer < 0 ||
      change.answer >= mission.choices.length
    )
      throw new Error('Choose a valid prediction.');
    if (attempt.predictions[mission.id] !== undefined) return attempt;
    if (attempt.phase !== 'experiment')
      throw new Error('This attempt has already been checked.');
    next.predictions = { ...attempt.predictions, [mission.id]: change.answer };
  } else if (change.kind === 'experiment') {
    if (
      !missions.some((m) => m.id === change.mission) ||
      attempt.predictions[change.mission] === undefined
    )
      throw new Error('Make your prediction first.');
    if (attempt.experiments.includes(change.mission)) return attempt;
    if (attempt.phase !== 'experiment')
      throw new Error('This attempt has already been checked.');
    next.experiments = [...attempt.experiments, change.mission];
  } else if (change.kind === 'assessment') {
    if (attempt.phase !== 'experiment') return attempt;
    if (!missions.every((m) => attempt.experiments.includes(m.id)))
      throw new Error('Complete all five experiments first.');
    if (
      !validAnswers(change.answers, questions) ||
      !Number.isInteger(change.confidence) ||
      change.confidence < 1 ||
      change.confidence > 4
    )
      throw new Error('Answer all five questions and choose your confidence.');
    next.answers = { ...change.answers };
    next.confidence = change.confidence;
    next.phase = 'checked';
  } else {
    if (attempt.phase === 'complete') return attempt;
    if (attempt.phase !== 'checked')
      throw new Error('Check your answers first.');
    if (
      !Number.isInteger(change.rating) ||
      change.rating < 1 ||
      change.rating > 5 ||
      typeof change.feedback !== 'string' ||
      typeof change.friction !== 'string' ||
      change.feedback.length > 800 ||
      change.friction.length > 500
    )
      throw new Error(
        'Choose a usefulness rating and keep feedback within the text limits.',
      );
    next.rating = change.rating;
    next.feedback = change.feedback.trim();
    next.friction = change.friction.trim();
    next.phase = 'complete';
  }
  return next;
}
// Ignore malformed/obsolete profile data rather than allowing it to break the lesson or admin view.
export function readHistory(value: unknown): LabAttempt[] {
  const history = value as Partial<LabHistory> | undefined;
  if (history?.lessonId !== 'plant-reproduction' || !Array.isArray(history.attempts))
    return [];
  return history.attempts
    .filter((a) => {
      if (
        !a ||
        typeof a.id !== 'string' ||
        a.id.length > 100 ||
        a.version !== LESSON_VERSION ||
        !Number.isFinite(a.createdAt) ||
        !Number.isFinite(a.updatedAt)
      )
        return false;
      if (
        !['experiment', 'checked', 'complete'].includes(a.phase) ||
        !validAnswers(a.baseline, baseline)
      )
        return false;
      if (
        !a.predictions ||
        typeof a.predictions !== 'object' ||
        Array.isArray(a.predictions)
      )
        return false;
      if (
        !Object.entries(a.predictions).every(([id, answer]) => {
          const m = missions.find((m) => m.id === id);
          return (
            !!m &&
            Number.isInteger(answer) &&
            answer >= 0 &&
            answer < m.choices.length
          );
        })
      )
        return false;
      if (
        !Array.isArray(a.experiments) ||
        !a.experiments.every(
          (id) =>
            missions.some((m) => m.id === id) &&
            a.predictions[id] !== undefined,
        ) ||
        new Set(a.experiments).size !== a.experiments.length
      )
        return false;
      if (
        !a.answers ||
        typeof a.answers !== 'object' ||
        Array.isArray(a.answers)
      )
        return false;
      if (
        !Number.isInteger(a.confidence) ||
        a.confidence < 0 ||
        a.confidence > 4 ||
        !Number.isInteger(a.rating) ||
        a.rating < 0 ||
        a.rating > 5
      )
        return false;
      if (
        typeof a.feedback !== 'string' ||
        a.feedback.length > 800 ||
        typeof a.friction !== 'string' ||
        a.friction.length > 500
      )
        return false;
      if (
        a.phase !== 'experiment' &&
        (!validAnswers(a.answers, questions) ||
          a.confidence < 1 ||
          !missions.every((m) => a.experiments.includes(m.id)))
      )
        return false;
      return a.phase !== 'complete' || a.rating >= 1;
    })
    .slice(0, MAX_ATTEMPTS);
}
