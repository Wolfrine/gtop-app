import { QuizAnswer, QuizResult } from './models';

export interface RankedParticipant {
  uid: string;
  name: string;
  correct: number;
  responseMs: number;
  points: number;
}
export interface TimedAnswer {
  uid: string;
  displayName?: string;
  selectedIndex: number;
  responseMs: number;
}

export function retryQuestionIds(
  result: Pick<QuizResult, 'questions'>,
  incorrectOnly: boolean,
): string[] {
  return result.questions
    .filter((answer) => !incorrectOnly || !answer.isCorrect)
    .map((answer) => answer.questionId);
}

export function weightedAccuracy(
  results: Array<Pick<QuizResult, 'correctAnswers' | 'totalQuestions'>>,
): number {
  const total = results.reduce((sum, item) => sum + Number(item.totalQuestions || 0), 0);
  return total
    ? Math.round(
        (results.reduce((sum, item) => sum + Number(item.correctAnswers || 0), 0) / total) * 100,
      )
    : 0;
}

export function rankLiveAnswers(
  groups: Array<{ correctIndex: number; answers: TimedAnswer[] }>,
): RankedParticipant[] {
  const values = new Map<string, RankedParticipant>();
  for (const group of groups)
    for (const answer of group.answers) {
      const correct = answer.selectedIndex === group.correctIndex;
      const row = values.get(answer.uid) ?? {
        uid: answer.uid,
        name: answer.displayName || 'Learner',
        correct: 0,
        responseMs: 0,
        points: 0,
      };
      row.correct += correct ? 1 : 0;
      row.responseMs += answer.responseMs;
      row.points += correct ? Math.max(1000 - Math.round(answer.responseMs / 20), 100) : 0;
      values.set(answer.uid, row);
    }
  return [...values.values()].sort(
    (a, b) => b.points - a.points || a.responseMs - b.responseMs || a.name.localeCompare(b.name),
  );
}

export function answersComplete(answers: QuizAnswer[], expected: number): boolean {
  return (
    answers.length === expected &&
    answers.every((answer) => Number.isInteger(answer.selectedIndex) && answer.selectedIndex >= 0)
  );
}
