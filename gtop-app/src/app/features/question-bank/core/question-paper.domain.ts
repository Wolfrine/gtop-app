import type { Question } from './models';

export interface ChapterScope { subject: string; chapter: string; }
export interface QuestionPaperTemplateSection {
  id?: string;
  title?: string;
  name?: string;
  label?: string;
  subject?: string;
  questionType?: string;
  type?: string;
  questionTypes?: string[];
  difficulty?: string;
  competencyTags?: string[];
  requiredCount?: number;
  questionCount?: number;
  defaultQuestionCount?: number;
  count?: number;
  marks?: number | string;
  marksPerQuestion?: number;
  perQuestionMarks?: number;
  defaultMarksPerQuestion?: number;
}
export interface TemplateStructure {
  sections?: QuestionPaperTemplateSection[];
  subjects?: string[];
  questionTypes?: string[];
  totalMarks?: number;
  defaultQuestionCount?: number;
  defaultMarksPerQuestion?: number;
  durationMinutes?: number;
  negativeMarking?: number;
  instructions?: string[];
}
export interface QuestionPaperTemplate {
  id: string;
  name?: string;
  title?: string;
  description?: string;
  notes?: string;
  status?: string;
  board?: string;
  standard?: string | number;
  subjects?: string[];
  subject?: string;
  marks?: number;
  totalMarks?: number;
  durationMinutes?: number;
  sections?: QuestionPaperTemplateSection[];
  blueprint?: TemplateStructure;
  structure?: TemplateStructure;
}
export interface PaperAsset { url: string; alt: string; }
export interface QuestionTypeRequirement { questionType: string; competencyTags: string[]; }
export interface NormalizedQuestion extends Question {
  questionType: string;
  difficulty: string;
  competencyTags: string[];
  marks: number;
  status: string;
  assets: PaperAsset[];
}
export interface GenerationRule {
  id: string;
  title: string;
  subject: string;
  questionTypes: string[];
  difficulty: string;
  competencyTags: string[];
  requiredCount: number;
  marksPerQuestion: number;
  objectiveOnly: boolean;
  typeRequirements?: QuestionTypeRequirement[];
}
export interface GeneratedPaperQuestion {
  questionId: string;
  title: string;
  question: string;
  options: string[];
  correctIndex: number;
  solutions: string[];
  board: string;
  standard: string;
  subject: string;
  chapter: string;
  questionType: string;
  difficulty: string;
  competencyTags: string[];
  marks: number;
  assets: PaperAsset[];
}
export interface GeneratedPaperSection {
  id: string;
  title: string;
  questionType: string;
  questionTypes: string[];
  subject: string;
  difficulty: string;
  requiredCount: number;
  marksPerQuestion: number;
  competencyTags: string[];
  questions: GeneratedPaperQuestion[];
}
export interface CoverageGap {
  sectionId: string;
  sectionTitle: string;
  subject: string;
  chapter: string;
  questionType: string;
  questionTypes: string[];
  difficulty: string;
  competencyTags: string[];
  requiredCount: number;
  availableCount: number;
  gapCount: number;
  marksPerQuestion: number;
  typeRequirements?: QuestionTypeRequirement[];
}
export interface PaperGenerationSetup {
  title: string;
  board: string;
  standard: string;
  subjects: string[];
  chapters: string[];
  chapterScopes: ChapterScope[];
  marks: number;
  durationMinutes: number;
  templateId: string;
  templateName: string;
  negativeMarking: number;
}
export interface PaperDraftPayload extends PaperGenerationSetup {
  schemaVersion: number;
  status: 'draft';
  primarySubject: string;
  actualMarks: number;
  rules: GenerationRule[];
  sections: GeneratedPaperSection[];
  coverage: {
    availableQuestionCount: number;
    requiredQuestionCount: number;
    gapCount: number;
    gaps: CoverageGap[];
  };
  createdBy: string;
  updatedBy: string;
}
export interface SavedPaperDraft extends PaperDraftPayload {
  id: string;
  createdAt?: unknown;
}
export interface QuestionBankResult {
  questions: NormalizedQuestion[];
  truncatedScopes: ChapterScope[];
  excludedCount: number;
}
export interface PaperPlan {
  sections: GeneratedPaperSection[];
  gaps: CoverageGap[];
  actualMarks: number;
  requiredCount: number;
  selectedCount: number;
}

const TYPE_ALIASES: Record<string, string> = {
  mcq_single: 'mcq', single_choice: 'mcq', single_correct: 'mcq', multiple_choice: 'mcq',
  multiple_choice_question: 'mcq', objective: 'mcq', assertion_and_reason: 'assertion_reason',
  assertion_reasoning: 'assertion_reason', match_the_following: 'matching', match: 'matching',
  fill_in_the_blank: 'fill_blank', fill_in_the_blanks: 'fill_blank', fill_blanks: 'fill_blank',
  short: 'short_answer', long: 'long_answer', very_short: 'very_short_answer',
  numerical_based: 'numerical', case_study: 'case_based', statement: 'statement_based',
  application: 'short_answer', analysis: 'short_answer', reason: 'short_answer',
};
const TYPE_COMPETENCIES: Record<string, string> = { application: 'application', analysis: 'analysis', reason: 'reasoning' };
export function textValue(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}
export function scopeValue(value: unknown): string { return textValue(value).replace(/\s+/g, ' ').toLocaleLowerCase(); }
export function token(value: unknown): string { return scopeValue(value).replace(/[\s-]+/g, '_'); }
export function normalizeQuestionType(value: unknown): string {
  const normalized = token(value);
  return TYPE_ALIASES[normalized] ?? (normalized || 'mcq');
}
export function normalizeDifficulty(value: unknown): string {
  const normalized = token(value);
  if (['medium', 'standard', 'normal', 'moderate'].includes(normalized)) return 'moderate';
  if (['difficult', 'advanced', 'hard'].includes(normalized)) return 'hard';
  if (['basic', 'simple', 'easy'].includes(normalized)) return 'easy';
  return normalized || 'unspecified';
}
export function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(textValue).filter(Boolean) : [];
}
export function positiveNumber(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}
export function chapterKey(scope: ChapterScope): string { return JSON.stringify([scope.subject, scope.chapter]); }
export function typeLabel(value: string): string {
  return value === 'mcq' ? 'MCQ' : value.replace(/_/g, ' ').replace(/^./, (letter) => letter.toUpperCase());
}
export function normalizeQuestion(id: string, raw: Record<string, unknown>): NormalizedQuestion {
  const assetInput = Array.isArray(raw['assets']) ? raw['assets'] : [];
  const assets = assetInput.flatMap((value): PaperAsset[] => {
    if (!value || typeof value !== 'object') return [];
    const item = value as Record<string, unknown>;
    const url = textValue(item['url']);
    return /^https:\/\//i.test(url) ? [{ url, alt: textValue(item['alt']) || 'Question diagram' }] : [];
  });
  const imageUrl = textValue(raw['imageUrl'] ?? raw['diagramUrl']);
  if (/^https:\/\//i.test(imageUrl) && !assets.some((item) => item.url === imageUrl)) {
    assets.push({ url: imageUrl, alt: textValue(raw['imageAlt']) || 'Question diagram' });
  }
  return {
    id, board: textValue(raw['board']), standard: textValue(raw['standard']),
    subject: textValue(raw['subject']), chapter: textValue(raw['chapter']),
    title: textValue(raw['title']), question: textValue(raw['question']),
    options: Array.isArray(raw['options']) ? raw['options'].map(textValue) : [],
    correctIndex: typeof raw['correctIndex'] === 'number' ? raw['correctIndex'] : -1,
    solutions: typeof raw['answer'] === 'string' && !raw['solutions'] ? [raw['answer']] : strings(raw['solutions'] ?? raw['answer']),
    // The approved-bank compatibility contract explicitly treats missing types as MCQ.
    questionType: normalizeQuestionType(raw['questionType'] ?? raw['type'] ?? raw['question_type']),
    difficulty: normalizeDifficulty(raw['difficulty'] ?? raw['level']),
    competencyTags: [...new Set([...strings(raw['competencyTags'] ?? raw['tags']).map(token),
      TYPE_COMPETENCIES[token(raw['questionType'] ?? raw['type'] ?? raw['question_type'])]].filter(Boolean))],
    marks: positiveNumber(raw['marks'], 1), status: token(raw['status']) || 'approved', assets,
  };
}
export function isUsableQuestion(question: NormalizedQuestion): boolean {
  if (!['active', 'approved', 'published'].includes(question.status) || !question.question || !question.solutions.length) return false;
  if (question.options.length > 0) {
    if (question.options.length < 2 || question.options.some((option) => !option) || !Number.isInteger(question.correctIndex) ||
      question.correctIndex < 0 || question.correctIndex >= question.options.length) return false;
    if (new Set(question.options.map(scopeValue)).size !== question.options.length) return false;
  } else if (['mcq', 'assertion_reason', 'statement_based'].includes(question.questionType) || !question.solutions.length) {
    return false;
  }
  return !['diagram_based', 'graph_based', 'instrument_reading'].includes(question.questionType) || question.assets.length > 0;
}

function inferredTypes(label: string): string[] {
  const value = label.toLowerCase();
  if (value.includes('very short')) return ['very_short_answer', 'one_word', 'fill_blank'];
  if (value.includes('short answer')) return ['short_answer', 'application'];
  if (value.includes('case') || value.includes('long answer')) return ['case_based', 'long_answer'];
  if (value.includes('assertion')) return ['mcq', 'assertion_reason'];
  return ['mcq'];
}
function inferredMarks(label: string): number {
  const value = label.toLowerCase();
  if (value.includes('very short')) return 2;
  if (value.includes('short answer')) return 3;
  if (value.includes('long answer')) return 5;
  return 1;
}

/** Converts the deployed descriptive template contract to a visible, editable plan. */
export function buildGenerationRules(
  template: QuestionPaperTemplate | null,
  selectedSubjects: string[],
  targetMarks = 40,
): GenerationRule[] {
  if (!template) return [{
    id: 'objective-mcq', title: 'Objective questions', subject: '', questionTypes: ['mcq'],
    difficulty: 'any', competencyTags: [], requiredCount: targetMarks, marksPerQuestion: 1, objectiveOnly: true,
  }];
  const structure = template.structure ?? template.blueprint ?? {};
  const rawSections = template.sections ?? structure.sections ?? [{
    title: template.title ?? template.name ?? 'Questions',
    questionTypes: structure.questionTypes ?? ['mcq'],
    defaultQuestionCount: structure.defaultQuestionCount,
    defaultMarksPerQuestion: structure.defaultMarksPerQuestion,
  }];
  const knownSubjects = ['physics', 'chemistry', 'biology', ...selectedSubjects.map(scopeValue)];
  const sections = rawSections.flatMap((section, index) => {
    const title = section.title ?? section.name ?? section.label ?? `Section ${index + 1}`;
    const subject = section.subject ?? (knownSubjects.includes(scopeValue(title)) ? title : '');
    if (subject && selectedSubjects.length && !selectedSubjects.some((item) => scopeValue(item) === scopeValue(subject))) return [];
    return [{ section, index, title, subject }];
  });
  const total = positiveNumber(template.totalMarks ?? template.marks ?? structure.totalMarks, targetMarks);
  const baseShare = Math.floor(total / Math.max(sections.length, 1));
  return sections.map(({ section, index, title, subject }, position) => {
    const marksPerQuestion = positiveNumber(section.marksPerQuestion ?? section.perQuestionMarks ??
      section.defaultMarksPerQuestion ?? structure.defaultMarksPerQuestion, inferredMarks(title));
    const sectionMarks = positiveNumber(section.marks, baseShare + (position < total % sections.length ? 1 : 0));
    const requiredCount = positiveNumber(section.requiredCount ?? section.questionCount ??
      section.defaultQuestionCount ?? section.count, Math.max(1, Math.floor(sectionMarks / marksPerQuestion)));
    const types = section.questionTypes?.length ? section.questionTypes :
      section.questionType || section.type ? [section.questionType ?? section.type ?? 'mcq'] : inferredTypes(title);
    return {
      id: section.id ?? `section-${index + 1}`, title, subject,
      questionTypes: [...new Set(types.map(normalizeQuestionType))],
      difficulty: section.difficulty ? normalizeDifficulty(section.difficulty) : 'any',
      competencyTags: (section.competencyTags ?? []).map(token), requiredCount, marksPerQuestion,
      objectiveOnly: /neet|mixed_mcq/.test(template.id) || /objective|mcq/i.test(title),
      typeRequirements: types.map((type) => ({ questionType: normalizeQuestionType(type),
        competencyTags: TYPE_COMPETENCIES[token(type)] ? [TYPE_COMPETENCIES[token(type)]] : [] })),
    };
  });
}
export function ruleMarks(rules: GenerationRule[]): number {
  return rules.reduce((sum, rule) => sum + rule.requiredCount * rule.marksPerQuestion, 0);
}
export function setupFingerprint(setup: PaperGenerationSetup, rules: GenerationRule[]): string {
  return JSON.stringify({ ...setup, subjects: [...setup.subjects].sort(), chapters: [...setup.chapters].sort(),
    chapterScopes: [...setup.chapterScopes].sort((a, b) => chapterKey(a).localeCompare(chapterKey(b))), rules });
}
export function validatePaperDraft(draft: PaperDraftPayload): string {
  const setupError = validatePaperSetup(draft, draft.rules);
  if (setupError) return setupError;
  if (draft.sections.length !== draft.rules.length) return 'The saved paper is missing a section.';
  const usedIds = new Set<string>();
  const usedStems = new Set<string>();
  let actualMarks = 0;
  let selectedCount = 0;
  for (const section of draft.sections) {
    const rule = draft.rules.find((item) => item.id === section.id);
    if (!rule || !Array.isArray(section.questions) || section.questions.length > rule.requiredCount ||
      section.requiredCount !== rule.requiredCount || section.marksPerQuestion !== rule.marksPerQuestion) {
      return 'The saved section does not match its question plan.';
    }
    for (const snapshot of section.questions) {
      const question = normalizeQuestion(snapshot.questionId, snapshot as unknown as Record<string, unknown>);
      const scope = draft.chapterScopes.find((item) => scopeValue(item.subject) === scopeValue(question.subject) && scopeValue(item.chapter) === scopeValue(question.chapter));
      const stem = questionFingerprint(question);
      if (!question.id || !scope || !isUsableQuestion(question) || !matches(question, rule, scope) ||
        scopeValue(question.board) !== scopeValue(draft.board) || scopeValue(question.standard) !== scopeValue(draft.standard) ||
        usedIds.has(question.id) || usedStems.has(stem) || snapshot.marks !== rule.marksPerQuestion) {
        return 'The saved paper contains an incomplete, repeated, or mismatched question.';
      }
      usedIds.add(question.id); usedStems.add(stem); actualMarks += snapshot.marks; selectedCount++;
    }
  }
  const requiredCount = draft.rules.reduce((sum, rule) => sum + rule.requiredCount, 0);
  if (draft.actualMarks !== actualMarks || draft.coverage.requiredQuestionCount !== requiredCount ||
    draft.coverage.gapCount !== requiredCount - selectedCount ||
    draft.coverage.gaps.reduce((sum, gap) => sum + gap.gapCount, 0) !== draft.coverage.gapCount) {
    return 'The saved paper totals do not match its questions. Generate a fresh draft.';
  }
  return '';
}
export function validatePaperSetup(setup: PaperGenerationSetup, rules: GenerationRule[]): string {
  if (!setup.board || !setup.standard) return 'Select a board and standard.';
  if (!setup.subjects.length) return 'Select at least one subject.';
  if (!setup.chapterScopes.length) return 'Select at least one chapter.';
  if (setup.chapterScopes.length > 60) return 'Select up to 60 chapters for one paper.';
  if (!setup.title.trim()) return 'Enter a title for the paper.';
  if (!Number.isInteger(setup.durationMinutes) || setup.durationMinutes < 1 || setup.durationMinutes > 360) {
    return 'Set a duration between 1 and 360 minutes.';
  }
  if (!rules.length || rules.some((rule) => !Number.isInteger(rule.requiredCount) || rule.requiredCount < 1 ||
    !Number.isInteger(rule.marksPerQuestion) || rule.marksPerQuestion < 1 || rule.marksPerQuestion > 20 || !rule.questionTypes.length)) {
    return 'Each section needs a whole question count and 1–20 marks per question.';
  }
  if (rules.reduce((sum, rule) => sum + rule.requiredCount, 0) > 400) return 'Use up to 400 questions per paper.';
  if (ruleMarks(rules) !== setup.marks) return 'The section marks must add up to the paper total.';
  if (setup.marks < 1 || setup.marks > 2000) return 'Set a paper total between 1 and 2,000 marks.';
  if (setup.chapterScopes.some((scope) => !setup.subjects.some((subject) => scopeValue(subject) === scopeValue(scope.subject)))) {
    return 'Every selected chapter must belong to a selected subject.';
  }
  if (rules.some((rule) => rule.subject && !setup.chapterScopes.some((scope) => scopeValue(scope.subject) === scopeValue(rule.subject)))) {
    return 'Select a chapter for every subject in the section plan.';
  }
  if (setup.subjects.some((subject) => !setup.chapterScopes.some((scope) => scopeValue(scope.subject) === scopeValue(subject)))) {
    return 'Select at least one chapter for each selected subject.';
  }
  return '';
}

function matches(question: NormalizedQuestion, rule: GenerationRule, scope: ChapterScope): boolean {
  return scopeValue(question.subject) === scopeValue(scope.subject) && scopeValue(question.chapter) === scopeValue(scope.chapter) &&
    (!rule.subject || scopeValue(question.subject) === scopeValue(rule.subject)) &&
    (rule.typeRequirements?.length ? rule.typeRequirements.some((requirement) =>
      (requirement.questionType === 'any' || requirement.questionType === question.questionType) &&
      requirement.competencyTags.every((tag) => question.competencyTags.includes(tag))) :
      rule.questionTypes.includes('any') || rule.questionTypes.includes(question.questionType)) &&
    (!rule.objectiveOnly || question.options.length >= 2) &&
    (rule.difficulty === 'any' || normalizeDifficulty(rule.difficulty) === question.difficulty) &&
    rule.competencyTags.every((tag) => question.competencyTags.includes(token(tag)));
}
function questionFingerprint(question: NormalizedQuestion): string {
  return scopeValue(question.question);
}

/** One shared allocation powers coverage and preview, so a question cannot cover two slots. */
export function createPaperPlan(
  setup: PaperGenerationSetup,
  rules: GenerationRule[],
  bank: NormalizedQuestion[],
): PaperPlan {
  const error = validatePaperSetup(setup, rules);
  if (error) throw new Error(error);
  const distinct = new Map<string, NormalizedQuestion>();
  for (const question of bank) {
    if (isUsableQuestion(question) && scopeValue(question.board) === scopeValue(setup.board) &&
      scopeValue(question.standard) === scopeValue(setup.standard)) {
      const fingerprint = questionFingerprint(question);
      if (!distinct.has(fingerprint)) distinct.set(fingerprint, question);
    }
  }
  const questions = [...distinct.values()].sort((a, b) => a.id.localeCompare(b.id));
  const slots: { ruleIndex: number; scope: ChapterScope; candidates: number[] }[] = [];
  let chapterOffset = 0;
  rules.forEach((rule, ruleIndex) => {
    const scopes = setup.chapterScopes.filter((scope) => !rule.subject || scopeValue(scope.subject) === scopeValue(rule.subject));
    for (let index = 0; index < rule.requiredCount; index++) {
      const scope = scopes[(chapterOffset + index) % scopes.length];
      slots.push({ ruleIndex, scope, candidates: questions.flatMap((question, candidate) => matches(question, rule, scope) ? [candidate] : []) });
    }
    chapterOffset += rule.requiredCount;
  });
  const representedScopes = new Set(slots.map((slot) => chapterKey(slot.scope)));
  if (setup.chapterScopes.some((scope) => !representedScopes.has(chapterKey(scope)))) {
    throw new Error('Increase the question count or select fewer chapters so each selected chapter is represented.');
  }
  const owners = new Map<number, number>();
  const assignments = new Map<number, number>();
  const assign = (slotIndex: number, visited: Set<number>): boolean => {
    for (const candidate of slots[slotIndex].candidates) {
      if (visited.has(candidate)) continue;
      visited.add(candidate);
      const owner = owners.get(candidate);
      if (owner === undefined || assign(owner, visited)) {
        owners.set(candidate, slotIndex);
        assignments.set(slotIndex, candidate);
        return true;
      }
    }
    return false;
  };
  slots.map((_, index) => index).sort((a, b) => slots[a].candidates.length - slots[b].candidates.length)
    .forEach((slotIndex) => assign(slotIndex, new Set()));
  const sections: GeneratedPaperSection[] = rules.map((rule) => ({
    ...rule, questionType: rule.questionTypes.length === 1 ? rule.questionTypes[0] : 'mixed', questions: [],
  }));
  const coverage = new Map<string, CoverageGap>();
  slots.forEach((slot, slotIndex) => {
    const rule = rules[slot.ruleIndex];
    const key = `${rule.id}|${chapterKey(slot.scope)}`;
    const gap = coverage.get(key) ?? {
      sectionId: rule.id, sectionTitle: rule.title, ...slot.scope,
      questionType: rule.questionTypes.length === 1 ? rule.questionTypes[0] : 'mixed', questionTypes: [...rule.questionTypes],
      difficulty: rule.difficulty, competencyTags: [...rule.competencyTags], requiredCount: 0, availableCount: 0, gapCount: 0,
      marksPerQuestion: rule.marksPerQuestion,
      ...(rule.typeRequirements ? { typeRequirements: rule.typeRequirements } : {}),
    };
    gap.requiredCount++;
    const assigned = assignments.get(slotIndex);
    if (assigned !== undefined) {
      const question = questions[assigned];
      const { id, status, selectedIndex, createdAt, createdBy, flagCount, lastFlaggedAt, ...snapshot } = question;
      sections[slot.ruleIndex].questions.push({ ...snapshot, questionId: id, marks: rule.marksPerQuestion });
      gap.availableCount++;
    }
    gap.gapCount = gap.requiredCount - gap.availableCount;
    coverage.set(key, gap);
  });
  return {
    sections, gaps: [...coverage.values()].filter((gap) => gap.gapCount > 0),
    actualMarks: sections.reduce((sum, section) => sum + section.questions.length * section.marksPerQuestion, 0),
    requiredCount: slots.length, selectedCount: assignments.size,
  };
}

export function escapeHtml(value: unknown): string {
  return textValue(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}
export function paperPrintHtml(setup: PaperGenerationSetup, sections: GeneratedPaperSection[], answers: boolean): string {
  let number = 0;
  const content = sections.map((section) => `<section><h2>${escapeHtml(section.title)} <span>${section.questions.length * section.marksPerQuestion} marks</span></h2><ol start="${number + 1}">${section.questions.map((question) => {
    number++;
    const answer = question.options[question.correctIndex];
    const body = answers ? `${answer ? `<p><strong>${String.fromCharCode(65 + question.correctIndex)}. ${escapeHtml(answer)}</strong></p>` : ''}${question.solutions.length ? question.solutions.map((solution) => `<p>${escapeHtml(solution)}</p>`).join('') : '<p>No detailed explanation saved.</p>'}` :
      `${question.assets.map((asset) => `<img src="${escapeHtml(asset.url)}" alt="${escapeHtml(asset.alt)}">`).join('')}<ol type="A">${question.options.map((option) => `<li>${escapeHtml(option)}</li>`).join('')}</ol>`;
    return `<li class="question"><p>${escapeHtml(question.question)} <span>[${question.marks}]</span></p>${body}</li>`;
  }).join('')}</ol></section>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(setup.title)}${answers ? ' — Answer key' : ''}</title><style>@page{size:A4;margin:18mm}body{font:14px/1.55 Georgia,serif;color:#172033;max-width:780px;margin:30px auto}header{text-align:center;border-bottom:2px solid #172033;padding-bottom:18px}h1{font-size:24px;margin:8px 0}h2{font-size:17px;margin-top:28px}span{float:right;font-size:13px}header p{margin:4px}li.question{break-inside:avoid;margin:20px 0}li.question>p{white-space:pre-wrap}img{display:block;max-width:100%;max-height:300px;margin:12px 0}ol[type=A] li{margin:5px 0}section>ol{padding-left:24px}@media print{body{margin:0;max-width:none}}</style></head><body><header><strong>GROWTH TUTORIALS</strong><h1>${escapeHtml(setup.title)}</h1><p>${escapeHtml(setup.board)} · Standard ${escapeHtml(setup.standard)} · ${escapeHtml(setup.subjects.join(', '))}</p><p>${answers ? 'ANSWER KEY — keep separate from the student paper' : `${setup.durationMinutes} minutes · ${setup.marks} marks${setup.negativeMarking < 0 ? ` · ${setup.negativeMarking} for each incorrect answer` : ''}`}</p></header>${content}</body></html>`;
}
