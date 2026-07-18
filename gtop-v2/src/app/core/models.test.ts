import { describe, expect, it } from 'vitest';
import { asDate, normalizeWorkItem } from './models';

describe('legacy model normalization', () => {
  it('keeps v1 action-plan records compatible', () => {
    const item = normalizeWorkItem('work-1', {
      title: 'Build GTOP v2', description: 'Replace the learner and admin experience.', area: 'Product', owner: 'Codex',
      status: 'in-progress', priority: 'high', acceptanceCriteria: 'Build passes\nOwner can review UAT', sourceReference: 'feature/gtop-v2',
    });
    expect(item.acceptanceCriteria).toEqual(['Build passes', 'Owner can review UAT']);
    expect(item.sourceReferences).toEqual(['feature/gtop-v2']);
    expect(item.labels).toEqual([]);
  });

  it('normalizes timestamps without throwing on invalid values', () => {
    expect(asDate('2026-07-18')?.getFullYear()).toBe(2026);
    expect(asDate('not-a-date')).toBeNull();
  });
});
