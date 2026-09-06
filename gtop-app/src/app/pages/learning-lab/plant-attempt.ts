import { baseline, questions, missions, LESSON_VERSION } from './plant-lesson';

export const MAX_ATTEMPTS = 5;
export type Answers = Record<string, number>;
export interface PlantFieldwork {
  mission: number; opened: boolean; inspected: string[];
  source: 'same-flower' | 'same-plant' | 'other-plant' | 'other-species';
  landing: 'petal' | 'stigma';
  pollenTrials: { source: PlantFieldwork['source']; landing: PlantFieldwork['landing'] }[];
  journeyStage: number; fruitStage: number; dispersalOpen: boolean;
  wind: number; windTrials: number[];
  budA: boolean; budB: boolean; growthStage: number; comparedBuds: boolean;
  leafOpen: boolean; leafSeen: boolean; leafPlanted: boolean;
}
export function freshFieldwork(): PlantFieldwork {
  return { mission:0, opened:false, inspected:[], source:'same-flower', landing:'stigma',
    pollenTrials:[], journeyStage:0, fruitStage:0, dispersalOpen:false, wind:0, windTrials:[],
    budA:true, budB:false, growthStage:0, comparedBuds:false, leafOpen:false, leafSeen:false, leafPlanted:false };
}
export function validFieldwork(f: PlantFieldwork): boolean {
  return !!f && Number.isInteger(f.mission) && f.mission >= 0 && f.mission < 5
    && ['opened','dispersalOpen','budA','budB','comparedBuds','leafOpen','leafSeen','leafPlanted'].every(k => typeof (f as any)[k] === 'boolean')
    && Array.isArray(f.inspected) && f.inspected.length <= 4 && f.inspected.every(p => ['anther','stigma','style','ovary'].includes(p))
    && ['same-flower','same-plant','other-plant','other-species'].includes(f.source)
    && ['petal','stigma'].includes(f.landing)
    && Array.isArray(f.pollenTrials) && f.pollenTrials.length <= 12 && f.pollenTrials.every(t => !!t && ['same-flower','same-plant','other-plant','other-species'].includes(t.source) && ['petal','stigma'].includes(t.landing))
    && [f.journeyStage,f.fruitStage,f.wind,f.growthStage].every(Number.isInteger)
    && f.journeyStage >= 0 && f.journeyStage <= 3 && f.fruitStage >= 0 && f.fruitStage <= 2
    && f.wind >= 0 && f.wind <= 2 && f.growthStage >= 0 && f.growthStage <= 2
    && Array.isArray(f.windTrials) && f.windTrials.length <= 3 && f.windTrials.every(v => Number.isInteger(v) && v >= 0 && v <= 2);
}

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
  fieldwork?: PlantFieldwork;
}
export interface LabHistory {
  lessonId: 'plant-reproduction';
  attempts: LabAttempt[];
}
export type LabChange =
  | { kind: 'fieldwork'; fieldwork: PlantFieldwork }
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
function validPartialAnswers(answers: Answers, items: readonly {id:string; choices:readonly string[]}[]) {
  return !!answers && typeof answers === 'object' && !Array.isArray(answers)
    && Object.entries(answers).every(([id, value]) => {
      const q = items.find(q => q.id === id);
      return !!q && Number.isInteger(value) && value >= 0 && value < q.choices.length;
    });
}
export function newAttempt(
  id: string,
  answers: Answers,
  now: number,
): LabAttempt {
  if (!validPartialAnswers(answers, baseline)) throw new Error('Invalid initial answers.');
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
    fieldwork: freshFieldwork(),
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
  if (![LESSON_VERSION, 'plant-reproduction-1.0'].includes(attempt.version))
    throw new Error('This lesson has changed. Start a new attempt.');
  const next: LabAttempt = { ...attempt, updatedAt: now };
  if (change.kind === 'fieldwork') {
    if (!validFieldwork(change.fieldwork)) throw new Error('Invalid fieldwork.');
    next.fieldwork = JSON.parse(JSON.stringify(change.fieldwork));
  } else if (change.kind === 'prediction') {
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
      !missions.some((m) => m.id === change.mission)
    )
      throw new Error('Unknown exploration.');
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
        ![LESSON_VERSION, 'plant-reproduction-1.0'].includes(a.version) ||
        !Number.isFinite(a.createdAt) ||
        !Number.isFinite(a.updatedAt)
      )
        return false;
      if (
        !['experiment', 'checked', 'complete'].includes(a.phase) ||
        !validPartialAnswers(a.baseline, baseline)
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
            missions.some((m) => m.id === id),
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
    .slice(0, MAX_ATTEMPTS)
    .map(a => ({...a, fieldwork: validFieldwork(a.fieldwork!) ? a.fieldwork : freshFieldwork()}));
}
