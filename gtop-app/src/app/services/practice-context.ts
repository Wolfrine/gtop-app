export interface PracticeCurriculum { board: string; standard: string; }
export interface PracticeContext {
  curriculum?: PracticeCurriculum;
  subjects: string[];
  chapters: string[];
  count: number;
  quizType: 'quick' | 'custom';
  routeKey: string;
}

/** Published syllabus and older question records use these two names for one board. */
export function normalizePracticeBoard(board: unknown): string {
  const value = typeof board === 'string' ? board.trim() : '';
  return value === 'Cambridge IGCSE' ? 'IGCSE' : value;
}

function values(value: unknown): string[] {
  const list = Array.isArray(value) ? value : value == null ? [] : [value];
  return [...new Set(list.filter(item => typeof item === 'string').map(item => item.trim()).filter(Boolean))];
}

/** Solo practice follows learner profiles; admins retain curriculum selection. */
export function resolvePracticeContext(profile: any, params: Record<string, any>): PracticeContext {
  if (!profile?.uid) throw new Error('Sign in to start your quiz.');
  const admin = profile.role === 'admin';
  const profileBoard = normalizePracticeBoard(profile.board);
  const profileStandard = String(profile.standard ?? '').trim();
  if (!admin && (!profileBoard || !profileStandard)) throw new Error('profile-required');
  const board = admin ? normalizePracticeBoard(params['board']) : profileBoard;
  const standard = admin ? String(params['standard'] ?? '').trim() : profileStandard;
  if (admin && (!!board !== !!standard)) throw new Error('Choose both a board and class to start this quiz.');
  const subjects = values(params['subjects']);
  const chapters = values(params['chapters']);
  if (admin && (subjects.length || chapters.length) && (!board || !standard)) {
    throw new Error('Choose a board and class for these quiz topics.');
  }
  const requestedCount = Number(params['count']);
  const count = Number.isFinite(requestedCount) && requestedCount > 0 ? Math.min(100, Math.floor(requestedCount)) : 10;
  const quizType = subjects.length || chapters.length ? 'custom' : 'quick';
  const curriculum = board && standard ? { board, standard } : undefined;
  return { curriculum, subjects, chapters, count, quizType,
    routeKey: JSON.stringify([profile.role === 'admin' ? 'admin' : 'learner', board, standard,
      [...subjects].sort(), [...chapters].sort(), count, params['returnTo'] || '', params['hubReturnPath'] || '']) };
}

export function questionsMatchPractice(questions: any[], context: PracticeContext): boolean {
  if (!context.curriculum) return true;
  return questions.every(question => normalizePracticeBoard(question.board) === context.curriculum!.board &&
    String(question.standard ?? '').trim() === context.curriculum!.standard);
}
