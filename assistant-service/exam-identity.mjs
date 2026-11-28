import {createHash} from 'node:crypto';
import {digest} from './checking-storage.mjs';
import {gradingRubric} from './domain/checking.mjs';
import {externalGradingPaper} from './domain/external-reference.mjs';

const idPattern = /^[A-Za-z0-9_-]{1,128}$/;
const shaPattern = /^[a-f0-9]{64}$/;
const codePattern = /^GT(?:-[A-F0-9]{4}){5}$/;
const visualSource = /\b(?:diagrams?|figures?|graphs?|pictures?|images?|tables?|drawings?|illustrations?|given below|shown below)\b|\u091a\u093f\u0924\u094d\u0930|\u0906\u0930\u0947\u0916|\u0917\u094d\u0930\u093e\u092b|\u0924\u093e\u0932\u093f\u0915\u093e/iu;
const candidateLimit = 5;

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined)
      .map(key => [key, stable(value[key])]));
  }
  return value;
}
export const examDigest = (...values) => createHash('sha256').update(JSON.stringify(stable(values))).digest('hex');
const ownerPath = uid => 'assistantCheckingOwners/' + uid;
const candidatesPath = uid => ownerPath(uid) + '/examIdentityCandidates';
export const examAliasPath = (uid, key) => ownerPath(uid) + '/examIdentityAliases/' + examDigest(key);

export function printedExamCode(value) {
  if (typeof value !== 'string' || value.length > 50) return null;
  const code = value.trim().toUpperCase().replace(/^GTEXAM:1:/, '');
  return codePattern.test(code) ? code : null;
}
const normalizedText = value => (typeof value === 'string' ? value : '').normalize('NFC').replace(/\s+/gu, ' ').trim();
function candidateWording(variant) {
  const question=normalizedText(variant.question);
  if (variant.options?.length) return [question,...variant.options.map(normalizedText)];
  // A source extraction may transcribe the four printed choices inside the stem.
  // Interpret only an unambiguous ordered run with one label style and case.
  const styles = [
    /(?:^|\s)([a-d])[.)]\s+/g, /(?:^|\s)\(([a-d])\)\s+/g,
    /(?:^|\s)([A-D])[.)]\s+/g, /(?:^|\s)\(([A-D])\)\s+/g
  ];
  const groups=styles.map(pattern=>[...question.matchAll(pattern)])
    .filter(markers=>markers.map(marker=>marker[1].toLowerCase()).join('')==='abcd');
  if (groups.length!==1) return [question];
  const [markers]=groups;
  return [question.slice(0,markers[0].index).trim(),...markers.map((marker,i)=>
    question.slice(marker.index+marker[0].length,markers[i+1]?.index).trim())];
}
const questionVariant = q => ({
  question: q.question ?? '', options: q.options ?? [], ...(q.assets ? {assets:q.assets} : {}),
  ...(q.diagram ? {diagram:q.diagram} : {}), ...(q.media ? {media:q.media} : {}),
  ...(q.sourceIssue ? {sourceIssue:q.sourceIssue} : {})
});

export function examContent(paper) {
  return {
    title:paper.title, marks:paper.marks, board:paper.board, standard:paper.standard, subject:paper.subject,
    academicYear:paper.academicYear, durationMinutes:paper.durationMinutes, questionLanguage:paper.questionLanguage,
    instructions:paper.instructions ?? [],
    sections:paper.sections.map(section => ({
      title:section.title, instructions:section.instructions, attemptCount:section.attemptCount??section.questions.length,
      questions:section.questions.map(q => ({
        number:q.number, marks:q.marks, label:q.label, sourcePage:q.sourcePage, type:q.type, ...questionVariant(q),
        alternative:q.alternative ? questionVariant(q.alternative) : null
      }))
    }))
  };
}

// Exact structure and meaningful, normalized question wording corroborate each other.
// A textual transcription alone cannot corroborate a visual-dependent paper.
export function examCandidate(paper) {
  if (!Array.isArray(paper?.sections)) return null;
  const questions = paper.sections.flatMap(s => s.questions);
  if (questions.length < 5 || questions.length > 100) return null;
  const variants = questions.flatMap(q => q.alternative ? [q,q.alternative] : [q]);
  const text = variants.map(candidateWording);
  if (variants.some(q => q.sourceIssue || q.assets?.length || q.diagram || q.media) ||
      text.flat().some(t => !t || visualSource.test(t)) || text.flat().join(' ').length < 150) return null;
  const structure = paper.sections.map(s => [s.attemptCount??s.questions.length,
    s.questions.map(q => [q.number, q.marks, Boolean(q.alternative)])]);
  const instructions = [paper.instructions ?? [], paper.sections.map(s => s.instructions ?? '')]
    .map(items => items.map(normalizedText).filter(Boolean));
  return {structure:examDigest('exam-structure-v1', paper.marks, structure),
    wording:examDigest('exam-wording-v1', text, instructions)};
}

function orderedUploadFingerprint(record, from, to, tag) {
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 1 || to < from || to > 24 ||
      !Array.isArray(record.uploaded)) return null;
  const pages = record.uploaded.filter(page => page.index >= from && page.index <= to).sort((a,b) => a.index-b.index);
  if (pages.length !== to-from+1 || pages.some((page,i) => page.index !== from+i || !shaPattern.test(page.sha ?? ''))) return null;
  return digest(tag, ...pages.map(page => page.sha));
}
export const orderedExamFingerprint = record =>
  orderedUploadFingerprint(record,1,record.questionPages,'ordered-question-pages-v1');

function exactIdentity({ownerUid, id, kind, paper, provenance, examId, match, examCode = null, rubric}) {
  const sourceDigest = examDigest('exam-source-v1', kind, id, examContent(paper), provenance);
  const paperRevisionId = 'rev-' + examDigest('exam-revision-v1', ownerUid, kind, id, sourceDigest);
  return {examId, paperRevisionId, examCode, match, sourceMaximum:rubric?.marks ?? null,
    source:{kind,id,digest:sourceDigest}, rubricDigest:rubric ? digest(rubric) : null};
}

export function publishedExamIdentity(paper, base, {printed = true} = {}) {
  const examId = base?.examIdentity?.examId || 'exam-' + examDigest('published-exam-v1',
    paper.ownerUid, paper.conversationId, paper.rootRequestMessageId || paper.id);
  const identity = exactIdentity({ownerUid:paper.ownerUid,id:paper.id,kind:'published',paper,
    provenance:paper.sourceReferences??[],examId,match:'published',rubric:gradingRubric(paper)});
  return printed ? {...identity,examCode:'GT-' + identity.paperRevisionId.slice(4,24).toUpperCase().match(/.{4}/g).join('-')} : identity;
}

export function referenceExamIdentity(record, paper, lineage, {reviewed = false} = {}) {
  const stored = record.examIdentity;
  const confirmed = stored?.match === 'reference-only' && lineage ? lineage : stored ?? lineage;
  const examId = confirmed?.examId || 'exam-' + examDigest('external-exam-v1',
    record.ownerUid, record.sourceId || record.id);
  const match = confirmed?.match === 'reference-only' && reviewed ? 'teacher-source'
    : confirmed?.match || (reviewed ? 'teacher-source' : 'reference-only');
  const fingerprint = orderedExamFingerprint(record);
  const identity = exactIdentity({ownerUid:record.ownerUid,id:record.id,kind:'reference',paper,
    provenance:{fingerprint,sourceId:record.sourceId??null,questionPages:record.questionPages},
    examId,match,rubric:gradingRubric(externalGradingPaper(paper))});
  const rubricSourceFingerprint=orderedUploadFingerprint(record,record.questionPages+1,
    record.pageCount,'ordered-marking-scheme-pages-v1');
  return rubricSourceFingerprint ? {...identity,rubricSourceFingerprint} : identity;
}

export function approvedExamSourceMatches(source, pinned) {
  if (!pinned) return true;
  const identity = source?.examIdentity;
  if (!identity?.source || !pinned.source || source.exactExamSource===false) return false;
  const current = identity.source.kind==='published' ? publishedExamIdentity(source) : identity;
  return current.source.kind===pinned.source.kind && current.source.id===pinned.source.id &&
    current.source.digest===pinned.source.digest && current.paperRevisionId===pinned.paperRevisionId &&
    current.rubricDigest===pinned.rubricDigest && current.rubricSourceFingerprint===pinned.rubricSourceFingerprint;
}

export function stageExamCandidate(tx, uid, paper, identity) {
  const candidate = examCandidate(paper);
  const entry = {examId:identity.examId, paperRevisionId:identity.paperRevisionId, ownerUid:uid,
    ...(candidate || {})};
  if (candidate) tx.create(candidatesPath(uid) + '/' + identity.paperRevisionId, entry);
  if (identity.examCode) tx.create(examAliasPath(uid, 'code:' + identity.examCode), entry);
}

const validLineage = (record,uid) => record?.ownerUid === uid && /^exam-[a-f0-9]{64}$/.test(record.examId);
const sameCandidate = (candidate,row) => candidate.structure === row.structure && candidate.wording === row.wording;
export async function resolveExamLineage(store, record, paper, rawCode, {scanAlias} = {}) {
  const uid = record.ownerUid;
  if (!idPattern.test(uid ?? '')) return null;
  const fingerprint = orderedExamFingerprint(record);
  const code = printedExamCode(rawCode);
  const candidate = examCandidate(paper);
  if (fingerprint) {
    const alias = scanAlias === undefined ? await store.get(examAliasPath(uid,'scan:' + fingerprint)) : scanAlias;
    if (validLineage(alias,uid) && alias.fingerprint === fingerprint)
      return {examId:alias.examId,match:'verified-scan'};
  }
  if (code && candidate) {
    const alias = await store.get(examAliasPath(uid,'code:' + code));
    if (validLineage(alias,uid) && sameCandidate(candidate,alias))
      return {examId:alias.examId,match:'printed-match'};
  }
  if (!candidate) return null;
  const rows = await store.list(candidatesPath(uid), [['structure','==',candidate.structure]], candidateLimit);
  // An unexamined candidate may be another examination with identical content.
  if (rows.length === candidateLimit) return null;
  const matched = new Set(rows.filter(row => validLineage(row,uid) && sameCandidate(candidate,row)).map(row => row.examId));
  return matched.size === 1 ? {examId:matched.values().next().value,match:'corroborated-content'} : null;
}
