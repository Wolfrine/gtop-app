import {artifactFilename} from './domain/artifact-filenames.mjs';

const validMaximum = value => Number.isFinite(value) && value >= 0 ? value : null;
const validMark = (value, maximum) => maximum !== null && Number.isFinite(value) && value >= 0 && value <= maximum
  ? value : null;
const outcomes = new Set(['complete', 'partial', 'unassessable']);
const questionStates = new Set(['correct', 'partial', 'wrong', 'missing', 'unreadable', 'uncertain']);

export function releasedAssessment(record) {
  const result = record.result;
  const title = record.paperTitle || record.title || 'Checked answer sheet';
  const recordedMaximum = validMaximum(result.max);
  const earned = validMark(result.awarded, recordedMaximum);
  const outcome = outcomes.has(result.outcome) ? result.outcome
    : result.outcome == null && earned !== null ? 'complete' : null;
  const assessedMaximum = validMaximum(result.assessedMax);
  const names = {label:title, id:record.id, revision:result.sheetVersion, digest:result.sha, extension:'pdf'};
  return {
    title, outcome, releasedAt: record.releasedAt || null,
    message: typeof result.message === 'string' ? result.message : null,
    revision: String(result.sheetVersion) + '-' + result.sha,
    filename: artifactFilename({...names, kind:'checked-report'}),
    summaryFilename: artifactFilename({...names, kind:'result-summary'}),
    fullMaximum: validMaximum(record.examIdentity?.sourceMaximum) ?? recordedMaximum,
    final: outcome === 'complete' && earned !== null ? {earned, maximum: recordedMaximum} : null,
    assessed: assessedMaximum !== null ? {
      earned:validMark(result.assessedAwarded, assessedMaximum), maximum:assessedMaximum,
    } : null,
    pending: Number.isSafeInteger(result.pending) && result.pending >= 0 ? result.pending : null,
    questions: (Array.isArray(result.answers) ? result.answers.slice(0,100) : [])
      .filter(question => Number.isSafeInteger(question?.number) && question.number > 0)
      .map(question => {
        const maximum = validMaximum(question.max);
        return {
          number:question.number, maximum, earned:validMark(question.awarded,maximum),
          state:questionStates.has(question.status) ? question.status : null,
          choice:['A','B'].includes(question.choice) ? question.choice : null,
          counted:typeof question.counted === 'boolean' ? question.counted : null,
          explanation:typeof question.explanation === 'string' ? question.explanation.slice(0,600) : '',
        };
      }),
  };
}
