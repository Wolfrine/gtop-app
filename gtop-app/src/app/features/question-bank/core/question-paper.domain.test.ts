import { describe, expect, it } from 'vitest';
import {
  buildGenerationRules, chapterKey, createPaperPlan, isUsableQuestion, normalizeQuestion,
  paperPrintHtml, ruleMarks, resizeGenerationRules, setupFingerprint, validatePaperDraft, validatePaperSetup,
  type GenerationRule, type PaperDraftPayload, type PaperGenerationSetup,
} from './question-paper.domain';

const scope = { subject: 'Science', chapter: 'Light' };
function setup(marks = 2): PaperGenerationSetup {
  return { title: 'Light practice', board: 'CBSE', standard: '10', subjects: ['Science'],
    chapters: ['Light'], chapterScopes: [scope], marks, durationMinutes: 20,
    templateId: 'auto', templateName: 'Custom objective paper', negativeMarking: 0 };
}
function question(id: string, overrides: Record<string, unknown> = {}) {
  return normalizeQuestion(id, { board: 'CBSE', standard: '10', subject: 'Science', chapter: 'Light',
    question: `Question ${id}?`, options: ['Concave', 'Convex'], correctIndex: 0,
    solutions: [`Explanation for ${id}.`], ...overrides });
}
function rule(id: string, overrides: Partial<GenerationRule> = {}): GenerationRule {
  return { id, title: id, subject: '', questionTypes: ['mcq'], difficulty: 'any', competencyTags: [],
    requiredCount: 1, marksPerQuestion: 1, objectiveOnly: true, ...overrides };
}
function payload(): PaperDraftPayload {
  const configuration = setup();
  const rules = buildGenerationRules(null, ['Science'], 2);
  const bank = [question('1'), question('2')];
  const plan = createPaperPlan(configuration, rules, bank);
  return { ...configuration, schemaVersion: 2, status: 'draft', primarySubject: 'Science',
    actualMarks: plan.actualMarks, rules, sections: plan.sections,
    coverage: { availableQuestionCount: bank.length, requiredQuestionCount: plan.requiredCount, gapCount: 0, gaps: [] },
    createdBy: 'admin-123', updatedBy: 'admin-123' };
}

describe('paper template and approved question compatibility', () => {
  it('normalizes old aliases without guessing type from question wording', () => {
    const normalized = question('legacy', { standard: 10, question: 'In this case, what is the reason?', difficulty: 'Medium' });
    expect(normalized.questionType).toBe('mcq');
    expect(normalized.standard).toBe('10');
    expect(normalized.difficulty).toBe('moderate');
    expect(normalized.status).toBe('approved');
    expect(question('aliased', { questionType: 'MCQ Single' }).questionType).toBe('mcq');
    expect(question('unknown-difficulty').difficulty).toBe('unspecified');
  });
  it('excludes incomplete answers, ambiguous options, unapproved questions and missing figures', () => {
    for (const overrides of [
      { solutions: [] }, { correctIndex: 7 }, { options: ['Same', ' same '] },
      { options: ['A', '', 'B'], correctIndex: 1 }, { status: 'draft' },
      { questionType: 'diagram_based', assets: [] },
    ]) expect(isUsableQuestion(question('invalid', overrides))).toBe(false);
    expect(isUsableQuestion(question('valid'))).toBe(true);
  });
  it('requires written answer depth to match section marks', () => {
    const written = (id:string, marks:number) => question(id,{options:[],correctIndex:-1,questionType:'short_answer',marks});
    const rules=[rule('written',{objectiveOnly:false,questionTypes:['short_answer'],marksPerQuestion:5})];
    expect(createPaperPlan(setup(5),rules,[written('two-mark',2)]).gaps[0].gapCount).toBe(1);
    expect(createPaperPlan(setup(5),rules,[written('five-mark',5)]).sections[0].questions[0].questionId).toBe('five-mark');
  });
  it('reads structure sections with their actual marks instead of falling back to MCQ', () => {
    const rules = buildGenerationRules({ id: 'board40', structure: { totalMarks: 40, sections: [
      { label: 'Objective / MCQ / Assertion', marks: 10 }, { label: 'Very Short Answer', marks: 8 },
      { label: 'Short Answer / Competency', marks: 12 }, { label: 'Case or Long Answer', marks: 10 },
    ] } }, ['Science']);
    expect(rules.map((item) => [item.requiredCount, item.marksPerQuestion])).toEqual([[10, 1], [4, 2], [4, 3], [2, 5]]);
    expect(ruleMarks(rules)).toBe(40);
    expect(rules[3].questionTypes).toEqual(['case_based', 'long_answer']);
  });
  it('starts descriptive paper families with usable mixed mark allocations', () => {
    const families: [string, number, string][] = [
      ['board_40_mark_chapter_test', 40, 'short_answer'],
      ['icse_structured_paper', 40, 'numerical'],
      ['competency_based_paper', 40, 'case_based'],
      ['integrated_multi_subject_paper', 80, 'long_answer'],
      ['numerical_graph_instrument_paper', 40, 'instrument_reading'],
      ['one_two_mark_qa_sheet', 40, 'very_short_answer'],
    ];
    for (const [id, total, writtenType] of families) {
      const rules = buildGenerationRules({ id, structure: { totalMarks: total } }, ['Science']);
      expect(rules.length).toBeGreaterThan(1);
      expect(ruleMarks(rules)).toBe(total);
      expect(rules.some((section) => section.questionTypes.includes(writtenType))).toBe(true);
    }
    const explicit = buildGenerationRules({ id: 'competency_based_paper', sections: [
      { title: 'Custom section', questionCount: 3, marksPerQuestion: 2, questionType: 'short_answer' },
    ] }, ['Science']);
    expect(explicit).toHaveLength(1);
    expect(ruleMarks(explicit)).toBe(6);
  });
  it('honors NEET defaults and selected subjects', () => {
    const rules = buildGenerationRules({ id: 'neet_objective_mock', structure: { sections: [
      { label: 'Physics', defaultQuestionCount: 45, defaultMarksPerQuestion: 4, questionTypes: ['mcq_single', 'numerical'] },
      { label: 'Biology', defaultQuestionCount: 90, defaultMarksPerQuestion: 4, questionTypes: ['mcq_single'] },
    ] } }, ['Biology']);
    expect(rules).toHaveLength(1);
    expect(rules[0].subject).toBe('Biology');
    expect(rules[0].requiredCount).toBe(90);
    expect(ruleMarks(rules)).toBe(360);
    expect(rules[0].objectiveOnly).toBe(true);
  });
  it('keeps historical competency names as requirements on a concrete format', () => {
    const rules = buildGenerationRules({ id: 'application', sections: [{ title: 'Apply', questionTypes: ['application'], count: 1 }] }, ['Science'], 1);
    expect(rules[0].questionTypes).toEqual(['short_answer']);
    const config = setup(1);
    const plain = question('plain', { questionType: 'short_answer', options: [], correctIndex: -1 });
    const applied = question('applied', { questionType: 'application', options: [], correctIndex: -1 });
    expect(createPaperPlan(config, rules, [plain]).selectedCount).toBe(0);
    expect(createPaperPlan(config, rules, [plain, applied]).selectedCount).toBe(1);
  });
});

describe('honest coverage and paper selection', () => {
  it('allocates overlapping sections globally rather than counting one question twice', () => {
    const rules = [rule('any'), rule('easy', { difficulty: 'easy' })];
    const bank = [question('a-easy', { difficulty: 'easy' }), question('z-hard', { difficulty: 'hard' })];
    const plan = createPaperPlan(setup(), rules, bank);
    expect(plan.gaps).toEqual([]);
    expect(plan.sections[1].questions[0].questionId).toBe('a-easy');
    expect(plan.sections.flatMap((section) => section.questions.map((item) => item.questionId))).toHaveLength(2);
    const short = createPaperPlan(setup(), rules, [bank[0]]);
    expect(short.selectedCount).toBe(1);
    expect(short.gaps.reduce((sum, gap) => sum + gap.gapCount, 0)).toBe(1);
  });
  it('never fills a hard or different-type section with an unrelated question', () => {
    const plan = createPaperPlan(setup(1), [rule('hard', { difficulty: 'hard' })], [question('easy', { difficulty: 'easy' })]);
    expect(plan.sections[0].questions).toEqual([]);
    expect(plan.gaps[0]).toMatchObject({ subject: 'Science', chapter: 'Light', gapCount: 1, marksPerQuestion: 1 });
    expect(plan.actualMarks).toBe(0);
  });
  it('reports shortages per selected chapter instead of borrowing from another chapter', () => {
    const config = { ...setup(), chapters: ['Light', 'Electricity'], chapterScopes: [scope, { subject: 'Science', chapter: 'Electricity' }] };
    const plan = createPaperPlan(config, buildGenerationRules(null, ['Science'], 2), [question('1'), question('2')]);
    expect(plan.selectedCount).toBe(1);
    expect(plan.gaps).toMatchObject([{ chapter: 'Electricity', requiredCount: 1, availableCount: 0, gapCount: 1 }]);
    expect(() => createPaperPlan({ ...config, marks: 1 }, [rule('too-small')], [question('1')])).toThrow(/each selected chapter/);
  });
  it('distinguishes identical chapter names in different subjects', () => {
    expect(chapterKey(scope)).not.toBe(chapterKey({ ...scope, subject: 'Physics' }));
    const config = { ...setup(), subjects: ['Science', 'Physics'], chapterScopes: [scope, { ...scope, subject: 'Physics' }] };
    const plan = createPaperPlan(config, buildGenerationRules(null, config.subjects, 2), [question('science'), question('physics', { subject: 'Physics' })]);
    expect(plan.gaps).toEqual([]);
    expect(plan.sections[0].questions.map((item) => item.subject).sort()).toEqual(['Physics', 'Science']);
  });
  it('deduplicates repeated stems even when options are shuffled or changed', () => {
    const duplicates = [question('a', { question: 'Same question?' }), question('b', { question: ' Same   question? ', options: ['Convex', 'Concave'], correctIndex: 1 })];
    const plan = createPaperPlan(setup(), buildGenerationRules(null, ['Science'], 2), duplicates);
    expect(plan.selectedCount).toBe(1);
    expect(plan.gaps[0].gapCount).toBe(1);
  });
  it('computes exact marks and refuses mismatched, fractional or excessive plans', () => {
    const rules = [rule('four', { requiredCount: 2, marksPerQuestion: 4 })];
    const plan = createPaperPlan(setup(8), rules, [question('1'), question('2')]);
    expect(plan.actualMarks).toBe(8);
    expect(plan.sections[0].questions.every((item) => item.marks === 4)).toBe(true);
    expect(validatePaperSetup(setup(9), rules)).toMatch(/add up/);
    expect(validatePaperSetup(setup(8), [{ ...rules[0], requiredCount: 1.5 }])).toMatch(/whole/);
    expect(validatePaperSetup(setup(2000), [{ ...rules[0], requiredCount: 500 }])).toMatch(/400/);
  });
});

describe('snapshot and answer separation', () => {
  it('changes the fingerprint for setup and section edits', () => {
    const config = setup(); const rules = buildGenerationRules(null, ['Science'], 2);
    const baseline = setupFingerprint(config, rules);
    for (const changed of [{ ...config, title: 'New paper' }, { ...config, durationMinutes: 25 }, { ...config, templateId: 'other' }]) {
      expect(setupFingerprint(changed, rules)).not.toBe(baseline);
    }
    expect(setupFingerprint(config, [{ ...rules[0], difficulty: 'hard' }])).not.toBe(baseline);
  });
  it('validates persisted totals and refuses duplicate questions in saved papers', () => {
    const draft = payload(); expect(validatePaperDraft(draft)).toBe('');
    expect(validatePaperDraft({ ...draft, actualMarks: 99 })).toMatch(/totals/);
    const duplicate = structuredClone(draft); duplicate.sections[0].questions[1] = duplicate.sections[0].questions[0];
    expect(validatePaperDraft(duplicate)).toMatch(/repeated/);
  });
  it('prints questions separately from explanations and escapes authored content', () => {
    const draft = payload(); draft.title = '<script>alert(1)</script>';
    const student = paperPrintHtml(draft, draft.sections, false);
    const answers = paperPrintHtml(draft, draft.sections, true);
    expect(student).not.toContain('Explanation for');
    expect(student).not.toContain('<script>');
    expect(student).toContain('&lt;script&gt;');
    expect(answers).toContain('ANSWER KEY');
    expect(answers).toContain('Explanation for');
    expect(student).toContain('Concave');
  });
});


describe('resizing a mixed paper', () => {
  it('keeps all types, tags, difficulty and per-question marks for each valid total', () => {
    const rules = buildGenerationRules({id:'competency_based_paper'}, ['Science']);
    rules[1].difficulty = 'hard';
    const original = structuredClone(rules);
    for (let target = 11; target <= 120; target++) {
      const resized = resizeGenerationRules(rules, target);
      expect(ruleMarks(resized)).toBe(target);
      expect(resized.map(({requiredCount,...rule}) => rule)).toEqual(original.map(({requiredCount,...rule}) => rule));
      expect(resized.every(rule => Number.isInteger(rule.requiredCount) && rule.requiredCount > 0)).toBe(true);
    }
    expect(rules).toEqual(original);
  });
  it('rejects impossible totals without changing the rule definitions', () => {
    const rules = buildGenerationRules({id:'counted',sections:[{title:'Case study',questionType:'case_based',questionCount:5,marksPerQuestion:4}]}, []);
    expect(() => resizeGenerationRules(rules, 41)).toThrow(/cannot fit/);
    expect(() => resizeGenerationRules(rules, 3)).toThrow(/at least 4/);
    expect(() => resizeGenerationRules(rules, 4.5)).toThrow(/whole paper total/);
    expect(() => resizeGenerationRules(rules, 2001)).toThrow(/2,000/);
    expect(ruleMarks(rules)).toBe(20);
  });
});
