import '@angular/compiler';
import { describe, expect, it, vi } from 'vitest';
import { ReportsPageComponent } from '../pages/reports-page/reports-page.component';

vi.mock('./quiz.service', () => ({ QuizService: class {} }));
vi.mock('@angular/fire/auth', () => ({ Auth: class {} }));

describe('practice attempt reporting', () => {
  it('counts retry attempts in distribution and totals without relabeling historical quick results', () => {
    const component = new ReportsPageComponent({} as any, {} as any, {} as any, {} as any);
    const results = ['quick', 'custom', 'live', 'run', 'retry', 'retry'].map((quizType, i) => ({
      id: `result-${i}`, quizType, timestamp: new Date(2026, 9, i + 1),
      totalQuestions: 2, correctAnswers: 1, questions: [],
    }));
    component.processReportData(results);
    expect(component.quizTypeChartData.labels).toEqual(['Quick', 'Custom', 'Live', 'Run', 'Retry']);
    expect(component.quizTypeChartData.datasets[0].data).toEqual([1, 1, 1, 1, 2]);
    expect(component.summaryCards[0].value).toBe(6);
    expect(component.sessions.map(session => session.quizType)).toEqual(['retry', 'retry', 'run', 'live', 'custom', 'quick']);
    expect(results[0].quizType).toBe('quick');
    component.processReportData([]);
    expect(component.quizTypeChartData.datasets[0].data).toEqual([0, 0, 0, 0, 0]);
  });
});
