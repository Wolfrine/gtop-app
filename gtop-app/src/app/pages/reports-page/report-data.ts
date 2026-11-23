import { SavedQuizResult } from '../../services/quiz.service';
import { ReleasedPaperScore } from '../../services/student-submissions.service';

export interface Score { earned: number; possible: number; }
interface ScoredActivity { date: Date | null; score: Score | null; }

export interface QuizActivity extends ScoredActivity {
    id: string;
    title: string;
    quiz: SavedQuizResult;
}

export interface PaperActivity extends ScoredActivity {
    id: string;
    title: string;
    subject: string;
}

export interface ChapterProgress {
    key: string;
    title: string;
    curriculum: string;
    score: Score;
}

export interface SubjectProgress {
    key: string;
    title: string;
    quiz: Score | null;
    written: Score | null;
    chapters: ChapterProgress[];
}

export function validScore(earned: unknown, possible: unknown): Score | null {
    if (typeof earned !== 'number' || typeof possible !== 'number' ||
        !Number.isFinite(earned) || !Number.isFinite(possible) || possible <= 0 || earned < 0 || earned > possible) return null;
    return { earned, possible };
}

export function percent(score: Score): number {
    return Math.round(100 * score.earned / score.possible);
}

function addScore(total: Score | null, score: Score): Score {
    return { earned: (total?.earned ?? 0) + score.earned, possible: (total?.possible ?? 0) + score.possible };
}

export function totalScore(rows: ScoredActivity[]): Score | null {
    return rows.reduce<Score | null>((total, row) => row.score ? addScore(total, row.score) : total, null);
}

function dateOf(value: SavedQuizResult['timestamp']): Date | null {
    if (value == null || value === '') return null;
    const date = typeof value === 'object' && 'toDate' in value ? value.toDate() : new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
}

export function quizActivity(quiz: SavedQuizResult): QuizActivity {
    return {
        quiz, id: quiz.id, title: quiz.chapter?.trim() || quiz.subject?.trim() || 'Quiz',
        date: dateOf(quiz.timestamp), score: validScore(quiz.correctAnswers, quiz.totalQuestions),
    };
}

export function paperActivity(paper: ReleasedPaperScore): PaperActivity {
    return {
        id: paper.id, title: paper.title?.trim() || 'Answer sheet', subject: paper.subject?.trim() || 'Subject not recorded',
        date: dateOf(paper.releasedAt), score: validScore(paper.awarded, paper.max),
    };
}

export function trendDays(rows: ScoredActivity[]): { date: Date; score: Score }[] {
    const days = new Map<number, Score>();
    for (const { date, score } of rows) {
        if (!date || !score) continue;
        const day = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
        days.set(day, addScore(days.get(day) ?? null, score));
    }
    return [...days].sort(([left], [right]) => left - right).slice(-8)
        .map(([day, score]) => ({ date: new Date(day), score }));
}

export function subjectProgress(quizzes: QuizActivity[], papers: PaperActivity[]): SubjectProgress[] {
    const subjects = new Map<string, SubjectProgress>();
    const forSubject = (name: string) => {
        const key = name.toLowerCase();
        let subject = subjects.get(key);
        if (!subject) {
            subject = { key, title: name, quiz: null, written: null, chapters: [] };
            subjects.set(key, subject);
        }
        return subject;
    };
    for (const { quiz, score } of quizzes) {
        if (!score) continue;
        const subject = forSubject(quiz.subject?.trim() || 'Subject not recorded');
        subject.quiz = addScore(subject.quiz, score);
        const title = quiz.chapter?.trim() || 'Chapter not recorded';
        const curriculum = [quiz.board, quiz.standard ? 'Class ' + quiz.standard : ''].filter(Boolean).join(' · ');
        const key = JSON.stringify([title.toLowerCase(), curriculum]);
        const chapter = subject.chapters.find(row => row.key === key);
        if (chapter) chapter.score = addScore(chapter.score, score);
        else subject.chapters.push({ key, title, curriculum, score });
    }
    for (const { subject: name, score } of papers) {
        if (!score) continue;
        const subject = forSubject(name);
        subject.written = addScore(subject.written, score);
    }
    return [...subjects.values()];
}
