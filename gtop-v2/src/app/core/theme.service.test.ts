import { describe, expect, it } from 'vitest';
import { GTOP_THEME_DEFINITIONS as GTOP_THEMES } from './theme.definitions';

describe('GTOP themes', () => {
  it('ships five distinct complete theme definitions', () => {
    expect(GTOP_THEMES).toHaveLength(5);
    expect(new Set(GTOP_THEMES.map((theme) => theme.id)).size).toBe(5);
    expect(
      GTOP_THEMES.every((theme) => theme.swatches.length >= 4 && theme.name && theme.description),
    ).toBe(true);
  });
  it('keeps Academic Editorial as the stable fallback', () =>
    expect(GTOP_THEMES[0].id).toBe('academic-editorial'));
});
