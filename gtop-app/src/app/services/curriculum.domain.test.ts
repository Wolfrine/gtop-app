import { describe, expect, it } from 'vitest';
import { applicableChapters, curriculumDiff, curriculumKey, curriculumValidation, emptyCurriculum, legacyDrafts } from './curriculum.domain';

describe('year-specific curriculum review', () => {
  it('does not turn duplicate or outdated bank records into an approved current syllabus', () => {
    const old = {board:'CBSE',standard:'12',subject:'Chemistry',chapter:'Solutions'};
    const drafts = legacyDrafts([old,{...old,id:'second-copy'}], '2026-27');
    expect(drafts).toHaveLength(1);
    expect(drafts[0].chapters).toHaveLength(1);
    expect(drafts[0].reviewStatus).toBe('draft');
    expect(curriculumValidation(drafts[0]).join(' ')).toMatch(/official source/);
    expect(curriculumKey({...drafts[0],academicYear:'2027-28'})).not.toBe(drafts[0].id);
  });
  it('keeps formative-only chemistry visible without including it in a summative paper', () => {
    const draft = emptyCurriculum('CBSE','12','Chemistry','2026-27');
    draft.chapters = [
      {title:'Solutions',topics:['Concentration'],assessment:'both',bankAliases:[]},
      {title:'Surface Chemistry',topics:['Colloids'],assessment:'formative',bankAliases:[]},
    ];
    expect(applicableChapters(draft,'summative').map(item => item.title)).toEqual(['Solutions']);
    expect(applicableChapters(draft,'formative')).toHaveLength(2);
    expect(draft.chapters).toHaveLength(2);
  });
  it('shows changed assessment scope as a review difference and blocks incomplete topics', () => {
    const before = emptyCurriculum('CBSE','12','Chemistry','2026-27');
    before.chapters = [{title:'Surface Chemistry',topics:['Colloids'],assessment:'both',bankAliases:[]}];
    const after = structuredClone(before); after.chapters[0].assessment = 'formative';
    expect(curriculumDiff(before,after).changed).toEqual(['Surface Chemistry']);
    after.completeness = 'complete'; after.sourceStatus = 'official-source';
    after.sources = [{title:'Official curriculum',url:'https://cbseacademic.nic.in/curriculum_2027.html',year:'2026-27',locator:'Class XII'}];
    expect(curriculumValidation(after)).toEqual([]);
    after.chapters[0].topics = [];
    expect(curriculumValidation(after).join(' ')).toMatch(/topics/);
  });
});
