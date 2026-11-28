import {readFile} from 'node:fs/promises';
import {parseArgs} from 'node:util';
import {sheets} from '../checking-storage.mjs';
import {examAliasPath,examContent,examDigest,orderedExamFingerprint,publishedExamIdentity,referenceExamIdentity} from '../exam-identity.mjs';
import {gradingRubric} from '../domain/checking.mjs';
import {submissionPath} from '../student-submission-storage.mjs';

const canonicalId = 'a3e920ff-4e3c-4301-a55a-63c9dfa4e00f';
const fingerprint = 'a52da43d4997ff2a7aebaa5d372943954f1a56efd695afb2215c0085ce29dce4';
const migration = 'exam-lineage-reconciliation-20261128';
const idPattern = /^[A-Za-z0-9_-]{1,128}$/;
const shaPattern = /^[a-f0-9]{64}$/;
const roles = ['canonical','same-lineage','same-lineage','same-lineage','separate-seven-page','separate-redox'].sort().join('/');
const usage = `Usage: node assistant-service/scripts/reconcile-exam-identity.mjs --project gtop-app --manifest FILE [--apply --expect-plan SHA256 | --rollback --expect-plan SHA256]
The manifest contains ownerUid and exactly six records, each with id and role.
Roles: canonical, same-lineage (three), separate-seven-page, separate-redox.
Dry run verifies source documents and report bytes and prints the reviewed plan digest.
Apply also requires a comparison object keyed by the three same-lineage IDs.
Each comparison contains canonicalSourceDigest, sourceDigest, evidenceSha256 and
choices, diagrams, provenance each set to "corroborated" after inspecting the actual sources.
The reviewed evidence hash binds that record's comparison to an independently retained review.
Rollback compares the applied receipt, exact sources and unchanged submissions, then removes only its metadata.`;

function assert(condition, code) {
  if (!condition) throw Error(code);
}
const byRole = (rows,role) => rows.filter(row => row.role === role);
const scope = (value,pattern) => typeof value === 'string' && pattern.test(value);

function validateManifest(value) {
  assert(scope(value?.ownerUid,idPattern) && Array.isArray(value.records) && value.records.length === 6 &&
    value.records.every(record => scope(record?.id,idPattern) && typeof record.role === 'string') &&
    new Set(value.records.map(record => record.id)).size === 6 &&
    value.records.map(record => record.role).sort().join('/') === roles,'invalid_manifest');
  return {...value,records:[...value.records].sort((a,b) => a.id.localeCompare(b.id))};
}

const text = value => String(value ?? '').normalize('NFC').replace(/\s+/gu,' ').trim();
const visualSource = /\b(?:diagrams?|figures?|graphs?|pictures?|images?|tables?|drawings?|illustrations?|given below|shown below)\b/iu;

function compareOptions(expected, observed) {
  const ordered = (expected.options??[]).map(text);
  const actual = (observed.options??[]).map(text);
  const wording=text(observed.question);
  if (actual.length || !ordered.length) {
    assert(examDigest(ordered)===examDigest(actual),'multiple_choice_comparison_failed');
    return wording;
  }
  // The generated paper stores choices separately. A scan transcribes them inline.
  for (const format of [c=>c+'.', c=>'('+c+')', c=>c+')']) {
    for (const start of [65,97]) {
      const suffix=ordered.map((option,i)=>format(String.fromCharCode(start+i))+' '+option).join(' ');
      if (wording.endsWith(' '+suffix)) return wording.slice(0,-suffix.length-1).trim();
    }
  }
  throw Error('multiple_choice_comparison_failed');
}
function similar(a,b) {
  // Strip the common ends before computing the bounded edit distance.
  const total=Math.max(a.length,b.length);
  let front=0, tail=0;
  while(front<Math.min(a.length,b.length)&&a[front]===b[front]) front++;
  while(tail<Math.min(a.length,b.length)-front&&a[a.length-1-tail]===b[b.length-1-tail]) tail++;
  a=a.slice(front,a.length-tail);
  b=b.slice(front,b.length-tail);
  const limit=Math.min(120,Math.ceil(total*0.025));
  if (Math.abs(a.length-b.length)>limit || a.length>800 || b.length>800) return {total,distance:total};
  let prior=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){
    const next=[i];
    for(let j=1;j<=b.length;j++) next.push(Math.min(next[j-1]+1,prior[j]+1,prior[j-1]+(a[i-1]===b[j-1]?0:1)));
    prior=next;
  }
  return {total,distance:prior[b.length]};
}
function compareStructure(canonical,scanned) {
  const before=examContent(canonical), after=examContent(scanned);
  const shape=paper => paper.sections.map(section => [section.attemptCount,
    section.questions.map(q => [q.number,q.marks,Boolean(q.alternative)])]);
  const sourceQuestions=before.sections.flatMap(s => s.questions);
  const scannedQuestions=after.sections.flatMap(s => s.questions);
  const allocationShape=paper => paper.sections.flatMap(s=>s.questions.map(q=>[q.number,q.marks]));
  assert(sourceQuestions.length===33 && scannedQuestions.length===33 &&
    examDigest(allocationShape(before))===examDigest(allocationShape(after)),'source_allocations_changed');
  assert(examDigest(shape(before))===examDigest(shape(after)),'section_or_choice_structure_changed');
  let checkedOptions=0, checkedAlternatives=0;
  const comparisons=sourceQuestions.map((q,i)=>{
    const observed=scannedQuestions[i];
    checkedOptions+=q.options.length;
    if(q.alternative){
      checkedAlternatives++;
      assert(text(q.alternative.question)===compareOptions(q.alternative,observed.alternative),
        'alternative_wording_comparison_failed');
      checkedOptions+=q.alternative.options.length;
    }
    return similar(text(q.question),compareOptions(q,observed));
  });
  const chars=comparisons.reduce((sum,c)=>sum+c.total,0);
  const distance=comparisons.reduce((sum,c)=>sum+c.distance,0);
  assert(chars>1000 && distance/chars<=0.002,'main_stem_comparison_failed');
  const visualQuestions=[...sourceQuestions,...scannedQuestions].flatMap(q=>[q,q.alternative].filter(Boolean))
    .filter(q=>q.diagram||q.media||q.assets?.length||visualSource.test(q.question)).length;
  return {questionCount:33,matchingAllocation:true,mainStemSimilarity:1-distance/chars,
    sectionAndChoiceStructureExact:true,checkedOptions,checkedAlternatives,visualReferencesInTranscription:visualQuestions};
}

function points(result) {
  return result.outcome==='complete' || !result.outcome
    ? [result.awarded,result.max] : [result.assessedAwarded,result.assessedMax];
}

function protectedData(row, role) {
  if (role.startsWith('separate-')) return examDigest(row);
  const {examIdentity,...unchanged}=row;
  return examDigest(unchanged);
}

function evidenceSourcePath(row) {
  const id=row.paperId || row.referenceId;
  assert(scope(id,idPattern),'source_id_unavailable');
  if (!id.startsWith('ext-')) return 'assistantPapers/'+id;
  const collection=id.startsWith('ext-auto-')?'submissionReferences':'references';
  return 'assistantCheckingOwners/'+row.ownerUid+'/'+collection+'/'+id;
}

function reportPath(row) {
  const result=row.result;
  const source=result.checkingPath;
  const key=result.fileKey??result.sheetVersion;
  assert(scope(String(key),/^[A-Za-z0-9_-]{1,160}$/),'report_key_unavailable');
  if (!source) return submissionPath(row.id)+'/resultFiles/'+key;
  assert(scope(row.paperId,idPattern) && scope(row.sheetId,idPattern) &&
    source===sheets(row.ownerUid,row.paperId)+'/'+row.sheetId,'report_path_conflict');
  return source+'/resultFiles/'+key;
}

async function inspect(reader, manifest, receipt) {
  const records=await Promise.all(manifest.records.map(async target=>{
    const row=await reader.get(submissionPath(target.id));
    assert(row?.id===target.id && row.ownerUid===manifest.ownerUid && row.status==='released' &&
      Number.isSafeInteger(row.version) && row.version>0 && scope(row.result?.sha,shaPattern),'submission_scope_changed');
    const sourcePath=evidenceSourcePath(row);
    const source=await reader.get(sourcePath);
    assert(source?.ownerUid===manifest.ownerUid && source.id===sourcePath.split('/').at(-1),'source_scope_changed');
    const raw=sourcePath.startsWith('assistantPapers/')?source:source.paper;
    assert(gradingRubric(raw),'source_allocation_unavailable');
    const pending=receipt?.records.find(entry=>entry.id===row.id);
    const version=pending?.version ?? row.version;
    return {id:row.id,role:target.role,row,raw,source,version,sourcePath,
      protectedDigest:protectedData(row,target.role),sourceDigest:examDigest(source),
      reportSha256:row.result.sha,reportPath:reportPath(row)};
  }));
  const [canonical]=byRole(records,'canonical');
  assert(canonical.source.id===canonicalId && canonical.row.teacherUpload===true &&
    points(canonical.row.result).join('/')==='34.5/70' && canonical.raw.marks===70,'canonical_record_changed');
  const matching=byRole(records,'same-lineage');
  const scoreKeys=[];
  for (const record of matching) {
    const {row,source,raw}=record;
    assert(row.paperId===row.referenceId && source.id.startsWith('ext-auto-') && source.state==='ready' &&
      source.submissionUploadId===row.id && source.approvalRevision===row.approvalRevision &&
      source.sourceFingerprint===fingerprint && row.questionFingerprint===fingerprint &&
      orderedExamFingerprint(source)===fingerprint &&
      orderedExamFingerprint({uploaded:row.question?.pages,questionPages:row.question?.pageCount})===fingerprint &&
      source.sourceEvidence?.fingerprint===fingerprint &&
      source.sourceFidelity?.checks?.some(check=>check.number===3),'scan_provenance_changed');
    const score=points(row.result).join('/');
    scoreKeys.push(score);
    const question=row.result.answers?.find(q=>q.number===3);
    assert(row.result.outcome==='partial' && row.result.max===70 && row.result.pending===1 &&
      question?.awarded===null && question.status==='uncertain' &&
      raw.sections.some(section=>section.questions.some(q=>q.number===3&&q.sourceIssue)), 'withheld_question_changed');
    record.contentComparison=compareStructure(canonical.raw,raw);
  }
  assert(scoreKeys.sort().join(',')==='28.5/69,29.5/69,38.5/69','related_results_changed');
  const [seven]=byRole(records,'separate-seven-page'), [redox]=byRole(records,'separate-redox');
  assert((seven.row.question?.pageCount===7 || seven.source.questionPages===7) &&
    /redox/i.test(redox.row.paperTitle||redox.source.title||'') &&
    [seven,redox].every(record=>record.row.questionFingerprint!==fingerprint &&
      record.source.id!==canonicalId && !matching.some(other=>record.source.id===other.source.id)),
    'separate_sources_changed');

  const anchor=canonical.source.examIdentity ?? publishedExamIdentity(canonical.raw,null,{printed:false});
  canonical.identity={...anchor,sourceMaximum:canonical.raw.marks};
  for (const record of matching) {
    const exact=referenceExamIdentity(record.source,record.raw);
    assert(exact.sourceMaximum===canonical.raw.marks,'verified_source_maximum_changed');
    record.identity={...exact,examId:anchor.examId,match:'reviewed-lineage',sourceMaximum:canonical.raw.marks};
  }
  assert(new Set([canonical,...matching].map(record=>record.identity.paperRevisionId)).size===4,
    'exact_paper_revisions_conflict');
  return records;
}

function planFor(ownerUid, records) {
  return {migration,ownerUid,records:records.map(({id,role,version,protectedDigest,sourceDigest,reportSha256,contentComparison,identity})=>({
    id,role,version,protectedDigest,sourceDigest,reportSha256,...(contentComparison?{contentComparison}:{}),...(identity?{identity}:{})
  }))};
}
function verifyReplay(receipt,plan,records) {
  assert(['applied','rolled-back'].includes(receipt.state) && receipt.planSha256===examDigest(plan) &&
    records.every(record=>record.row.version===record.version && (!record.identity ||
      (receipt.state==='rolled-back' ? record.row.examIdentity===undefined
        : examDigest(record.row.examIdentity)===examDigest(record.identity)))),'reconciliation_receipt_conflict');
}
function attestations(manifest,records) {
  const [canonical]=byRole(records,'canonical');
  return byRole(records,'same-lineage').map(record=>{
    const review=manifest.comparison?.[record.id];
    assert(review?.canonicalSourceDigest===canonical.sourceDigest && review?.sourceDigest===record.sourceDigest &&
      scope(review?.evidenceSha256,shaPattern) && ['choices','diagrams','provenance'].every(key=>review[key]==='corroborated'),
      'source_comparison_required');
    return {id:record.id,evidenceSha256:review.evidenceSha256};
  });
}

async function run(store, checker, manifest, {apply,rollback,expectPlan,deleteField}, {readResultBytes,resultShape}) {
  const {ownerUid}=manifest, parent='assistantCheckingOwners/'+ownerUid;
  const receiptPath=parent+'/examIdentityReconciliations/'+migration;
  const receipt=await store.get(receiptPath);
  const records=await inspect(store,manifest,receipt);
  const plan=planFor(ownerUid,records);
  const planSha256=examDigest(plan);
  if (receipt) verifyReplay(receipt,plan,records);
  for (const record of records) {
    const stage=resultShape(checker,record.row.result);
    assert(stage.chunks===record.row.result.chunks && scope(record.row.result.generation,idPattern),'report_pointer_changed');
    await readResultBytes(checker,record.reportPath,record.row.result,false);
  }
  if (!apply && !rollback) return {...plan,planSha256,
    mode:receipt?.state==='rolled-back'?'rolled-back':receipt?'already-applied':'dry-run',reportsVerified:records.length};
  assert(expectPlan===planSha256,'reconciliation_plan_changed');
  const comparison=apply ? attestations(manifest,records) : null;
  return store.transaction(async tx=>{
    const prior=await tx.get(receiptPath);
    const live=await inspect(tx,manifest,prior);
    const livePlan=planFor(ownerUid,live);
    assert(examDigest(livePlan)===planSha256,'reconciliation_compare_and_set_failed');
    if (prior) verifyReplay(prior,livePlan,live);
    if (prior && !rollback) {
      assert(prior.state==='applied','reconciliation_was_rolled_back');
      return {mode:'already-applied',planSha256,updated:0,unchanged:6};
    }
    if (rollback) assert(prior,'reconciliation_receipt_unavailable');
    if (rollback && prior.state==='rolled-back') return {mode:'already-rolled-back',planSha256,updated:0,unchanged:6};
    const [canonical]=byRole(live,'canonical');
    const aliasPath=examAliasPath(ownerUid,'scan:'+fingerprint);
    const alias=await tx.get(aliasPath);
    const expectedAlias={ownerUid,fingerprint,examId:canonical.identity.examId,
      paperRevisionId:canonical.identity.paperRevisionId};
    assert(!alias || examDigest(alias)===examDigest(expectedAlias),'existing_exam_alias_conflict');
    const linked=live.filter(entry=>entry.identity);
    if (rollback) {
      assert(!prior.aliasCreated || alias,'reconciliation_alias_unavailable');
      for (const record of linked) tx.update(submissionPath(record.id),{examIdentity:deleteField()});
      if (prior.aliasCreated) tx.delete(aliasPath);
      tx.update(receiptPath,{state:'rolled-back',rolledBackAt:new Date().toISOString()});
      return {mode:'rolled-back',planSha256,updated:4,unchanged:2,reportsVerified:records.length};
    }
    for (const record of linked) {
      assert(record.row.version===record.version && record.row.examIdentity===undefined,
        'existing_submission_lineage_conflict');
      tx.update(submissionPath(record.id),{examIdentity:record.identity});
    }
    if (!alias) tx.create(aliasPath,expectedAlias);
    tx.create(receiptPath,{...plan,planSha256,comparison,state:'applied',aliasCreated:!alias,appliedAt:new Date().toISOString()});
    return {mode:'applied',planSha256,updated:4,unchanged:2,reportsVerified:records.length};
  });
}

async function main() {
  const {values}=parseArgs({options:{project:{type:'string'},manifest:{type:'string'},apply:{type:'boolean'},
    'expect-plan':{type:'string'},rollback:{type:'boolean'},help:{type:'boolean'}}});
  if (values.help) { console.log(usage); return; }
  assert(values.project==='gtop-app' && !process.env.FIRESTORE_EMULATOR_HOST && values.manifest &&
    !(values.apply && values.rollback) &&
    (!(values.apply || values.rollback) || scope(values['expect-plan'],shaPattern)),'invalid_reconciliation_arguments');
  const manifest=validateManifest(JSON.parse(await readFile(values.manifest,'utf8')));
  const [{initializeApp,applicationDefault,deleteApp},{getFirestore,FieldValue},{FirestoreStore},grading]=await Promise.all([
    import('firebase-admin/app'),import('firebase-admin/firestore'),import('../store.mjs'),import('../submission-grading.mjs')
  ]);
  const app=initializeApp({credential:applicationDefault(),projectId:values.project});
  try {
    const store=new FirestoreStore(getFirestore(app));
    const checker={store,fail:(_status,code)=>{throw Error(code);}};
    console.log(JSON.stringify(await run(store,checker,manifest,
      {apply:values.apply,rollback:values.rollback,expectPlan:values['expect-plan'],deleteField:()=>FieldValue.delete()},grading),null,2));
  } finally { await deleteApp(app); }
}

try { await main(); }
catch (error) {
  const code=error instanceof Error && /^[a-z0-9_]+$/.test(error.message) ? error.message : 'reconciliation_unavailable';
  console.error(JSON.stringify({error:code}));
  process.exitCode=1;
}
